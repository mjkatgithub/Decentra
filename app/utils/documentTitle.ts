const UNREAD_PREFIX = /^\(\*\)\s+/
const LEGACY_MENTION_PREFIX = /^\(\d+\s*@\)\s+/
const COMBINED_PREFIX = /^\(\d+\s*·\s*\d+\s*@\)\s+/
const COUNT_PREFIX = /^\(\d+\)\s+/

export function stripDocumentTitlePrefix(
  title: string,
  fallback = 'Decentra',
): string {
  let cleaned = title.trim()
  if (!cleaned) {
    return fallback
  }

  let changed = true
  while (changed) {
    changed = false
    for (const pattern of [
      UNREAD_PREFIX,
      COMBINED_PREFIX,
      LEGACY_MENTION_PREFIX,
      COUNT_PREFIX,
    ]) {
      const next = cleaned.replace(pattern, '')
      if (next !== cleaned) {
        cleaned = next
        changed = true
      }
    }
  }

  const result = cleaned.trim()
  return result || fallback
}

export function buildDocumentTitlePrefix(hasUnread: boolean): string | null {
  return hasUnread ? '(*)' : null
}

export function formatDocumentTitle(
  baseTitle: string,
  hasUnread: boolean,
): string {
  const prefix = buildDocumentTitlePrefix(hasUnread)
  if (!prefix) {
    return baseTitle
  }
  return `${prefix} ${baseTitle}`
}
