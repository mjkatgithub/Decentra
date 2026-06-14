/**
 * E2E credential helpers — Matrix login uses localpart; mentions need MXID.
 */

/** @param {string} userIdOrUsername */
export function extractE2ELocalpart(userIdOrUsername) {
  const trimmed = userIdOrUsername.trim()
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
  return withoutAt.split(':')[0] ?? withoutAt
}

/** Login form + m.id.user identifier (localpart). */
export function resolveE2ELoginUsername() {
  const raw =
    process.env.E2E_MATRIX_LOGIN_USERNAME ||
    process.env.E2E_MATRIX_USERNAME ||
    ''
  if (!raw) {
    return ''
  }
  return extractE2ELocalpart(raw)
}

/** Full Matrix user id for mentions / account_data. */
export function resolveE2EMatrixUserId() {
  return (
    process.env.E2E_MATRIX_USER_ID ||
    process.env.E2E_MATRIX_USERNAME ||
    ''
  )
}

/** @param {'primary' | 'secondary'} which */
export function resolveE2ESecondaryMatrixUserId() {
  return (
    process.env.E2E_SECOND_MATRIX_USER_ID ||
    process.env.E2E_SECOND_MATRIX_USERNAME ||
    ''
  )
}
