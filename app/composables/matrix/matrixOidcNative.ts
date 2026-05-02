/**
 * Native Matrix delegated auth (MAS / MSC2965 OAuth2 + PKCE) for homeservers like
 * matrix.org where POST /register is closed but OIDC is advertised in
 * .well-known/matrix/client.
 */

export const MATRIX_DELEGATED_OIDC_CALLBACK_RELATIVE_PATH =
  '/auth/matrix-oidc/callback'

export const MATRIX_OIDC_STATE_STORAGE_PREFIX = 'decentra.matrix.oidc.state:'
export const MATRIX_OIDC_DYNAMIC_CLIENT_STORAGE_KEY =
  'decentra.matrix.oidc.dynamicClient.v1'

export const MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR =
  'MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED'
export const MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR =
  'MATRIX_OIDC_NO_DELEGATED_AUTH'
export const MATRIX_OIDC_REGISTRATION_REJECTED_ERROR =
  'MATRIX_OIDC_REGISTRATION_REJECTED'
export const MATRIX_OIDC_INVALID_CALLBACK_ERROR =
  'MATRIX_OIDC_INVALID_CALLBACK'

const MSC2965_KEY = 'org.matrix.msc2965.authentication'

const MSC2967_API_SCOPE =
  'urn:matrix:org.matrix.msc2967.client:api:*'

export type MatrixOidcIntent = 'login' | 'signup'

/** Homeserver /.well-known/matrix/client subset we need. */
export type MatrixDelegatedClientHints = {
  matrixClientApiBaseUrl: string
  oidcIssuerNormalized: string
}

export type StoredDynamicOidcClients = Record<
  string,
  { client_id: string; origin: string }
>

export type PendingOidcState = {
  v: 1
  codeVerifier: string
  nonce: string
  redirectUri: string
  matrixClientApiBaseUrl: string
  oidcIssuer: string
  tokenEndpoint: string
  registrationEndpoint: string
  oidcDeviceId: string
  oauthClientId: string
}

export type NativeOidcTokens = {
  accessToken: string
  refreshToken: string | null
  expiresInSeconds: number | null
}

function normalizeIssuerUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    return ''
  }
  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    return url.origin + '/'
  } catch {
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
  }
}

function randomUrlSafeString(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  let text = ''
  for (let index = 0; index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[index] ?? 0)
  }
  return btoa(text)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function sha256Base64Url(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0)
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function normalizeMatrixDeviceId(candidate: string): string {
  const cleaned = candidate.replace(/[^a-zA-Z0-9-]/g, '')
  if (cleaned.length >= 10) {
    return cleaned.slice(0, 32)
  }
  const padded = `${cleaned}DECENTRAOIDC`
    .replace(/[^a-zA-Z0-9-]/g, '')
  return padded.slice(0, 22)
}

export function generateMatrixOidcDeviceId(): string {
  const raw = randomUrlSafeString(16).replace(/[^a-zA-Z0-9-]/g, '')
  return normalizeMatrixDeviceId(raw)
}

