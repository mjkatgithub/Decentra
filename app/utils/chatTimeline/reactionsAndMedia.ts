import {
  collectMessageContentRecords,
  getInReplyToEventId,
} from '~/utils/matrixThreadRelations'
import type {
  ChatTimelineMedia,
  ChatTimelineReaction,
  ChatTimelineReply,
  ChatTimelineReplyMsgtype,
  GetMessageBodyOptions,
  TimelineEventRecord,
} from './types'

interface ReactionAggregate {
  users: Set<string>
  ownReactionEventIds: Set<string>
}

export function buildReactionSummaryByEventId(
  timelineEvents: TimelineEventRecord[],
  ownUserId: string | undefined,
): Map<string, ChatTimelineReaction[]> {
  const redactedEventIds = getRedactedEventIds(timelineEvents)
  const aggregatesByTargetEventId = new Map<
    string,
    Map<string, ReactionAggregate>
  >()

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

    const byEmoji = getOrCreate(
      aggregatesByTargetEventId,
      reactionData.targetEventId,
      () => {
        return new Map<string, ReactionAggregate>()
      },
    )
    const aggregate = getOrCreate(byEmoji, reactionData.emoji, () => {
      return {
        users: new Set<string>(),
        ownReactionEventIds: new Set<string>(),
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
        ownReactionEventIds: Array.from(aggregate.ownReactionEventIds),
      }))
      .sort((leftReaction, rightReaction) => {
        return (
          rightReaction.count - leftReaction.count ||
          leftReaction.emoji.localeCompare(rightReaction.emoji)
        )
      })
    summaryByEventId.set(targetEventId, reactions)
  }
  return summaryByEventId
}

