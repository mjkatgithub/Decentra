import { readMessageRelationSnapshot } from '~/utils/matrixThreadRelations'
import {
  getMessageBody,
  isRedactedMessageEvent,
  isUndecryptableEvent,
  getRedactedEventIds,
} from './reactionsAndMedia'
import type {
  ChatThreadLastReply,
  ChatThreadSummary,
  ChatTimelineMessage,
  MessageRelationIndex,
  TimelineEventRecord,
} from './types'

function eventTypesForChatTimeline(): Set<string> {
  return new Set([
    'm.room.message',
    'm.room.encrypted',
    'm.room.member',
    'm.room.name',
    'm.room.avatar',
    'm.room.topic',
    'm.room.pinned_events',
  ])
}

export function filterTimelineEventsByType(
  rawEvents: Record<string, any>[],
): Record<string, any>[] {
  const allowed = eventTypesForChatTimeline()
  return rawEvents.filter((timelineEvent) => {
    const eventType = timelineEvent.getType?.() ?? ''
    return allowed.has(eventType)
  })
}

function resolveThreadRootFromEventId(
  eventId: string,
  eventsById: Map<string, TimelineEventRecord>,
  threadRootByMessageId: Map<string, string>,
  visited = new Set<string>(),
): string | undefined {
  if (visited.has(eventId)) {
    return undefined
  }
  visited.add(eventId)

  const mappedRoot = threadRootByMessageId.get(eventId)
  if (mappedRoot) {
    return mappedRoot
  }

  const timelineEvent = eventsById.get(eventId)
  if (!timelineEvent) {
    return undefined
  }

  const snapshot = readMessageRelationSnapshot(timelineEvent)
  if (snapshot.threadRootId) {
    return snapshot.threadRootId
  }
  if (snapshot.replaceTargetId) {
    const inheritedRoot = resolveThreadRootFromEventId(
      snapshot.replaceTargetId,
      eventsById,
      threadRootByMessageId,
      visited,
    )
    if (inheritedRoot) {
      return inheritedRoot
    }
  }
  if (snapshot.inReplyToId) {
    const parentRoot = threadRootByMessageId.get(snapshot.inReplyToId)
    if (parentRoot) {
      return parentRoot
    }
    return resolveThreadRootFromEventId(
      snapshot.inReplyToId,
      eventsById,
      threadRootByMessageId,
      visited,
    )
  }
  return undefined
}

export function collectMessageTimelineEvents(
  rawEvents: TimelineEventRecord[],
): TimelineEventRecord[] {
  return rawEvents.filter((timelineEvent) => {
    const eventType = timelineEvent.getType?.() ?? ''
    return eventType === 'm.room.message' && !isUndecryptableEvent(timelineEvent)
  })
}

