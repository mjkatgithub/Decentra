import {
  getInReplyToEventId,
  readMessageRelationSnapshot,
} from '~/utils/matrixThreadRelations'

export interface ChatTimelineMedia {
  url: string
  mxcUrl: string
  mimetype?: string
  isEncrypted?: boolean
  encryptionInfo?: Record<string, any>
  info?: {
    w?: number
    h?: number
    size?: number
  }
}

export interface ChatThreadLastReply {
  eventId: string
  senderName: string
  body: string
  originServerTs: number
  avatarUrl?: string
}

export interface ChatThreadSummary {
  replyCount: number
  lastReply?: ChatThreadLastReply
}

export interface ChatTimelineMessage {
  id: string
  kind: 'message' | 'notice'
  isDecryptionError?: boolean
  senderId: string
  senderName: string
  avatarUrl?: string
  body: string
  replyTo?: ChatTimelineReply
  media?: ChatTimelineMedia
  reactions: ChatTimelineReaction[]
  readBy: Array<{
    userId: string
    displayName: string
    avatarUrl?: string
  }>
  /** Present on root messages that have thread replies (MSC3440) */
  threadSummary?: ChatThreadSummary
  isEdited?: boolean
}

export interface ChatTimelineReaction {
  emoji: string
  count: number
  hasOwnReaction: boolean
  ownReactionEventIds: string[]
}

export interface ChatTimelineReply {
  eventId: string
  senderName: string
  body: string
}

export interface TimelineWindowOptions {
  windowSize: number
  anchorEventId?: string
}

export interface TimelineWindowSelection {
  startIndex: number
  endIndex: number
  anchorIndex: number | null
  anchorFound: boolean
}

interface MapTimelineArgs {
  room: Record<string, any>
  ownUserId: string | undefined
  getMemberAvatarUrl: (member: Record<string, any>) => string | undefined
  getMediaUrl: (mxcUrl: string, mimetype?: string, body?: string) => string | undefined
  buildNoticeText: (
    timelineEvent: Record<string, any>,
    room: Record<string, any>
  ) => string
}

export type TimelineMappingMode =
  | { kind: 'main' }
  | { kind: 'thread'; rootEventId: string }

function eventTypesForChatTimeline(): Set<string> {
  return new Set([
    'm.room.message',
    'm.room.encrypted',
    'm.room.member',
    'm.room.name',
    'm.room.avatar',
    'm.room.topic',
  ])
}

function filterTimelineEventsByType(
  rawEvents: Record<string, any>[],
): Record<string, any>[] {
  const allowed = eventTypesForChatTimeline()
  return rawEvents.filter((timelineEvent) => {
    const eventType = timelineEvent.getType?.() ?? ''
    return allowed.has(eventType)
  })
}

type TimelineEventRecord = Record<string, any>

