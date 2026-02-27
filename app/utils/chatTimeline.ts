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

export function mapTimelineEventsToMessages({
  room,
  ownUserId,
  getMemberAvatarUrl,
  getMediaUrl,
  buildNoticeText
}: MapTimelineArgs): ChatTimelineMessage[] {
  const allTimelineEvents = room.getLiveTimeline().getEvents()
  const reactionSummaryByEventId = buildReactionSummaryByEventId(
    allTimelineEvents,
    ownUserId
  )
  const timelineEvents = room
    .getLiveTimeline()
    .getEvents()
    .filter((timelineEvent: Record<string, any>) => {
      const eventType = timelineEvent.getType?.() ?? ''
      return (
        eventType === 'm.room.message' ||
        eventType === 'm.room.encrypted' ||
        eventType === 'm.room.member' ||
        eventType === 'm.room.name' ||
        eventType === 'm.room.avatar' ||
        eventType === 'm.room.topic'
      )
    })
  const timelineEventsById = new Map<string, Record<string, any>>()
  for (const timelineEvent of timelineEvents) {
    const timelineEventId = timelineEvent.getId?.()
    if (timelineEventId) {
      timelineEventsById.set(timelineEventId, timelineEvent)
    }
  }
  const messageEvents = timelineEvents.filter(
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
    for (let messageIndex = messageEvents.length - 1; messageIndex >= 0; messageIndex--) {
      const messageEvent = messageEvents[messageIndex]
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

  return timelineEvents.map((timelineEvent: Record<string, any>) => {
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
      const reactions = eventType === 'm.room.message' && currentEventId
        ? reactionSummaryByEventId.get(currentEventId) ?? []
        : []
      const mxcUrl = content.url || content.file?.url
      const isEncryptedMedia = Boolean(content.file?.url)
      const mimetype = content.info?.mimetype
      let media: ChatTimelineMedia | undefined
      const replyTo = eventType === 'm.room.message' && !undecryptableMessage
        ? buildReplyMetadata(content, room, timelineEventsById)
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
        readBy
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
}

type TimelineEventRecord = Record<string, any>

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
  timelineEventsById: Map<string, Record<string, any>>
): ChatTimelineReply | undefined {
  const replyEventId = getReplyEventId(content)
  if (!replyEventId) {
    return undefined
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

function getReplyEventId(content: Record<string, any>): string | undefined {
  const relatesTo = content['m.relates_to']
  if (!relatesTo || typeof relatesTo !== 'object') {
    return undefined
  }
  const inReplyTo = relatesTo['m.in_reply_to']
  if (!inReplyTo || typeof inReplyTo !== 'object') {
    return undefined
  }
  const replyEventId = inReplyTo.event_id
  return typeof replyEventId === 'string' && replyEventId.length > 0
    ? replyEventId
    : undefined
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