export function buildMessageRelationIndex(
  messageEvents: TimelineEventRecord[],
): MessageRelationIndex {
  const threadRootByMessageId = new Map<string, string>()
  const latestReplacementByTarget = new Map<
    string,
    { replacementId: string; originServerTs: number }
  >()
  const replacementIdsByTarget = new Map<string, Set<string>>()
  const eventsById = new Map<string, TimelineEventRecord>()

  for (const timelineEvent of messageEvents) {
    const eventId = timelineEvent.getId?.() ?? ''
    if (!eventId) {
      continue
    }
    eventsById.set(eventId, timelineEvent)

    const snapshot = readMessageRelationSnapshot(timelineEvent)
    if (snapshot.threadRootId) {
      threadRootByMessageId.set(eventId, snapshot.threadRootId)
    }

    if (!snapshot.replaceTargetId) {
      continue
    }
    const originServerTs = Number(timelineEvent.getTs?.() ?? 0)
    const replacementIds =
      replacementIdsByTarget.get(snapshot.replaceTargetId) ??
      new Set<string>()
    replacementIds.add(eventId)
    replacementIdsByTarget.set(snapshot.replaceTargetId, replacementIds)

    const previous = latestReplacementByTarget.get(snapshot.replaceTargetId)
    if (!previous || originServerTs >= previous.originServerTs) {
      latestReplacementByTarget.set(snapshot.replaceTargetId, {
        replacementId: eventId,
        originServerTs,
      })
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const timelineEvent of messageEvents) {
      const eventId = timelineEvent.getId?.() ?? ''
      if (!eventId || threadRootByMessageId.has(eventId)) {
        continue
      }
      const snapshot = readMessageRelationSnapshot(timelineEvent)
      if (snapshot.replaceTargetId) {
        const inheritedRoot = threadRootByMessageId.get(
          snapshot.replaceTargetId,
        )
        if (inheritedRoot) {
          threadRootByMessageId.set(eventId, inheritedRoot)
          changed = true
          continue
        }
      }
      if (snapshot.inReplyToId) {
        const inheritedRoot = threadRootByMessageId.get(snapshot.inReplyToId)
        if (inheritedRoot) {
          threadRootByMessageId.set(eventId, inheritedRoot)
          changed = true
        }
      }
    }
  }

  for (const timelineEvent of messageEvents) {
    const eventId = timelineEvent.getId?.() ?? ''
    if (!eventId || threadRootByMessageId.has(eventId)) {
      continue
    }
    const inheritedRoot = resolveThreadRootFromEventId(
      eventId,
      eventsById,
      threadRootByMessageId,
    )
    if (inheritedRoot && inheritedRoot !== eventId) {
      threadRootByMessageId.set(eventId, inheritedRoot)
    }
  }

  const supersededMessageIds = new Set<string>()
  for (const [targetId, replacementIds] of replacementIdsByTarget) {
    supersededMessageIds.add(targetId)
    const latest = latestReplacementByTarget.get(targetId)
    for (const replacementId of replacementIds) {
      if (replacementId !== latest?.replacementId) {
        supersededMessageIds.add(replacementId)
      }
    }
  }

  const displayTsByEventId = new Map<string, number>()
  for (const timelineEvent of messageEvents) {
    const eventId = timelineEvent.getId?.() ?? ''
    if (!eventId || supersededMessageIds.has(eventId)) {
      continue
    }
    const ownTs = Number(timelineEvent.getTs?.() ?? 0)
    const snapshot = readMessageRelationSnapshot(timelineEvent)
    if (snapshot.replaceTargetId) {
      const targetEvent = eventsById.get(snapshot.replaceTargetId)
      const targetTs = Number(targetEvent?.getTs?.() ?? 0)
      displayTsByEventId.set(eventId, targetTs > 0 ? targetTs : ownTs)
      continue
    }
    displayTsByEventId.set(eventId, ownTs)
  }

  return {
    threadRootByMessageId,
    supersededMessageIds,
    displayTsByEventId,
  }
}

function shouldIncludeMessageInMainTimeline(
  timelineEvent: TimelineEventRecord,
  relationIndex: MessageRelationIndex,
): boolean {
  const eventType = timelineEvent.getType?.() ?? ''
  if (eventType !== 'm.room.message') {
    return true
  }
  if (isUndecryptableEvent(timelineEvent)) {
    return true
  }
  const eventId = timelineEvent.getId?.() ?? ''
  if (eventId && relationIndex.supersededMessageIds.has(eventId)) {
    return false
  }
  const snapshot = readMessageRelationSnapshot(timelineEvent)
  if (snapshot.threadRootId) {
    return false
  }
  if (eventId && relationIndex.threadRootByMessageId.has(eventId)) {
    return false
  }
  return true
}