export async function fetchMatrixDelegatedClientHints(
  homeserverUserInputOrigin: string
): Promise<MatrixDelegatedClientHints> {
  const trimmed = homeserverUserInputOrigin.trim()
  if (!trimmed) {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  const probeUrl = trimmed.includes('://')
    ? trimmed
    : `https://${trimmed}`
  let delegateOrigin: string
  try {
    delegateOrigin = new URL(probeUrl).origin
  } catch {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  const resolved = `${delegateOrigin}/.well-known/matrix/client`
  let response: Response
  try {
    response = await fetch(resolved)
  } catch {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  if (!response.ok) {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  if (!body || typeof body !== 'object') {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  const record = body as Record<string, unknown>
  const homeserverBlock = record['m.homeserver']
  if (!homeserverBlock || typeof homeserverBlock !== 'object') {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  const baseUrlRaw = (homeserverBlock as { base_url?: unknown }).base_url
  if (typeof baseUrlRaw !== 'string' || !baseUrlRaw.trim()) {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  let matrixClientApiBaseUrl: string
  try {
    matrixClientApiBaseUrl = new URL(baseUrlRaw.trim()).origin
  } catch {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  const authBlock = record[MSC2965_KEY]
  if (!authBlock || typeof authBlock !== 'object') {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  const issuerRaw = (authBlock as { issuer?: unknown }).issuer
  if (typeof issuerRaw !== 'string' || !issuerRaw.trim()) {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  return {
    matrixClientApiBaseUrl,
    oidcIssuerNormalized: normalizeIssuerUrl(issuerRaw.trim())
  }
}

export type OpenIdIssuerMetadata = {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
}

export async function fetchOpenIdIssuerMetadata(
  issuerUrl: string
): Promise<OpenIdIssuerMetadata> {
  const normalized = normalizeIssuerUrl(issuerUrl)
  const docUrl = `${normalized}.well-known/openid-configuration`
  const response = await fetch(docUrl)
  if (!response.ok) {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  const record = (await response.json()) as Record<string, unknown>
  const authorization = record.authorization_endpoint
  const token = record.token_endpoint
  if (typeof authorization !== 'string' || typeof token !== 'string') {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  const registration = record.registration_endpoint
  return {
    issuer: typeof record.issuer === 'string' ? record.issuer : normalized,
    authorization_endpoint: authorization,
    token_endpoint: token,
    registration_endpoint: typeof registration === 'string'
      ? registration
      : undefined
  }
}

function readDynamicClientMap(): StoredDynamicOidcClients {
  if (typeof window === 'undefined') {
    return {}
  }
  const raw = localStorage.getItem(MATRIX_OIDC_DYNAMIC_CLIENT_STORAGE_KEY)
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as StoredDynamicOidcClients
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDynamicClientEntry(
  issuerNormalized: string,
  client_id: string,
  origin: string
): void {
  if (typeof window === 'undefined') {
    return
  }
  const next = readDynamicClientMap()
  next[issuerNormalized] = { client_id, origin }
  localStorage.setItem(
    MATRIX_OIDC_DYNAMIC_CLIENT_STORAGE_KEY,
    JSON.stringify(next)
  )
}

export async function ensurePublicOidcDynamicClientRegistered(options: {
  registrationEndpoint: string
  issuerNormalized: string
  appOriginHttps: string
  callbackPath: string
}): Promise<{ client_id: string }> {
  const redirectUri =
    `${options.appOriginHttps.replace(/\/+$/, '')}${options.callbackPath}`
  const clientUriRoot = `${options.appOriginHttps.replace(/\/+$/, '')}/`

  const body = {
    client_name: 'Decentra',
    client_uri: clientUriRoot,
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none'
  }

  const response = await fetch(options.registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const text = await response.text()
  if (!response.ok) {
    const message =
      `OIDC dynamic client registration failed (${response.status}): ` +
      `${text}`
    throw new Error(message)
  }
  try {
    const json = JSON.parse(text) as { client_id?: string }
    const client_id = typeof json.client_id === 'string'
      ? json.client_id.trim()
      : ''
    if (!client_id) {
      throw new Error(MATRIX_OIDC_REGISTRATION_REJECTED_ERROR)
    }
    writeDynamicClientEntry(options.issuerNormalized, client_id, options.appOriginHttps)
    return { client_id }
  } catch (thrown) {
    if (thrown instanceof Error && thrown.message) {
      throw thrown
    }
    throw new Error(MATRIX_OIDC_REGISTRATION_REJECTED_ERROR)
  }
}

/** Public HTTPS deployment origin (no trailing path). For tunnel or prod URL. */
export function resolveTrustedAppHttpsOrigin(siteUrlConfigured: string): string {
  const trimmed = siteUrlConfigured.trim()
  if (!trimmed) {
    return ''
  }
  const probe = trimmed.includes('://') ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(probe)
  } catch {
    return ''
  }
  if (url.protocol !== 'https:') {
    return ''
  }
  return url.origin.replace(/\/+$/, '')
}

export async function resolveOidcPublicClientId(options: {
  matrixOidcClientIdConfigured: string
  registrationEndpoint: string
  issuerNormalized: string
  trustedAppOrigin: string
  callbackPath: string
}): Promise<string> {
  const configured = options.matrixOidcClientIdConfigured.trim()
  if (configured) {
    return configured
  }
  const existing = readDynamicClientMap()[options.issuerNormalized]
  if (
    existing &&
    existing.origin === options.trustedAppOrigin &&
    existing.client_id
  ) {
    return existing.client_id
  }
  const registered = await ensurePublicOidcDynamicClientRegistered({
    registrationEndpoint: options.registrationEndpoint,
    issuerNormalized: options.issuerNormalized,
    appOriginHttps: options.trustedAppOrigin,
    callbackPath: options.callbackPath
  })
  return registered.client_id
}

/** Browser redirect starts OAuth (authorization_code + PKCE). */
export async function redirectToMatrixNativeOidc(options: {
  homeserverUrlInput: string
  trustedAppHttpsOrigin: string
  runtimeClientIdConfigured: string
  callbackPath: string
  intent: MatrixOidcIntent
}): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }
  const delegated = await fetchMatrixDelegatedClientHints(
    options.homeserverUrlInput
  )
  const issuerMeta = await fetchOpenIdIssuerMetadata(
    delegated.oidcIssuerNormalized
  )
  if (!issuerMeta.registration_endpoint) {
    throw new Error(MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR)
  }
  const oauthClientId = await resolveOidcPublicClientId({
    matrixOidcClientIdConfigured: options.runtimeClientIdConfigured,
    registrationEndpoint: issuerMeta.registration_endpoint,
    issuerNormalized: normalizeIssuerUrl(issuerMeta.issuer),
    trustedAppOrigin: options.trustedAppHttpsOrigin,
    callbackPath: options.callbackPath
  })

  const codeVerifier = randomUrlSafeString(48)
  const codeChallenge = await sha256Base64Url(codeVerifier)
  const state = randomUrlSafeString(24)
  const nonce = randomUrlSafeString(24)
  const oidcDeviceId = generateMatrixOidcDeviceId()
  const scopeList = [
    'openid',
    'email',
    MSC2967_API_SCOPE,
    `urn:matrix:org.matrix.msc2967.client:device:${oidcDeviceId}`
  ]
  const redirectUri =
    `${options.trustedAppHttpsOrigin.replace(/\/+$/, '')}` +
    `${options.callbackPath}`

  const pending: PendingOidcState = {
    v: 1,
    codeVerifier,
    nonce,
    redirectUri,
    matrixClientApiBaseUrl: delegated.matrixClientApiBaseUrl,
    oidcIssuer: issuerMeta.issuer,
    tokenEndpoint: issuerMeta.token_endpoint,
    registrationEndpoint: issuerMeta.registration_endpoint,
    oidcDeviceId,
    oauthClientId
  }
  sessionStorage.setItem(
    `${MATRIX_OIDC_STATE_STORAGE_PREFIX}${state}`,
    JSON.stringify(pending)
  )

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: oauthClientId,
    redirect_uri: redirectUri,
    scope: scopeList.join(' '),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })
  if (options.intent === 'signup') {
    params.set('prompt', 'create')
  } else {
    params.set('prompt', 'login')
  }
  const target = `${issuerMeta.authorization_endpoint}?${params.toString()}`
  window.location.assign(target)
}

export async function exchangeNativeOidcAuthorizationCode(options: {
  code: string
  state: string
}): Promise<{
  tokens: NativeOidcTokens
  pending: PendingOidcState
}> {
  if (typeof window === 'undefined') {
    throw new Error(MATRIX_OIDC_INVALID_CALLBACK_ERROR)
  }
  const stateKey = `${MATRIX_OIDC_STATE_STORAGE_PREFIX}${options.state}`
  const raw = sessionStorage.getItem(stateKey)
  sessionStorage.removeItem(stateKey)
  if (!raw) {
    throw new Error(MATRIX_OIDC_INVALID_CALLBACK_ERROR)
  }
  let pending: PendingOidcState
  try {
    pending = JSON.parse(raw) as PendingOidcState
  } catch {
    throw new Error(MATRIX_OIDC_INVALID_CALLBACK_ERROR)
  }
  if (!pending || pending.v !== 1 || !pending.codeVerifier) {
    throw new Error(MATRIX_OIDC_INVALID_CALLBACK_ERROR)
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: options.code.trim(),
    redirect_uri: pending.redirectUri,
    client_id: pending.oauthClientId,
    code_verifier: pending.codeVerifier
  })
  const response = await fetch(pending.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(
      `OIDC token exchange failed (${response.status}): ${text}`
    )
  }
  const json = JSON.parse(text) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  const accessToken = typeof json.access_token === 'string'
    ? json.access_token
    : ''
  if (!accessToken) {
    throw new Error(MATRIX_OIDC_INVALID_CALLBACK_ERROR)
  }
  const refreshToken = typeof json.refresh_token === 'string'
    ? json.refresh_token
    : null
  const expiresInSeconds = typeof json.expires_in === 'number'
    ? json.expires_in
    : null
  return {
    tokens: {
      accessToken,
      refreshToken,
      expiresInSeconds
    },
    pending
  }
}

export async function fetchMatrixWhoAmI(
  matrixClientApiBaseUrl: string,
  accessToken: string
): Promise<{ userId: string }> {
  const url =
    `${matrixClientApiBaseUrl.replace(/\/+$/, '')}` +
    `/_matrix/client/v3/account/whoami`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`whoami failed (${response.status}): ${text}`)
  }
  const json = JSON.parse(text) as { user_id?: string }
  const userId = typeof json.user_id === 'string' ? json.user_id.trim() : ''
  if (!userId) {
    throw new Error(MATRIX_OIDC_INVALID_CALLBACK_ERROR)
  }
  return { userId }
}

export async function refreshNativeOidcAccessToken(options: {
  refreshToken: string
  tokenEndpoint: string
  clientId: string
}): Promise<NativeOidcTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken.trim(),
    client_id: options.clientId.trim()
  })
  const response = await fetch(options.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(
      `OIDC refresh failed (${response.status}): ${text}`
    )
  }
  const json = JSON.parse(text) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  const accessToken = typeof json.access_token === 'string'
    ? json.access_token
    : ''
  if (!accessToken) {
    throw new Error(MATRIX_OIDC_INVALID_CALLBACK_ERROR)
  }
  const refreshToken = typeof json.refresh_token === 'string'
    ? json.refresh_token
    : null
  const expiresInSeconds = typeof json.expires_in === 'number'
    ? json.expires_in
    : null
  return {
    accessToken,
    refreshToken,
    expiresInSeconds
  }
}