interface MessageRelationIndex {
  threadRootByMessageId: Map<string, string>
  supersededMessageIds: Set<string>
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

function collectMessageTimelineEvents(
  rawEvents: TimelineEventRecord[],
): TimelineEventRecord[] {
  return rawEvents.filter((timelineEvent) => {
    const eventType = timelineEvent.getType?.() ?? ''
    return eventType === 'm.room.message' && !isUndecryptableEvent(timelineEvent)
  })
}

function buildMessageRelationIndex(
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

  return { threadRootByMessageId, supersededMessageIds }
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

function shouldIncludeMessageInThreadView(
  timelineEvent: TimelineEventRecord,
  rootEventId: string,
  relationIndex: MessageRelationIndex,
): boolean {
  const eventType = timelineEvent.getType?.() ?? ''
  const eventId = timelineEvent.getId?.() ?? ''
  if (eventId && relationIndex.supersededMessageIds.has(eventId)) {
    return false
  }
  if (eventId === rootEventId) {
    return true
  }
  if (eventType !== 'm.room.message') {
    return false
  }
  if (isUndecryptableEvent(timelineEvent)) {
    return false
  }
  if (relationIndex.threadRootByMessageId.get(eventId) === rootEventId) {
    return true
  }
  const snapshot = readMessageRelationSnapshot(timelineEvent)
  return snapshot.threadRootId === rootEventId
}

/**
 * Aggregates thread reply counts and last reply per root (MSC3440).
 */
export function buildThreadSummariesByRoot(
  room: Record<string, any>,
  getMemberAvatarUrl?: (
    member: Record<string, any>,
  ) => string | undefined,
): Map<string, ChatThreadSummary> {
  const raw = room.getLiveTimeline().getEvents()
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
    const body = getMessageBody(
      timelineEvent,
      senderName,
      false,
    )
    const originServerTs = Number(timelineEvent.getTs?.() ?? 0)
    const previous = byRoot.get(rootId)
    const nextCount = (previous?.replyCount ?? 0) + 1
    const lastReply: ChatThreadLastReply = {
      eventId,
      senderName,
      body,
      originServerTs,
      avatarUrl: senderMember && getMemberAvatarUrl
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

export function mapTimelineEventsToMessages({
  room,
  ownUserId,
  getMemberAvatarUrl,
  getMediaUrl,
  buildNoticeText,
  mode = { kind: 'main' } as TimelineMappingMode,
}: MapTimelineArgs & { mode?: TimelineMappingMode }): ChatTimelineMessage[] {
  const allTimelineEvents = room.getLiveTimeline().getEvents()
  const messageEvents = collectMessageTimelineEvents(allTimelineEvents)
  const relationIndex = buildMessageRelationIndex(messageEvents)
  const reactionSummaryByEventId = buildReactionSummaryByEventId(
    allTimelineEvents,
    ownUserId,
  )
  const threadSummariesByRoot =
    mode.kind === 'main'
      ? buildThreadSummariesByRoot(room, getMemberAvatarUrl)
      : null
  const threadRootEventId =
    mode.kind === 'thread' ? mode.rootEventId : undefined

  const typedTimelineEvents = filterTimelineEventsByType(
    room.getLiveTimeline().getEvents(),
  )

  const timelineEvents =
    mode.kind === 'main'
      ? typedTimelineEvents.filter((timelineEvent) => {
          return shouldIncludeMessageInMainTimeline(
            timelineEvent,
            relationIndex,
          )
        })
      : typedTimelineEvents.filter((timelineEvent) => {
          return shouldIncludeMessageInThreadView(
            timelineEvent,
            mode.rootEventId,
            relationIndex,
          )
        })

  const timelineEventsById = new Map<string, Record<string, any>>()
  for (const timelineEvent of typedTimelineEvents) {
    const timelineEventId = timelineEvent.getId?.()
    if (timelineEventId) {
      timelineEventsById.set(timelineEventId, timelineEvent)
    }
  }
  const visibleMessageEvents = timelineEvents.filter(
    (timelineEvent: Record<string, any>) => {
      return (
        (timelineEvent.getType?.() ?? '') === 'm.room.message' &&
        !isUndecryptableEvent(timelineEvent)
      )
    }
  )
  const roomMembers = room.getMembers()
  const latestReadEventIdByUser = new Map<string, string>()

  for (const member of roomMembers) {
    if (member.userId === ownUserId) {
      continue
    }
    for (
      let messageIndex = visibleMessageEvents.length - 1;
      messageIndex >= 0;
      messageIndex--
    ) {
      const messageEvent = visibleMessageEvents[messageIndex]
      if (!messageEvent) {
        continue
      }
      const messageEventId = messageEvent.getId()
      if (!messageEventId) {
        continue
      }
      if (room.hasUserReadEvent(member.userId, messageEventId)) {
        latestReadEventIdByUser.set(member.userId, messageEventId)
        break
      }
    }
  }

  const mappedMessages = timelineEvents.map((timelineEvent: Record<string, any>) => {
    try {
      const eventType = timelineEvent.getType?.() ?? ''
      const senderUserId = timelineEvent.getSender?.() ?? ''
      const senderMember = room.getMember(senderUserId)
      const senderName = senderMember?.name || senderUserId
      const currentEventId = timelineEvent.getId?.() ?? ''
      const undecryptableMessage = isUndecryptableEvent(timelineEvent)
      const isMessageEvent = eventType === 'm.room.message' || undecryptableMessage
      const body = isMessageEvent
        ? getMessageBody(timelineEvent, senderName, undecryptableMessage)
        : buildNoticeText(timelineEvent, room)

      const readBy = eventType === 'm.room.message' &&
        !undecryptableMessage &&
        currentEventId
        ? roomMembers
          .filter((member: Record<string, any>) => member.userId !== senderUserId)
          .filter((member: Record<string, any>) => member.userId !== ownUserId)
          .filter((member: Record<string, any>) => {
            return latestReadEventIdByUser.get(member.userId) === currentEventId
          })
          .filter((member: Record<string, any>) => {
            return room.hasUserReadEvent(member.userId, currentEventId)
          })
          .map((member: Record<string, any>) => ({
            userId: member.userId,
            displayName: member.name || member.userId,
            avatarUrl: getMemberAvatarUrl(member)
          }))
        : []

      const content = timelineEvent.getContent() ?? {}
      const relationSnapshot = eventType === 'm.room.message'
        ? readMessageRelationSnapshot(timelineEvent)
        : undefined
      const reactions = eventType === 'm.room.message' && currentEventId
        ? reactionSummaryByEventId.get(currentEventId) ?? []
        : []
      const mxcUrl = content.url || content.file?.url
      const isEncryptedMedia = Boolean(content.file?.url)
      const mimetype = content.info?.mimetype
      let media: ChatTimelineMedia | undefined
      const replyTo = eventType === 'm.room.message' && !undecryptableMessage
        ? buildReplyMetadata(
            content,
            room,
            timelineEventsById,
            threadRootEventId,
          )
        : undefined

      if (eventType === 'm.room.message' && content.msgtype === 'm.image' && mxcUrl) {
        const needsBlobFetch = isEncryptedMedia ||
          mimetype === 'image/svg+xml' ||
          mimetype === 'image/gif' ||
          body?.toLowerCase().endsWith('.svg') ||
          body?.toLowerCase().endsWith('.gif')

        media = {
          url: needsBlobFetch ? '' : (getMediaUrl(mxcUrl, mimetype, body) || mxcUrl),
          mxcUrl,
          mimetype,
          isEncrypted: isEncryptedMedia,
          encryptionInfo: isEncryptedMedia ? content.file : undefined,
          info: content.info
        }
      }

      return {
        id: currentEventId,
        kind: eventType === 'm.room.message' && !undecryptableMessage
          ? 'message'
          : 'notice',
        isDecryptionError: undecryptableMessage,
        senderId: senderUserId,
        senderName,
        avatarUrl: senderMember ? getMemberAvatarUrl(senderMember) : undefined,
        body,
        replyTo,
        media,
        reactions,
        readBy,
        isEdited: relationSnapshot?.isReplacement === true,
      }
    } catch {
      const senderUserId = timelineEvent.getSender?.() ?? ''
      const senderMember = room.getMember(senderUserId)
      const senderName = senderMember?.name || senderUserId
      return {
        id: timelineEvent.getId?.() ?? `${timelineEvent.getTs?.() ?? Date.now()}`,
        kind: 'notice',
        isDecryptionError: true,
        senderId: senderUserId,
        senderName,
        avatarUrl: senderMember ? getMemberAvatarUrl(senderMember) : undefined,
        body: buildUndecryptableMessageText(senderName),
        reactions: [],
        readBy: []
      }
    }
  })

  if (mode.kind !== 'main' || !threadSummariesByRoot) {
    return mappedMessages
  }

  return mappedMessages.map((msg) => {
    if (msg.kind !== 'message') {
      return msg
    }
    const summary = threadSummariesByRoot.get(msg.id)
    if (!summary) {
      return msg
    }
    return { ...msg, threadSummary: summary }
  })
}

export interface ThreadNavEntry {
  rootEventId: string
  title: string
  replyCount: number
  lastActivityTs: number
}

export const DEFAULT_THREAD_SIDEBAR_MAX_AGE_DAYS = 2

export interface BuildRoomThreadNavOptions {
  maxAgeDays?: number
  nowMs?: number
}

function threadTitleFromRootEvent(rootEvent: Record<string, any> | undefined): string {
  if (!rootEvent) {
    return 'Thread'
  }
  const senderUserId = rootEvent.getSender?.() ?? ''
  const undecryptableMessage = isUndecryptableEvent(rootEvent)
  const body = getMessageBody(rootEvent, senderUserId, undecryptableMessage)
  const firstLine = body.split('\n')[0]?.trim() ?? ''
  const clipped = firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine
  return clipped || 'Thread'
}

/**
 * Threads with at least one reply, for channel sidebar (newest activity first).
 */
export function buildRoomThreadNavEntries(
  room: Record<string, any>,
  options?: BuildRoomThreadNavOptions,
): ThreadNavEntry[] {
  const summaries = buildThreadSummariesByRoot(room)
  const typed = filterTimelineEventsByType(room.getLiveTimeline().getEvents())
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
      title: threadTitleFromRootEvent(rootEvent),
      replyCount: summary.replyCount,
      lastActivityTs: lastTs,
    })
  }

  entries.sort((entryA, entryB) => {
    return entryB.lastActivityTs - entryA.lastActivityTs
  })

  const maxAgeDays =
    options?.maxAgeDays ?? DEFAULT_THREAD_SIDEBAR_MAX_AGE_DAYS
  const nowMs = options?.nowMs ?? Date.now()
  const cutoffTs = nowMs - maxAgeDays * 24 * 60 * 60 * 1000
  return entries.filter((entry) => entry.lastActivityTs >= cutoffTs)
}

export function resolveTimelineWindowSelection(
  eventIds: string[],
  options: TimelineWindowOptions
): TimelineWindowSelection {
  const totalEvents = eventIds.length
  if (totalEvents === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      anchorIndex: null,
      anchorFound: false
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
      anchorFound: false
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
    anchorFound: true
  }
}

interface ReactionAggregate {
  users: Set<string>
  ownReactionEventIds: Set<string>
}

export function buildReactionSummaryByEventId(
  timelineEvents: TimelineEventRecord[],
  ownUserId: string | undefined
): Map<string, ChatTimelineReaction[]> {
  const redactedEventIds = getRedactedEventIds(timelineEvents)
  const aggregatesByTargetEventId = new Map<string, Map<string, ReactionAggregate>>()

  for (const timelineEvent of timelineEvents) {
    const eventType = timelineEvent.getType?.() ?? ''
    if (eventType !== 'm.reaction') {
      continue
    }
    const reactionEventId = timelineEvent.getId?.()
    if (!reactionEventId || redactedEventIds.has(reactionEventId)) {
      continue
    }
    const reactionData = getReactionData(timelineEvent.getContent?.() ?? {})
    if (!reactionData) {
      continue
    }
    const senderUserId = timelineEvent.getSender?.() ?? ''
    if (!senderUserId) {
      continue
    }

    const byEmoji = getOrCreate(aggregatesByTargetEventId, reactionData.targetEventId, () => {
      return new Map<string, ReactionAggregate>()
    })
    const aggregate = getOrCreate(byEmoji, reactionData.emoji, () => {
      return {
        users: new Set<string>(),
        ownReactionEventIds: new Set<string>()
      }
    })
    aggregate.users.add(senderUserId)
    if (ownUserId && senderUserId === ownUserId) {
      aggregate.ownReactionEventIds.add(reactionEventId)
    }
  }

  const summaryByEventId = new Map<string, ChatTimelineReaction[]>()
  for (const [targetEventId, byEmoji] of aggregatesByTargetEventId) {
    const reactions = Array.from(byEmoji.entries())
      .map(([emoji, aggregate]) => ({
        emoji,
        count: aggregate.users.size,
        hasOwnReaction: aggregate.ownReactionEventIds.size > 0,
        ownReactionEventIds: Array.from(aggregate.ownReactionEventIds)
      }))
      .sort((leftReaction, rightReaction) => {
        return rightReaction.count - leftReaction.count ||
          leftReaction.emoji.localeCompare(rightReaction.emoji)
      })
    summaryByEventId.set(targetEventId, reactions)
  }
  return summaryByEventId
}

export function isUndecryptableEvent(
  timelineEvent: Record<string, any>
): boolean {
  if (timelineEvent.isDecryptionFailure?.()) {
    return true
  }
  const eventType = timelineEvent.getType?.() ?? ''
  return eventType === 'm.room.encrypted'
}

export function buildUndecryptableMessageText(senderName: string): string {
  return `${senderName} sent an encrypted message that could not be decrypted.`
}

export function getMessageBody(
  timelineEvent: Record<string, any>,
  senderName: string,
  undecryptableMessage: boolean
): string {
  if (undecryptableMessage) {
    return buildUndecryptableMessageText(senderName)
  }
  const content = timelineEvent.getContent?.() ?? {}
  const body = content.body
  if (typeof body === 'string' && body.trim().length > 0) {
    return body
  }
  return 'Unsupported message content.'
}

function buildReplyMetadata(
  content: Record<string, any>,
  room: Record<string, any>,
  timelineEventsById: Map<string, Record<string, any>>,
  threadRootEventId?: string,
): ChatTimelineReply | undefined {
  const replyEventId = getInReplyToEventId(
    content as Record<string, unknown>,
  )
  if (!replyEventId) {
    return undefined
  }

  if (threadRootEventId) {
    if (replyEventId === threadRootEventId) {
      return undefined
    }
    const relatesTo = content['m.relates_to']
    if (
      relatesTo &&
      typeof relatesTo === 'object' &&
      relatesTo.is_falling_back === true
    ) {
      return undefined
    }
  }

  const replyTargetEvent = timelineEventsById.get(replyEventId)
  if (!replyTargetEvent) {
    return {
      eventId: replyEventId,
      senderName: 'Unknown user',
      body: 'Original message unavailable.'
    }
  }

  const replySenderId = replyTargetEvent.getSender?.() ?? ''
  const replySenderMember = room.getMember?.(replySenderId)
  const replySenderName = replySenderMember?.name || replySenderId || 'Unknown user'
  const replyUndecryptable = isUndecryptableEvent(replyTargetEvent)

  return {
    eventId: replyEventId,
    senderName: replySenderName,
    body: getMessageBody(replyTargetEvent, replySenderName, replyUndecryptable)
  }
}

function getRedactedEventIds(timelineEvents: TimelineEventRecord[]): Set<string> {
  const redactedEventIds = new Set<string>()
  for (const timelineEvent of timelineEvents) {
    const eventType = timelineEvent.getType?.() ?? ''
    if (eventType !== 'm.room.redaction') {
      continue
    }
    const redactedEventId = timelineEvent.getRedacts?.() ??
      timelineEvent.getContent?.()?.redacts ??
      timelineEvent.event?.redacts
    if (typeof redactedEventId === 'string' && redactedEventId.length > 0) {
      redactedEventIds.add(redactedEventId)
    }
  }
  return redactedEventIds
}

function getReactionData(
  content: Record<string, any>
): { targetEventId: string; emoji: string } | undefined {
  const relatesTo = content['m.relates_to']
  if (!relatesTo || typeof relatesTo !== 'object') {
    return undefined
  }
  const relationType = relatesTo.rel_type
  const targetEventId = relatesTo.event_id
  const emoji = relatesTo.key
  if (relationType !== 'm.annotation') {
    return undefined
  }
  if (typeof targetEventId !== 'string' || targetEventId.length === 0) {
    return undefined
  }
  if (typeof emoji !== 'string' || emoji.length === 0) {
    return undefined
  }
  return { targetEventId, emoji }
}

function getOrCreate<TKey, TValue>(
  inputMap: Map<TKey, TValue>,
  key: TKey,
  create: () => TValue
): TValue {
  const existingValue = inputMap.get(key)
  if (existingValue !== undefined) {
    return existingValue
  }
  const newValue = create()
  inputMap.set(key, newValue)
  return newValue
}