export function shouldIncludeMessageInThreadView(
  timelineEvent: TimelineEventRecord,
  rootEventId: string,
  relationIndex: MessageRelationIndex,
  redactedEventIds: Set<string>,
): boolean {
  const eventType = timelineEvent.getType?.() ?? ''
  const eventId = timelineEvent.getId?.() ?? ''
  if (eventId && relationIndex.supersededMessageIds.has(eventId)) {
    return false
  }
  if (eventId === rootEventId) {
    return true
  }
  const isChatMessageType =
    eventType === 'm.room.message' || eventType === 'm.room.encrypted'
  if (!isChatMessageType) {
    return false
  }
  if (
    isUndecryptableEvent(timelineEvent) &&
    !isRedactedMessageEvent(timelineEvent, redactedEventIds)
  ) {
    return false
  }
  if (relationIndex.threadRootByMessageId.get(eventId) === rootEventId) {
    return true
  }
  const snapshot = readMessageRelationSnapshot(timelineEvent)
  return snapshot.threadRootId === rootEventId
}

export function sortTimelineMessagesByOriginTs(
  messages: ChatTimelineMessage[],
): ChatTimelineMessage[] {
  return [...messages].sort((leftMessage, rightMessage) => {
    const leftTs = leftMessage.originServerTs ?? 0
    const rightTs = rightMessage.originServerTs ?? 0
    if (leftTs !== rightTs) {
      return leftTs - rightTs
    }
    return 0
  })
}

export { shouldIncludeMessageInMainTimeline }

/**
 * Aggregates thread reply counts and last reply per root (MSC3440).
 */
export function buildThreadSummariesByRoot(
  room: Record<string, any>,
  getMemberAvatarUrl?: (
    member: Record<string, any>,
  ) => string | undefined,
  buildDeletedMessageText: () => string = () => 'Message deleted',
): Map<string, ChatThreadSummary> {
  const raw = room.getLiveTimeline().getEvents()
  const redactedEventIds = getRedactedEventIds(raw)
  const messageEvents = collectMessageTimelineEvents(raw)
  const relationIndex = buildMessageRelationIndex(messageEvents)
  const byRoot = new Map<
    string,
    { replyCount: number; lastReply?: ChatThreadLastReply }
  >()

  for (const timelineEvent of messageEvents) {
    const eventId = timelineEvent.getId?.() ?? ''
    if (!eventId || relationIndex.supersededMessageIds.has(eventId)) {
      continue
    }
    const rootId = relationIndex.threadRootByMessageId.get(eventId)
    if (!rootId) {
      continue
    }
    const senderUserId = timelineEvent.getSender?.() ?? ''
    const senderMember = room.getMember(senderUserId)
    const senderName = senderMember?.name || senderUserId
    const redactedMessage = isRedactedMessageEvent(
      timelineEvent,
      redactedEventIds,
    )
    const undecryptableMessage =
      !redactedMessage && isUndecryptableEvent(timelineEvent)
    const body = getMessageBody(
      timelineEvent,
      senderName,
      undecryptableMessage,
      {
        redactedMessage,
        deletedMessageText: buildDeletedMessageText(),
      },
    )
    const originServerTs = Number(timelineEvent.getTs?.() ?? 0)
    const previous = byRoot.get(rootId)
    const nextCount = (previous?.replyCount ?? 0) + 1
    const lastReply: ChatThreadLastReply = {
      eventId,
      senderName,
      body,
      originServerTs,
      avatarUrl:
        senderMember && getMemberAvatarUrl
          ? getMemberAvatarUrl(senderMember)
          : undefined,
    }
    const prevLastTs = previous?.lastReply?.originServerTs ?? 0
    const mergedLast =
      originServerTs >= prevLastTs ? lastReply : previous?.lastReply
    byRoot.set(rootId, {
      replyCount: nextCount,
      lastReply: mergedLast,
    })
  }

  const result = new Map<string, ChatThreadSummary>()
  for (const [rootId, aggregate] of byRoot) {
    result.set(rootId, {
      replyCount: aggregate.replyCount,
      lastReply: aggregate.lastReply,
    })
  }
  return result
}
