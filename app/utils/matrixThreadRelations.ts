/**
 * MSC3440 thread relations on m.room.message content.
 */

const THREAD_REL_TYPE = 'm.thread'

export function getThreadRootEventId(
  content: Record<string, unknown> | undefined,
): string | undefined {
  if (!content || typeof content !== 'object') {
    return undefined
  }
  const relatesTo = content['m.relates_to']
  if (!relatesTo || typeof relatesTo !== 'object') {
    return undefined
  }
  const relationRecord = relatesTo as Record<string, unknown>
  if (relationRecord.rel_type !== THREAD_REL_TYPE) {
    return undefined
  }
  const rootId = relationRecord.event_id
  return typeof rootId === 'string' && rootId.length > 0
    ? rootId
    : undefined
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
