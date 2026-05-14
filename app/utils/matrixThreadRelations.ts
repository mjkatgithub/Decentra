/**
 * MSC3440 thread relations on m.room.message content.
 */

const THREAD_REL_TYPE = 'm.thread'
const MSC_THREAD_REL_TYPE = 'org.matrix.msc3440.thread'
const REPLACE_REL_TYPE = 'm.replace'
const MSC_REPLACE_REL_TYPE = 'org.matrix.msc2651.replace'

type TimelineEventRecord = Record<string, any>

function readEventIdField(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined
  }
  return value
}

function readRelatesTo(
  content: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!content || typeof content !== 'object') {
    return undefined
  }
  const relatesTo = content['m.relates_to']
  if (!relatesTo || typeof relatesTo !== 'object') {
    return undefined
  }
  return relatesTo as Record<string, unknown>
}

function readInReplyToFromRelatesTo(
  relatesTo: Record<string, unknown>,
): string | undefined {
  const inReplyTo = relatesTo['m.in_reply_to']
  if (!inReplyTo || typeof inReplyTo !== 'object') {
    return undefined
  }
  return readEventIdField(
    (inReplyTo as Record<string, unknown>).event_id,
  )
}

export function collectMessageContentRecords(
  timelineEvent: TimelineEventRecord,
): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = []
  const seen = new Set<object>()

  const pushRecord = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') {
      return
    }
    if (seen.has(candidate)) {
      return
    }
    seen.add(candidate)
    records.push(candidate as Record<string, unknown>)
  }

  pushRecord(timelineEvent.getContent?.())
  pushRecord(timelineEvent.getClearContent?.())
  pushRecord(timelineEvent.getWireContent?.())
  return records
}

export function getInReplyToEventId(
  content: Record<string, unknown> | undefined,
): string | undefined {
  if (!content || typeof content !== 'object') {
    return undefined
  }

  const relatesTo = readRelatesTo(content)
  if (relatesTo) {
    const replyEventId = readInReplyToFromRelatesTo(relatesTo)
    if (replyEventId) {
      return replyEventId
    }
  }

  const topLevelInReplyTo = content['m.in_reply_to']
  if (!topLevelInReplyTo || typeof topLevelInReplyTo !== 'object') {
    return undefined
  }
  return readEventIdField(
    (topLevelInReplyTo as Record<string, unknown>).event_id,
  )
}

export function getReplaceTargetEventId(
  content: Record<string, unknown> | undefined,
): string | undefined {
  const relatesTo = readRelatesTo(content)
  if (!relatesTo) {
    return undefined
  }
  const relationType = relatesTo.rel_type
  if (
    relationType !== REPLACE_REL_TYPE &&
    relationType !== MSC_REPLACE_REL_TYPE
  ) {
    return undefined
  }
  return readEventIdField(relatesTo.event_id)
}

export function getThreadRootEventId(
  content: Record<string, unknown> | undefined,
): string | undefined {
  const relatesTo = readRelatesTo(content)
  if (!relatesTo) {
    return undefined
  }
  const relationType = relatesTo.rel_type
  if (
    relationType !== THREAD_REL_TYPE &&
    relationType !== MSC_THREAD_REL_TYPE
  ) {
    return undefined
  }
  return readEventIdField(relatesTo.event_id)
}

export function isEditedMessageContent(
  content: Record<string, unknown> | undefined,
): boolean {
  return Boolean(getReplaceTargetEventId(content))
}

export interface MessageRelationSnapshot {
  threadRootId?: string
  replaceTargetId?: string
  inReplyToId?: string
  isReplacement: boolean
}

export function readMessageRelationSnapshot(
  timelineEvent: TimelineEventRecord,
): MessageRelationSnapshot {
  let threadRootId: string | undefined
  let replaceTargetId: string | undefined
  let inReplyToId: string | undefined

  for (const contentRecord of collectMessageContentRecords(timelineEvent)) {
    threadRootId ??= getThreadRootEventId(contentRecord)
    replaceTargetId ??= getReplaceTargetEventId(contentRecord)
    inReplyToId ??= getInReplyToEventId(contentRecord)
  }

  const relation = timelineEvent.getRelation?.()
  if (relation && typeof relation === 'object') {
    const relationRecord = relation as Record<string, unknown>
    const relationType = relationRecord.rel_type
    const relationEventId = readEventIdField(relationRecord.event_id)
    if (
      !threadRootId &&
      relationEventId &&
      (
        relationType === THREAD_REL_TYPE ||
        relationType === MSC_THREAD_REL_TYPE
      )
    ) {
      threadRootId = relationEventId
    }
    if (
      !replaceTargetId &&
      relationEventId &&
      (
        relationType === REPLACE_REL_TYPE ||
        relationType === MSC_REPLACE_REL_TYPE
      )
    ) {
      replaceTargetId = relationEventId
    }
  }

  return {
    threadRootId,
    replaceTargetId,
    inReplyToId,
    isReplacement: Boolean(replaceTargetId),
  }
}

export function isThreadReplyContent(
  content: Record<string, unknown> | undefined,
): boolean {
  return Boolean(getThreadRootEventId(content))
}

/**
 * Build m.relates_to for a message inside a thread (MSC3440).
 */
export function buildThreadRelatesTo(options: {
  threadRootEventId: string
  inReplyToEventId?: string
}): Record<string, unknown> {
  const relatesTo: Record<string, unknown> = {
    rel_type: THREAD_REL_TYPE,
    event_id: options.threadRootEventId,
  }
  if (options.inReplyToEventId) {
    relatesTo['m.in_reply_to'] = {
      event_id: options.inReplyToEventId,
    }
  }
  return relatesTo
}
