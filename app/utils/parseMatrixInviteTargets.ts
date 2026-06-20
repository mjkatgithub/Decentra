function normalizeInviteUserId(
  input: string,
  homeserverDomain: string,
): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Matrix user id is required')
  }
  const withAt = trimmed.startsWith('@') ? trimmed : `@${trimmed}`
  if (withAt.includes(':')) {
    return withAt
  }
  const domain = homeserverDomain.trim()
  if (!domain) {
    throw new Error('Homeserver domain required')
  }
  return `${withAt}:${domain}`
}

/** Split invite field into Matrix user IDs (comma / newline / space). */
export function parseMatrixInviteTargets(
  raw: string,
  homeserverDomain: string,
): string[] {
  const parts = raw
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const userIds: string[] = []
  for (const part of parts) {
    try {
      const userId = normalizeInviteUserId(part, homeserverDomain)
      const key = userId.toLowerCase()
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      userIds.push(userId)
    } catch {
      continue
    }
  }
  return userIds
}