export function isUndecryptableEvent(
  timelineEvent: Record<string, any>,
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

function readTextBodyFromContentRecord(
  contentRecord: Record<string, unknown>,
): string | undefined {
  const newContent = contentRecord['m.new_content']
  if (newContent && typeof newContent === 'object') {
    const newBody = (newContent as Record<string, unknown>).body
    if (typeof newBody === 'string' && newBody.trim().length > 0) {
      return newBody
    }
  }
  const body = contentRecord.body
  if (typeof body === 'string' && body.trim().length > 0) {
    return body
  }
  return undefined
}

export function getMessageBody(
  timelineEvent: Record<string, any>,
  senderName: string,
  undecryptableMessage: boolean,
  messageBodyOptions?: GetMessageBodyOptions,
): string {
  if (
    messageBodyOptions?.redactedMessage &&
    messageBodyOptions.deletedMessageText
  ) {
    return messageBodyOptions.deletedMessageText
  }
  if (undecryptableMessage) {
    return buildUndecryptableMessageText(senderName)
  }
  for (const contentRecord of collectMessageContentRecords(timelineEvent)) {
    const body = readTextBodyFromContentRecord(contentRecord)
    if (body) {
      return body
    }
  }
  return 'Unsupported message content.'
}

export function buildTimelineMediaFromContent(input: {
  content: Record<string, any>
  body: string
  getMediaUrl: (
    mxcUrl: string,
    mimetype?: string,
    body?: string,
  ) => string | undefined
}): ChatTimelineMedia | undefined {
  const { content, body, getMediaUrl } = input
  const msgtype = content.msgtype
  const mxcUrl = content.url || content.file?.url
  const isEncryptedMedia = Boolean(content.file?.url)
  const mimetype = content.info?.mimetype

  if (msgtype === 'm.image' && mxcUrl) {
    const needsBlobFetch =
      isEncryptedMedia ||
      mimetype === 'image/svg+xml' ||
      mimetype === 'image/gif' ||
      body?.toLowerCase().endsWith('.svg') ||
      body?.toLowerCase().endsWith('.gif')

    return {
      url: needsBlobFetch
        ? ''
        : (getMediaUrl(mxcUrl, mimetype, body) || mxcUrl),
      mxcUrl,
      mimetype,
      isEncrypted: isEncryptedMedia,
      encryptionInfo: isEncryptedMedia ? content.file : undefined,
      info: content.info,
    }
  }

  if (msgtype === 'm.video' && mxcUrl) {
    const thumbUrl =
      content.info?.thumbnail_url || content.info?.thumbnail_file?.url
    const thumbEncrypted = Boolean(content.info?.thumbnail_file?.url)
    const thumbMimetype = content.info?.thumbnail_info?.mimetype
    const thumbNeedsBlob =
      thumbEncrypted ||
      thumbMimetype === 'image/svg+xml' ||
      thumbMimetype === 'image/gif'
    const resolvedThumb =
      thumbUrl && !thumbNeedsBlob
        ? (getMediaUrl(thumbUrl, thumbMimetype, body) || thumbUrl)
        : ''

    return {
      url: resolvedThumb,
      mxcUrl: thumbUrl || mxcUrl,
      mimetype: thumbMimetype || mimetype,
      isEncrypted: thumbEncrypted,
      encryptionInfo: thumbEncrypted
        ? content.info?.thumbnail_file
        : undefined,
      playbackMxcUrl: mxcUrl,
      playbackMimetype: mimetype,
      playbackIsEncrypted: isEncryptedMedia,
      playbackEncryptionInfo: isEncryptedMedia ? content.file : undefined,
      info: {
        ...(content.info?.thumbnail_info ?? {}),
        duration: content.info?.duration,
        w: content.info?.w,
        h: content.info?.h,
        size: content.info?.size,
      },
    }
  }

  if (msgtype === 'm.audio' && mxcUrl) {
    return {
      url: '',
      mxcUrl,
      mimetype,
      isEncrypted: isEncryptedMedia,
      encryptionInfo: isEncryptedMedia ? content.file : undefined,
      info: content.info,
    }
  }

  return undefined
}

function readReplyTargetContent(
  replyTargetEvent: Record<string, any>,
): Record<string, any> | undefined {
  for (const contentRecord of collectMessageContentRecords(replyTargetEvent)) {
    if (contentRecord.msgtype) {
      return contentRecord as Record<string, any>
    }
  }
  return replyTargetEvent.getContent?.() ?? undefined
}

export function buildReplyMetadata(
  content: Record<string, any>,
  room: Record<string, any>,
  timelineEventsById: Map<string, Record<string, any>>,
  redactedEventIds: Set<string>,
  deletedMessageText: string,
  getMediaUrl: (
    mxcUrl: string,
    mimetype?: string,
    body?: string,
  ) => string | undefined,
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
      body: 'Original message unavailable.',
    }
  }

  const replySenderId = replyTargetEvent.getSender?.() ?? ''
  const replySenderMember = room.getMember?.(replySenderId)
  const replySenderName =
    replySenderMember?.name || replySenderId || 'Unknown user'
  const replyRedacted = isRedactedMessageEvent(
    replyTargetEvent,
    redactedEventIds,
  )
  const replyUndecryptable =
    !replyRedacted && isUndecryptableEvent(replyTargetEvent)
  const replyBody = getMessageBody(
    replyTargetEvent,
    replySenderName,
    replyUndecryptable,
    {
      redactedMessage: replyRedacted,
      deletedMessageText,
    },
  )

  if (replyRedacted || replyUndecryptable) {
    return {
      eventId: replyEventId,
      senderName: replySenderName,
      body: replyBody,
    }
  }

  const targetContent = readReplyTargetContent(replyTargetEvent)
  const targetMsgtype = targetContent?.msgtype
  const normalizedMsgtype: ChatTimelineReplyMsgtype | undefined =
    targetMsgtype === 'm.image' || targetMsgtype === 'm.video'
      ? targetMsgtype
      : targetMsgtype === 'm.text' || !targetMsgtype
        ? 'm.text'
        : undefined

  const replyMedia = targetContent
    ? buildTimelineMediaFromContent({
        content: targetContent,
        body: replyBody,
        getMediaUrl,
      })
    : undefined

  return {
    eventId: replyEventId,
    senderName: replySenderName,
    body: replyBody,
    msgtype: normalizedMsgtype ?? (replyMedia ? 'm.image' : 'm.text'),
    media: replyMedia,
  }
}

export function getRedactedEventIds(
  timelineEvents: TimelineEventRecord[],
): Set<string> {
  const redactedEventIds = new Set<string>()
  for (const timelineEvent of timelineEvents) {
    const eventType = timelineEvent.getType?.() ?? ''
    if (eventType !== 'm.room.redaction') {
      continue
    }
    const redactedEventId =
      timelineEvent.getRedacts?.() ??
      timelineEvent.getContent?.()?.redacts ??
      timelineEvent.event?.redacts
    if (typeof redactedEventId === 'string' && redactedEventId.length > 0) {
      redactedEventIds.add(redactedEventId)
    }
  }
  return redactedEventIds
}

export function isRedactedMessageEvent(
  timelineEvent: TimelineEventRecord,
  redactedEventIds: Set<string>,
): boolean {
  const eventId = timelineEvent.getId?.() ?? ''
  if (eventId && redactedEventIds.has(eventId)) {
    return true
  }
  if (timelineEvent.isRedacted?.()) {
    return true
  }
  return false
}

function getReactionData(
  content: Record<string, any>,
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
  create: () => TValue,
): TValue {
  const existingValue = inputMap.get(key)
  if (existingValue !== undefined) {
    return existingValue
  }
  const newValue = create()
  inputMap.set(key, newValue)
  return newValue
}
