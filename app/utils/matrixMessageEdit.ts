/**
 * Outgoing Matrix message edits (m.replace + m.new_content).
 */

const REPLACE_REL_TYPE = 'm.replace'

export function buildReplaceRelatesTo(
  targetEventId: string,
): Record<string, unknown> {
  return {
    rel_type: REPLACE_REL_TYPE,
    event_id: targetEventId,
  }
}

export function buildTextEditContent(
  newBody: string,
  targetEventId: string,
): Record<string, unknown> {
  const trimmedBody = newBody.trim()
  return {
    msgtype: 'm.text',
    body: trimmedBody,
    'm.new_content': {
      msgtype: 'm.text',
      body: trimmedBody,
    },
    'm.relates_to': buildReplaceRelatesTo(targetEventId),
  }
}
