/**
 * Shared Matrix error parsing and homeserver URL handling for
 * `useMatrixClient` and `matrixRegistrationUia`.
 */
export interface MatrixApiErrorShape {
  errcode?: string
  error?: string
  session?: string
  completed?: string[]
  flows?: Array<{ stages?: string[] }>
  data?: {
    errcode?: string
    error?: string
    session?: string
    completed?: string[]
    flows?: Array<{ stages?: string[] }>
    params?: Record<string, unknown>
  }
  httpStatus?: number
  statusCode?: number
}

function isPrivateOrLocalIPv4(hostname: string): boolean {
  if (hostname === 'localhost') {
    return true
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(
    hostname
  )
  if (!match) {
    return false
  }
  const octets = [match[1], match[2], match[3], match[4]].map((v) => {
    return Number(v)
  })
  if (octets.some((value) => value > 255)) {
    return false
  }
  const firstOctet = octets[0] ?? 0
  const secondOctet = octets[1] ?? 0
  if (firstOctet === 10) {
    return true
  }
  if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) {
    return true
  }
  if (firstOctet === 192 && secondOctet === 168) {
    return true
  }
  if (firstOctet === 127) {
    return true
  }
  return false
}

function normalizeHomeserver(input: string): string {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  try {
    return new URL(trimmed).origin
  } catch {
    return trimmed.replace(/\/+$/g, '')
  }
}

/**
 * Normalizes homeserver URL for browser requests. Upgrades http→https for
 * public hostnames so CORS preflight is not broken by HTTP→TLS redirects.
 */
export function resolveHomeserverBaseUrlForClient(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    return ''
  }
  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    const hostLower = url.hostname.toLowerCase()
    const keepHttp = (
      url.protocol === 'http:' &&
      (hostLower === 'localhost' || isPrivateOrLocalIPv4(hostLower))
    )
    if (url.protocol === 'http:' && !keepHttp) {
      url.protocol = 'https:'
    }
    return url.origin
  } catch {
    return normalizeHomeserver(trimmed)
  }
}

export function extractUserLocalpart(userIdOrUsername: string): string {
  const normalized = userIdOrUsername.trim().toLowerCase()
  const withoutAtPrefix = normalized.startsWith('@')
    ? normalized.slice(1)
    : normalized
  return withoutAtPrefix.split(':')[0] ?? withoutAtPrefix
}

export function isSameHomeserver(left: string, right: string): boolean {
  return normalizeHomeserver(left) === normalizeHomeserver(right)
}

export function isLikelyBrowserNetworkOrCorsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('network request failed') ||
    message.includes('cors')
  )
}

export function readMatrixErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return ''
  }
  const matrixError = error as MatrixApiErrorShape
  return (
    matrixError.errcode ||
    matrixError.data?.errcode ||
    ''
  )
}

/**
 * Narrow {@link HOMESERVER_CONNECTION_HINT_ERROR} mapping to cases where fetch
 * failed before a usable Matrix JSON body (no {@link readMatrixErrorCode},
 * no HTTP status). Signup PR #60 added broad browser-message matching; without
 * this, legitimate API failures can be mislabeled as “homeserver unreachable”.
 */
export function isTransportFailureWithoutMatrixBody(
  error: unknown
): boolean {
  if (!isLikelyBrowserNetworkOrCorsError(error)) {
    return false
  }
  if (readMatrixErrorCode(error)) {
    return false
  }
  if (!error || typeof error !== 'object') {
    return true
  }
  const shaped = error as MatrixApiErrorShape
  const httpStatus = shaped.httpStatus ?? shaped.statusCode
  return !(
    typeof httpStatus === 'number' &&
    Number.isFinite(httpStatus) &&
    httpStatus > 0
  )
}

export function readMatrixErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  if (!error || typeof error !== 'object') {
    return ''
  }
  const matrixError = error as MatrixApiErrorShape
  return (
    matrixError.error ||
    matrixError.data?.error ||
    ''
  )
}

/**
 * Homeserver refuses open registration via POST /register (Synapse/matrix.org).
 * Separate from flows Decentra can complete via UIA when a session exists.
 */
export function isPublicRegisterEndpointDisabled(error: unknown): boolean {
  const raw = readMatrixErrorMessage(error)
  const normalized = raw.toLowerCase()
  return (
    normalized.includes('registration has been disabled') ||
    normalized.includes('registration is disabled') ||
    (
      normalized.includes('application_service') &&
      normalized.includes('registrations are allowed')
    )
  )
}

export function isSignupUnsupported(error: unknown): boolean {
  const matrixErrorCode = readMatrixErrorCode(error)
  if (
    matrixErrorCode === 'M_UNRECOGNIZED' ||
    matrixErrorCode === 'M_UNSUPPORTED' ||
    matrixErrorCode === 'M_FORBIDDEN'
  ) {
    return true
  }
  const matrixErrorMessage = readMatrixErrorMessage(error).toLowerCase()
  return (
    matrixErrorMessage.includes('registration has been disabled') ||
    matrixErrorMessage.includes('registration is disabled') ||
    matrixErrorMessage.includes('registration not supported') ||
    matrixErrorMessage.includes('registration is not available')
  )
}

export function supportsEmailVerificationStage(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const matrixError = error as MatrixApiErrorShape
  const flows = matrixError.flows || matrixError.data?.flows || []
  return flows.some((flow) => {
    const stages = flow.stages || []
    return stages.includes('m.login.email.identity')
  })
}

/** Distinguish from CORS/URL misconfiguration. */
export const HOMESERVER_CONNECTION_HINT_ERROR = 'HOMESERVER_CONNECTION_HINT'
