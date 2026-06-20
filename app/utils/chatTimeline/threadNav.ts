import {
  getMessageBody,
  getRedactedEventIds,
  isRedactedMessageEvent,
  isUndecryptableEvent,
} from './reactionsAndMedia'
import {
  buildThreadSummariesByRoot,
  filterTimelineEventsByType,
} from './relations'
import type {
  BuildRoomThreadNavOptions,
  PreservedTimelineWindowInput,
  PreservedTimelineWindowSelection,
  ThreadNavEntry,
  TimelineWindowOptions,
  TimelineWindowSelection,
} from './types'

export const DEFAULT_THREAD_SIDEBAR_MAX_AGE_DAYS = 2

function threadTitleFromRootEvent(
  rootEvent: Record<string, any> | undefined,
  redactedEventIds: Set<string>,
  deletedMessageText: string,
): string {
  if (!rootEvent) {
    return 'Thread'
  }
  const senderUserId = rootEvent.getSender?.() ?? ''
  const redactedMessage = isRedactedMessageEvent(rootEvent, redactedEventIds)
  const undecryptableMessage =
    !redactedMessage && isUndecryptableEvent(rootEvent)
  const body = getMessageBody(rootEvent, senderUserId, undecryptableMessage, {
    redactedMessage,
    deletedMessageText,
  })
  const firstLine = body.split('\n')[0]?.trim() ?? ''
  const clipped =
    firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine
  return clipped || 'Thread'
}

/**
 * Threads with at least one reply, for channel sidebar (newest activity first).
 */
export function buildRoomThreadNavEntries(
  room: Record<string, any>,
  options?: BuildRoomThreadNavOptions,
): ThreadNavEntry[] {
  const allEvents = room.getLiveTimeline().getEvents()
  const redactedEventIds = getRedactedEventIds(allEvents)
  const summaries = buildThreadSummariesByRoot(room)
  const typed = filterTimelineEventsByType(allEvents)
  const eventById = new Map<string, Record<string, any>>()
  for (const timelineEvent of typed) {
    const eventId = timelineEvent.getId?.()
    if (eventId) {
      eventById.set(eventId, timelineEvent)
    }
  }

  const entries: ThreadNavEntry[] = []
  for (const [rootId, summary] of summaries) {
    if (summary.replyCount < 1) {
      continue
    }
    const rootEvent = eventById.get(rootId)
    const lastTs =
      summary.lastReply?.originServerTs ?? Number(rootEvent?.getTs?.() ?? 0)
    entries.push({
      rootEventId: rootId,
      title: threadTitleFromRootEvent(
        rootEvent,
        redactedEventIds,
        'Message deleted',
      ),
      replyCount: summary.replyCount,
      lastActivityTs: lastTs,
      lastReplySenderName: summary.lastReply?.senderName,
      lastReplyBody: summary.lastReply?.body,
      lastReplyAvatarUrl: summary.lastReply?.avatarUrl,
    })
  }

  entries.sort((entryA, entryB) => {
    return entryB.lastActivityTs - entryA.lastActivityTs
  })

  if (options?.maxAgeDays === null) {
    return entries
  }

  const maxAgeDays =
    options?.maxAgeDays ?? DEFAULT_THREAD_SIDEBAR_MAX_AGE_DAYS
  const nowMs = options?.nowMs ?? Date.now()
  const cutoffTs = nowMs - maxAgeDays * 24 * 60 * 60 * 1000
  return entries.filter((entry) => entry.lastActivityTs >= cutoffTs)
}

export function resolveTimelineWindowSelection(
  eventIds: string[],
  options: TimelineWindowOptions,
): TimelineWindowSelection {
  const totalEvents = eventIds.length
  if (totalEvents === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      anchorIndex: null,
      anchorFound: false,
    }
  }

  const normalizedWindowSize = Math.max(1, Math.floor(options.windowSize || 0))
  const effectiveWindowSize = Math.min(normalizedWindowSize, totalEvents)
  const anchorEventId = options.anchorEventId
  const anchorIndex = anchorEventId
    ? eventIds.findIndex((eventId) => eventId === anchorEventId)
    : -1
  const anchorFound = anchorIndex >= 0

  if (!anchorFound) {
    return {
      startIndex: totalEvents - effectiveWindowSize,
      endIndex: totalEvents,
      anchorIndex: null,
      anchorFound: false,
    }
  }

  const halfWindowSize = Math.floor(effectiveWindowSize / 2)
  let startIndex = anchorIndex - halfWindowSize
  startIndex = Math.max(0, startIndex)
  const maxStartIndex = Math.max(0, totalEvents - effectiveWindowSize)
  startIndex = Math.min(startIndex, maxStartIndex)
  const endIndex = Math.min(totalEvents, startIndex + effectiveWindowSize)

  return {
    startIndex,
    endIndex,
    anchorIndex,
    anchorFound: true,
  }
}

export function resolvePreservedTimelineWindow(
  input: PreservedTimelineWindowInput,
): PreservedTimelineWindowSelection {
  const {
    previousEndIndex,
    previousEventCount,
    previousFirstMessageId,
    previousLastMessageId,
    nextEventIds,
    windowSize,
    stickToBottom,
  } = input

  const totalEvents = nextEventIds.length
  const wasShowingLatest = previousEndIndex >= previousEventCount

  const nextStartIndex = previousFirstMessageId
    ? nextEventIds.findIndex(
        (eventId) => eventId === previousFirstMessageId,
      )
    : -1
  const nextLastIndex = previousLastMessageId
    ? nextEventIds.findIndex(
        (eventId) => eventId === previousLastMessageId,
      )
    : -1

  let startIndex: number
  let endIndex: number

  if (nextStartIndex >= 0 && nextLastIndex >= nextStartIndex) {
    startIndex = nextStartIndex
    endIndex = nextLastIndex + 1
  } else {
    const fallbackSelection = resolveTimelineWindowSelection(nextEventIds, {
      windowSize,
    })
    startIndex = fallbackSelection.startIndex
    endIndex = fallbackSelection.endIndex
  }

  if (wasShowingLatest || stickToBottom) {
    endIndex = totalEvents
  }

  const shouldScrollToBottom = stickToBottom && wasShowingLatest

  return {
    startIndex,
    endIndex,
    shouldScrollToBottom,
  }
}
