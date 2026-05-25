import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'
import {
  ClientEvent,
  EventType,
  JoinRule,
  MsgType,
  Preset,
  Visibility
} from 'matrix-js-sdk'
import { findLatestReadableRoomMessageEvent } from '~/utils/roomUnread'
import {
  pinRoomEvent as pinRoomEventState,
  unpinRoomEvent as unpinRoomEventState,
} from '~/utils/matrixRoomPinnedEvents'
import {
  clearRoomAvatar,
  setRoomAvatarFromMxc,
  setRoomName,
  setRoomTopic,
  uploadRoomAvatarFile,
} from '~/utils/matrixRoomMetadata'
import {
  saveSpaceRolesAndSyncPowerLevels,
} from '~/composables/matrix/spaceRolesStateHelpers'
import {
  syncChildRoomPowerLevelsFromSpaceRoles,
} from '~/composables/matrix/spaceRolesRoomSync'
import {
  setSpaceJoinRule,
  type SpaceAccessRule,
} from '~/utils/matrixSpaceGeneralSettings'
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api'
import { initAsync as initCryptoWasm } from '@matrix-org/matrix-sdk-crypto-wasm'
import { readonly, shallowRef } from 'vue'

import {
  extractUserLocalpart,
  HOMESERVER_CONNECTION_HINT_ERROR,
  isTransportFailureWithoutMatrixBody,
  isSameHomeserver,
  readMatrixErrorCode,
  readMatrixErrorMessage,
  isSignupUnsupported,
  resolveHomeserverBaseUrlForClient
} from './matrix/matrixClientShared'
export {
  HOMESERVER_CONNECTION_HINT_ERROR,
  isSameHomeserver,
  resolveHomeserverBaseUrlForClient
} from './matrix/matrixClientShared'
import {
  clearSignupPending,
  finalizeEmailRegistration,
  readSignupPendingPublic,
  registerWithDummy,
  signupPendingNeedsRecaptchaBeforeEmail,
  signupPendingNeedsRegistrationTokenBeforeEmail,
  signupPendingNeedsTermsBeforeEmail,
  hydrateTermsPoliciesForPending,
  startEmailRegistration,
  submitSignupRecaptcha,
  submitSignupRegistrationToken,
  submitSignupTermsAcceptance,
  SIGNUP_EMAIL_NOT_CONFIRMED_YET,
  SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR,
  SIGNUP_PENDING_MISSING,
  SIGNUP_PENDING_STORAGE_KEY,
  SIGNUP_RECAPTCHA_FAILED,
  SIGNUP_RECAPTCHA_TOKEN_REQUIRED,
  SIGNUP_REGISTER_API_CLOSED_ERROR,
  SIGNUP_REGISTRATION_UNSUPPORTED_STAGE,
  SIGNUP_REGISTRATION_TOKEN_REJECTED,
  SIGNUP_REGISTRATION_TOKEN_REQUIRED,
  SIGNUP_TERMS_ACCEPTANCE_REQUIRED,
  SIGNUP_MSISDN_NOT_SUPPORTED,
  SIGNUP_SSO_USE_WEB_CLIENT,
  SIGNUP_SESSION_EXPIRED,
  SIGNUP_UNAVAILABLE_ERROR
} from './matrix/matrixRegistrationUia'
export {
  clearSignupPending,
  finalizeEmailRegistration,
  hydrateTermsPoliciesForPending,
  readSignupPendingPublic,
  registerWithDummy,
  signupPendingNeedsRecaptchaBeforeEmail,
  signupPendingNeedsRegistrationTokenBeforeEmail,
  signupPendingNeedsTermsBeforeEmail,
  startEmailRegistration,
  submitSignupRecaptcha,
  submitSignupRegistrationToken,
  submitSignupTermsAcceptance,
  SIGNUP_EMAIL_NOT_CONFIRMED_YET,
  SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR,
  SIGNUP_PENDING_MISSING,
  SIGNUP_PENDING_STORAGE_KEY,
  SIGNUP_RECAPTCHA_FAILED,
  SIGNUP_RECAPTCHA_TOKEN_REQUIRED,
  SIGNUP_REGISTER_API_CLOSED_ERROR,
  SIGNUP_REGISTRATION_UNSUPPORTED_STAGE,
  SIGNUP_REGISTRATION_TOKEN_REJECTED,
  SIGNUP_REGISTRATION_TOKEN_REQUIRED,
  SIGNUP_TERMS_ACCEPTANCE_REQUIRED,
  SIGNUP_MSISDN_NOT_SUPPORTED,
  SIGNUP_SSO_USE_WEB_CLIENT,
  SIGNUP_SESSION_EXPIRED,
  SIGNUP_UNAVAILABLE_ERROR
}
export type { SignupPendingStateV1 } from './matrix/matrixRegistrationUia'
export type { SignupTermsPolicyItem } from './matrix/matrixRegistrationUia'
export {
  buildRecaptchaAuthPayload,
  buildRegistrationTokenAuthPayload,
  buildTermsAuthPayload,
  extractRecaptchaFromParams,
  extractTermsPoliciesFromParams,
  pickCompletableEmailSignupFlow,
  RECAPTCHA_STAGE,
  REGISTRATION_TOKEN_STAGE,
  TERMS_STAGE,
  isRegistrationTokenStage,
  isTermsStage
} from './matrix/matrixRegistrationUia'

import {
  exchangeNativeOidcAuthorizationCode,
  fetchMatrixWhoAmI,
  MATRIX_DELEGATED_OIDC_CALLBACK_RELATIVE_PATH,
  MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR,
  MATRIX_OIDC_INVALID_CALLBACK_ERROR,
  redirectToMatrixNativeOidc,
  refreshNativeOidcAccessToken,
  resolveTrustedAppHttpsOrigin,
  type MatrixOidcIntent
} from './matrix/matrixOidcNative'
import {
  moveRoomBetweenParents,
  persistSpaceChildOrder
} from './matrix/spaceStateHelpers'
import { waitForRoomSpaceParentLink } from '~/utils/waitForRoomSpaceParent'
import { buildTextEditContent } from '~/utils/matrixMessageEdit'
import { buildThreadRelatesTo } from '~/utils/matrixThreadRelations'

export {
  MATRIX_DELEGATED_OIDC_CALLBACK_RELATIVE_PATH,
  fetchMatrixDelegatedClientHints,
  MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR,
  MATRIX_OIDC_INVALID_CALLBACK_ERROR,
  MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR,
  MATRIX_OIDC_REGISTRATION_REJECTED_ERROR,
  MATRIX_OIDC_STATE_STORAGE_PREFIX
} from './matrix/matrixOidcNative'

interface StoredMatrixSession {
  baseUrl: string
  accessToken: string
  userId: string
  deviceId?: string
  refreshToken?: string
  oauthTokenExpiresAtMs?: number
  oidcTokenEndpoint?: string
  oidcClientId?: string
}

interface StoredMatrixDevice {
  baseUrl: string
  userId: string
  deviceId: string
}

type SessionRestoreStatus = 'idle' | 'loading' | 'success' | 'failure'

const MATRIX_SESSION_STORAGE_KEY = 'decentra.matrix.session.v1'
const MATRIX_DEVICE_STORAGE_KEY = 'decentra.matrix.device.v1'
let cryptoWasmInitialization: Promise<void> | null = null

/** MatrixClient started verification from another own device → open SAS flow */
const incomingVerificationFromOtherOwnDevice = shallowRef(false)

/** @returns Whether a beacon was consumed (caller may start SAS flow once). */
export function consumeIncomingVerificationFromOtherOwnDeviceBeacon(): boolean {
  if (!incomingVerificationFromOtherOwnDevice.value) {
    return false
  }
  incomingVerificationFromOtherOwnDevice.value = false
  return true
}

/** Read-only: verification request initiated from another own device/tab */
export function getIncomingVerificationFromOtherOwnDeviceReadonly() {
  return readonly(incomingVerificationFromOtherOwnDevice)
}

let verificationRelayAttachedClient: MatrixClient | null = null

function onMatrixVerificationRelayRequestReceived(
  request: unknown
): void {
  if (!request || typeof request !== 'object') {
    return
  }
  const candidate = request as {
    isSelfVerification?: boolean
    pending?: boolean
    initiatedByMe?: boolean
  }
  if (
    candidate.isSelfVerification &&
    candidate.pending &&
    candidate.initiatedByMe === false
  ) {
    incomingVerificationFromOtherOwnDevice.value = true
  }
}

/**
 * Incoming SAS from another signed-in device (MSC re-emitted onto MatrixClient).
 * Call after initRustCrypto; detach on logout/replace client.
 */
export function syncMatrixIncomingVerificationRelay(
  matrixClient: MatrixClient | null
): void {
  if (verificationRelayAttachedClient === matrixClient && matrixClient) {
    return
  }
  if (verificationRelayAttachedClient) {
    if (
      typeof verificationRelayAttachedClient.removeListener === 'function'
    ) {
      verificationRelayAttachedClient.removeListener(
        CryptoEvent.VerificationRequestReceived,
        onMatrixVerificationRelayRequestReceived
      )
    }
    verificationRelayAttachedClient = null
  }
  if (!matrixClient) {
    return
  }
  if (typeof matrixClient.on !== 'function') {
    return
  }
  verificationRelayAttachedClient = matrixClient
  matrixClient.on(
    CryptoEvent.VerificationRequestReceived,
    onMatrixVerificationRelayRequestReceived
  )
}

async function bootstrapRustCrossSigningIfNeeded(
  matrixClient: MatrixClient
): Promise<void> {
  const cryptoApi = matrixClient.getCrypto?.()
  if (!cryptoApi || typeof cryptoApi.bootstrapCrossSigning !== 'function') {
    return
  }
  try {
    await cryptoApi.bootstrapCrossSigning({})
  } catch {
    // Interactive auth may be required on some homeservers; ignore silently.
  }
}

let sessionRestorePromise: Promise<void> | null = null

interface MatrixEncryptedFile {
  key: {
    k: string
    kty: string
    alg: string
    key_ops: string[]
    ext: boolean
  }
  iv: string
  hashes: Record<string, string>
  v: string
  url: string
}

interface ImageInfo {
  mimetype: string
  size: number
  w?: number
  h?: number
}

interface MessageReplyOptions {
  eventId: string
}

/** Options for {@link sendMessage}; legacy shape `{ eventId }` is still reply-only */
export interface SendTextMessageOptions {
  replyTo?: MessageReplyOptions
  threadRootEventId?: string
}

function normalizeSendTextOptions(
  options?: MessageReplyOptions | SendTextMessageOptions,
): SendTextMessageOptions {
  if (!options) {
    return {}
  }
  if ('threadRootEventId' in options || 'replyTo' in options) {
    return options as SendTextMessageOptions
  }
  return { replyTo: options as MessageReplyOptions }
}

interface ReactionToggleOptions {
  ownReactionEventIds?: string[]
}

export interface PublicRoomListItem {
  roomId: string
  name?: string
  topic?: string
  canonicalAlias?: string
  aliases?: string[]
  numJoinedMembers?: number
}

export interface SearchPublicRoomsResult {
  rooms: PublicRoomListItem[]
  nextBatch?: string
  prevBatch?: string
  totalRoomCountEstimate?: number
}

export interface CreateGroupRoomInput {
  name: string
  topic?: string
  /** Private = invite-only; public = joinable and directory-listed */
  visibility: 'private' | 'public'
  /** Link new room as m.space.child of this space */
  parentSpaceId?: string
  /** Sibling index on parent (default: append) */
  insertIndex?: number
  /** Matrix user IDs to invite on create */
  inviteUserIds?: string[]
}

export interface InviteUsersToRoomResult {
  invited: string[]
  failed: Array<{ userId: string; error: string }>
}

export interface CreateMatrixSpaceInput {
  name: string
  topic?: string
  visibility: 'private' | 'public'
  /** Link new space as m.space.child of this parent space */
  parentSpaceId?: string
  insertIndex?: number
  inviteUserIds?: string[]
}

export interface UserDirectoryResultItem {
  userId: string
  displayName?: string
  avatarUrl?: string
}

const MATRIX_TO_BASE = 'https://matrix.to/#'

function homeserverFromUserId(matrixUserId: string): string {
  const colonIndex = matrixUserId.indexOf(':')
  if (colonIndex < 0) {
    return ''
  }
  return matrixUserId.slice(colonIndex + 1)
}

export function normalizeMatrixUserId(
  input: string,
  defaultDomain: string
): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Matrix user id is required')
  }
  const withAt = trimmed.startsWith('@') ? trimmed : `@${trimmed}`
  if (withAt.includes(':')) {
    return withAt
  }
  const domain = defaultDomain.trim()
  if (!domain) {
    throw new Error('Enter a full Matrix id like @name:server')
  }
  return `${withAt}:${domain}`
}

export function buildMatrixToUserLink(matrixUserId: string): string {
  const id = matrixUserId.trim()
  if (!id) {
    return MATRIX_TO_BASE
  }
  return `${MATRIX_TO_BASE}/${encodeURIComponent(id)}`
}

function mapPublicRoomsChunk(
  chunk: Array<Record<string, unknown>>
): PublicRoomListItem[] {
  return chunk.map((entry) => {
    const roomId = String(entry.room_id ?? '')
    return {
      roomId,
      name: typeof entry.name === 'string' ? entry.name : undefined,
      topic: typeof entry.topic === 'string' ? entry.topic : undefined,
      canonicalAlias:
        typeof entry.canonical_alias === 'string'
          ? entry.canonical_alias
          : undefined,
      aliases: Array.isArray(entry.aliases)
        ? entry.aliases.filter((a): a is string => typeof a === 'string')
        : undefined,
      numJoinedMembers:
        typeof entry.num_joined_members === 'number'
          ? entry.num_joined_members
          : undefined
    }
  })
}

function throwMappedMatrixError(error: unknown, fallback: string): never {
  const code = readMatrixErrorCode(error)
  const message = readMatrixErrorMessage(error)
  if (code === 'M_FORBIDDEN' || code === 'M_UNAUTHORIZED') {
    throw new Error(message || 'This action is not allowed on this homeserver')
  }
  if (code === 'M_NOT_FOUND') {
    throw new Error(message || 'Room or user was not found')
  }
  if (code === 'M_UNRECOGNIZED' || code === 'M_UNKNOWN') {
    throw new Error(
      message || 'This homeserver does not support this operation'
    )
  }
  if (message) {
    throw new Error(message)
  }
  throw new Error(fallback)
}

function shouldReuseStoredDeviceId(
  storedSession: StoredMatrixSession | null,
  storedDevice: StoredMatrixDevice | null,
  baseUrl: string,
  username: string
): boolean {
  const sessionDevice = storedSession?.deviceId
  const sessionUserId = storedSession?.userId
  const sessionBaseUrl = storedSession?.baseUrl
  const fallbackDevice = storedDevice?.deviceId
  const fallbackUserId = storedDevice?.userId
  const fallbackBaseUrl = storedDevice?.baseUrl
  const candidateDeviceId = sessionDevice || fallbackDevice
  const candidateUserId = sessionUserId || fallbackUserId
  const candidateBaseUrl = sessionBaseUrl || fallbackBaseUrl

  if (!candidateDeviceId || !candidateUserId || !candidateBaseUrl) {
    return false
  }
  if (!isSameHomeserver(candidateBaseUrl, baseUrl)) {
    return false
  }
  const normalizedUsername = username.trim().toLowerCase()
  if (normalizedUsername.startsWith('@')) {
    return candidateUserId.toLowerCase() === normalizedUsername
  }
  return extractUserLocalpart(candidateUserId) ===
    extractUserLocalpart(normalizedUsername)
}

function isCryptoStoreAccountMismatch(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return message.includes('account in the store doesn\'t match') ||
    message.includes("account in the store doesn't match")
}

function deleteIndexedDb(databaseName: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(databaseName)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function clearRustCryptoStores(): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }
  const databaseNames = new Set<string>([
    'matrix-js-sdk::matrix-sdk-crypto'
  ])
  const indexedDbFactory = window.indexedDB as
    IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> }

  if (typeof indexedDbFactory.databases === 'function') {
    try {
      const databases = await indexedDbFactory.databases()
      for (const database of databases) {
        const databaseName = database.name ?? ''
        if (databaseName.includes('matrix-sdk-crypto')) {
          databaseNames.add(databaseName)
        }
      }
    } catch {
      // Continue with known fallback DB names.
    }
  }

  for (const databaseName of databaseNames) {
    await deleteIndexedDb(databaseName)
  }
}

async function ensureCryptoWasmInitialized(): Promise<void> {
  if (!cryptoWasmInitialization) {
    cryptoWasmInitialization = initCryptoWasm()
      .catch((error) => {
        cryptoWasmInitialization = null
        throw error
      })
  }
  await cryptoWasmInitialization
}

function base64ToBase64Url(input: string): string {
  return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const value of bytes) {
    binary += String.fromCharCode(value)
  }
  return btoa(binary)
}

function toUnpaddedBase64(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/=+$/g, '')
}

async function encryptAttachmentData(
  data: ArrayBuffer
): Promise<{ encryptedData: ArrayBuffer; encryptedFile: Omit<MatrixEncryptedFile, 'url'> }> {
  const cryptoKey = await crypto.subtle.generateKey(
    { name: 'AES-CTR', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const rawKey = await crypto.subtle.exportKey('raw', cryptoKey)
  const keyBytes = new Uint8Array(rawKey)
  const ivBytes = new Uint8Array(16)
  crypto.getRandomValues(ivBytes)
  for (let index = 8; index < ivBytes.length; index++) {
    ivBytes[index] = 0
  }

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-CTR',
      counter: ivBytes,
      length: 64
    },
    cryptoKey,
    data
  )
  const hashBuffer = await crypto.subtle.digest('SHA-256', encryptedData)
  const hashBase64 = toUnpaddedBase64(new Uint8Array(hashBuffer))

  return {
    encryptedData,
    encryptedFile: {
      key: {
        k: base64ToBase64Url(bytesToBase64(keyBytes)),
        kty: 'oct',
        alg: 'A256CTR',
        key_ops: ['encrypt', 'decrypt'],
        ext: true
      },
      iv: toUnpaddedBase64(ivBytes),
      hashes: { sha256: hashBase64 },
      v: 'v2'
    }
  }
}

function extractMxcUrl(uploadResponse: unknown): string {
  if (typeof uploadResponse === 'string') {
    return uploadResponse
  }
  if (uploadResponse && typeof uploadResponse === 'object') {
    const response = uploadResponse as Record<string, unknown>
    const contentUri = response.content_uri
    if (typeof contentUri === 'string') {
      return contentUri
    }
  }
  throw new Error('Media upload did not return an MXC URL')
}

async function readImageDimensions(
  imageFile: Blob
): Promise<{ w?: number; h?: number }> {
  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    return {}
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(imageFile)
    const image = new Image()
    image.onload = () => {
      resolve({ w: image.naturalWidth, h: image.naturalHeight })
      URL.revokeObjectURL(objectUrl)
    }
    image.onerror = () => {
      resolve({})
      URL.revokeObjectURL(objectUrl)
    }
    image.src = objectUrl
  })
}

function getImageInfo(imageFile: Blob, dimensions: { w?: number; h?: number }): ImageInfo {
  return {
    mimetype: imageFile.type || 'application/octet-stream',
    size: imageFile.size,
    ...dimensions
  }
}

function isRoomEncrypted(room: sdk.Room): boolean {
  const hasEncryptionStateEvent = (room as sdk.Room & {
    hasEncryptionStateEvent?: () => boolean
  }).hasEncryptionStateEvent
  if (typeof hasEncryptionStateEvent === 'function') {
    return hasEncryptionStateEvent.call(room)
  }
  const encryptionStateEvent = room.currentState
    ?.getStateEvents?.('m.room.encryption', '')
  if (Array.isArray(encryptionStateEvent)) {
    return encryptionStateEvent.length > 0
  }
  return Boolean(encryptionStateEvent)
}

export function useMatrixClient() {
  const client = useState<MatrixClient | null>('matrix-client', () => null)
  const sessionRestoreStatus = useState<SessionRestoreStatus>(
    'matrix-client-restore-status',
    () => 'idle'
  )
  const isLoggedIn = computed(() => client.value !== null)
  const userId = computed(() => client.value?.getUserId() ?? null)
  const isSessionRestoreInProgress = computed(() => {
    return sessionRestoreStatus.value === 'loading'
  })
  const isSessionRestoreFinished = computed(() => {
    return (
      sessionRestoreStatus.value === 'success' ||
      sessionRestoreStatus.value === 'failure'
    )
  })

  async function initRustCryptoWithRecovery(
    matrixClient: MatrixClient,
    context: string
  ): Promise<boolean> {
    try {
      await ensureCryptoWasmInitialized()
      await matrixClient.initRustCrypto()
      await bootstrapRustCrossSigningIfNeeded(matrixClient)
      return true
    } catch (error) {
      if (!isCryptoStoreAccountMismatch(error)) {
        console.error(`Failed to initialize Rust crypto ${context}`, error)
        return false
      }
      console.warn('Crypto store mismatch detected; resetting local crypto stores')
      try {
        await matrixClient.clearStores()
      } catch {
        // clearStores can fail if store does not exist yet.
      }
      await clearRustCryptoStores()
      try {
        await ensureCryptoWasmInitialized()
        await matrixClient.initRustCrypto()
        await bootstrapRustCrossSigningIfNeeded(matrixClient)
        return true
      } catch (retryError) {
        console.error(
          `Failed to initialize Rust crypto ${context} after store reset`,
          retryError
        )
        return false
      }
    }
  }

  function readStoredSession(): StoredMatrixSession | null {
    if (typeof window === 'undefined') {
      return null
    }
    const rawSession = localStorage.getItem(MATRIX_SESSION_STORAGE_KEY)
    if (!rawSession) {
      return null
    }
    try {
      const parsedSession = JSON.parse(rawSession) as StoredMatrixSession
      if (
        !parsedSession.baseUrl ||
        !parsedSession.accessToken ||
        !parsedSession.userId
      ) {
        return null
      }
      return parsedSession
    } catch {
      return null
    }
  }

  function writeStoredSession(session: StoredMatrixSession): void {
    if (typeof window === 'undefined') {
      return
    }
    localStorage.setItem(
      MATRIX_SESSION_STORAGE_KEY,
      JSON.stringify(session)
    )
  }

  function clearStoredSession(): void {
    if (typeof window === 'undefined') {
      return
    }
    localStorage.removeItem(MATRIX_SESSION_STORAGE_KEY)
  }

  function readStoredDevice(): StoredMatrixDevice | null {
    if (typeof window === 'undefined') {
      return null
    }
    const rawStoredDevice = localStorage.getItem(MATRIX_DEVICE_STORAGE_KEY)
    if (!rawStoredDevice) {
      return null
    }
    try {
      const parsedStoredDevice = JSON.parse(rawStoredDevice) as StoredMatrixDevice
      if (
        !parsedStoredDevice.baseUrl ||
        !parsedStoredDevice.userId ||
        !parsedStoredDevice.deviceId
      ) {
        return null
      }
      return parsedStoredDevice
    } catch {
      return null
    }
  }

  function writeStoredDevice(device: StoredMatrixDevice): void {
    if (typeof window === 'undefined') {
      return
    }
    localStorage.setItem(
      MATRIX_DEVICE_STORAGE_KEY,
      JSON.stringify(device)
    )
  }

  async function initializeClientFromStoredSession(): Promise<void> {
    if (client.value) {
      return
    }
    let session = readStoredSession()
    if (!session) {
      return
    }
    if (
      session.refreshToken &&
      session.oidcTokenEndpoint &&
      session.oidcClientId &&
      session.oauthTokenExpiresAtMs != null
    ) {
      const nearingExpiry =
        Date.now() > session.oauthTokenExpiresAtMs - 120_000
      if (nearingExpiry) {
        try {
          const renewed = await refreshNativeOidcAccessToken({
            refreshToken: session.refreshToken,
            tokenEndpoint: session.oidcTokenEndpoint,
            clientId: session.oidcClientId
          })
          let expiresMs = session.oauthTokenExpiresAtMs
          if (renewed.expiresInSeconds != null) {
            expiresMs =
              Date.now() + renewed.expiresInSeconds * 1000
          }
          session = {
            ...session,
            accessToken: renewed.accessToken,
            refreshToken: renewed.refreshToken || session.refreshToken,
            oauthTokenExpiresAtMs: expiresMs
          }
          writeStoredSession(session)
        } catch {
          // Keep previous access_token; renewal can fail offline.
        }
      }
    }
    const restoredClient = sdk.createClient({
      baseUrl: session.baseUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId
    })
    if (session.deviceId) {
      await initRustCryptoWithRecovery(restoredClient, 'for restored session')
    }
    restoredClient.startClient({ initialSyncLimit: 50 })
    client.value = restoredClient
    syncMatrixIncomingVerificationRelay(restoredClient)
  }

  function startSessionRestore(): Promise<void> {
    if (sessionRestoreStatus.value === 'loading' && sessionRestorePromise) {
      return sessionRestorePromise
    }
    if (
      sessionRestoreStatus.value === 'success' ||
      sessionRestoreStatus.value === 'failure'
    ) {
      return Promise.resolve()
    }

    sessionRestoreStatus.value = 'loading'
    sessionRestorePromise = initializeClientFromStoredSession()
      .then(() => {
        sessionRestoreStatus.value = 'success'
      })
      .catch((error) => {
        console.error('Failed to restore matrix session', error)
        sessionRestoreStatus.value = 'failure'
      })
      .finally(() => {
        sessionRestorePromise = null
      })

    return sessionRestorePromise
  }

  async function ensureSessionRestoreCompleted(): Promise<void> {
    if (typeof window === 'undefined') {
      return
    }
    await startSessionRestore()
  }

  if (typeof window !== 'undefined' && sessionRestoreStatus.value === 'idle') {
    void startSessionRestore()
  }

  async function login(
    baseUrl: string,
    username: string,
    password: string
  ): Promise<void> {
    const resolvedBaseUrl = resolveHomeserverBaseUrlForClient(baseUrl)
    try {
      const authClient = sdk.createClient({ baseUrl: resolvedBaseUrl })
      const storedSession = readStoredSession()
      const storedDevice = readStoredDevice()
      const shouldReuseDeviceId = shouldReuseStoredDeviceId(
        storedSession,
        storedDevice,
        resolvedBaseUrl,
        username
      )
      const preferredDeviceId = shouldReuseDeviceId
        ? storedSession?.deviceId || storedDevice?.deviceId
        : undefined
      const authData = await authClient.loginRequest({
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: username
        },
        password,
        device_id: preferredDeviceId
      })
      const deviceId = authData.device_id

      const newClient = sdk.createClient({
        baseUrl: resolvedBaseUrl,
        accessToken: authData.access_token,
        userId: authData.user_id,
        deviceId
      })

      if (!deviceId) {
        console.warn(
          'Missing device_id in login response; skipping Rust crypto init'
        )
      } else {
        await initRustCryptoWithRecovery(newClient, 'during login')
      }

      newClient.startClient({ initialSyncLimit: 50 })
      client.value = newClient
      syncMatrixIncomingVerificationRelay(newClient)
      writeStoredSession({
        baseUrl: resolvedBaseUrl,
        accessToken: authData.access_token,
        userId: authData.user_id,
        deviceId
      })
      if (deviceId) {
        writeStoredDevice({
          baseUrl: resolvedBaseUrl,
          userId: authData.user_id,
          deviceId
        })
      }
    } catch (error) {
      if (isTransportFailureWithoutMatrixBody(error)) {
        throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
      }
      const matrixMessage = readMatrixErrorMessage(error)
      if (matrixMessage) {
        throw new Error(matrixMessage)
      }
      throw error
    }
  }

  async function register(
    baseUrl: string,
    username: string,
    password: string,
    email?: string
  ): Promise<void> {
    const trimmedEmail = email?.trim() || ''
    if (trimmedEmail) {
      await startEmailRegistration(
        baseUrl,
        username,
        password,
        trimmedEmail
      )
      return
    }
    await registerWithDummy(baseUrl, username, password)
  }

  function logout(): void {
    syncMatrixIncomingVerificationRelay(null)
    if (client.value) {
      client.value.stopClient()
      client.value = null
    }
    clearStoredSession()
  }

  function resolveConfiguredTrustedSiteOrigin(): string {
    const runtimeCfg = useRuntimeConfig()
    return resolveTrustedAppHttpsOrigin(
      String(runtimeCfg.public.siteUrl || '').trim()
    )
  }

  async function startDelegatedMatrixNativeOidcAuth(payload: {
    homeserverUrlInput: string
    intent: MatrixOidcIntent
  }): Promise<void> {
    const siteOriginHttps = resolveConfiguredTrustedSiteOrigin()
    if (!siteOriginHttps) {
      throw new Error(MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR)
    }
    const runtimeCfg = useRuntimeConfig()
    await redirectToMatrixNativeOidc({
      homeserverUrlInput: payload.homeserverUrlInput,
      trustedAppHttpsOrigin: siteOriginHttps,
      runtimeClientIdConfigured: String(
        runtimeCfg.public.matrixOidcClientId || ''
      ).trim(),
      callbackPath: MATRIX_DELEGATED_OIDC_CALLBACK_RELATIVE_PATH,
      intent: payload.intent
    })
  }

  async function finalizeDelegatedMatrixOidcFromRedirectPayload(
    payload: { code: string; state: string }
  ): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error(MATRIX_OIDC_INVALID_CALLBACK_ERROR)
    }
    const exchanged = await exchangeNativeOidcAuthorizationCode({
      code: payload.code,
      state: payload.state
    })
    const identity = await fetchMatrixWhoAmI(
      exchanged.pending.matrixClientApiBaseUrl,
      exchanged.tokens.accessToken
    )
    const ttlSeconds = exchanged.tokens.expiresInSeconds ?? 300
    const oauthExpiresAtMs = Date.now() + ttlSeconds * 1000
    const deviceLit = exchanged.pending.oidcDeviceId
    const matrixApiBase = exchanged.pending.matrixClientApiBaseUrl
    const delegatedClient = sdk.createClient({
      baseUrl: matrixApiBase,
      accessToken: exchanged.tokens.accessToken,
      userId: identity.userId,
      deviceId: deviceLit
    })
    await initRustCryptoWithRecovery(
      delegatedClient,
      'during delegated OIDC'
    )
    delegatedClient.startClient({ initialSyncLimit: 50 })
    if (client.value) {
      client.value.stopClient()
    }
    syncMatrixIncomingVerificationRelay(delegatedClient)
    client.value = delegatedClient
    const maybeRefresh = exchanged.tokens.refreshToken ?? undefined
    writeStoredSession({
      baseUrl: matrixApiBase,
      accessToken: exchanged.tokens.accessToken,
      userId: identity.userId,
      deviceId: deviceLit,
      refreshToken: maybeRefresh,
      oauthTokenExpiresAtMs: oauthExpiresAtMs,
      oidcTokenEndpoint: exchanged.pending.tokenEndpoint,
      oidcClientId: exchanged.pending.oauthClientId
    })
    writeStoredDevice({
      baseUrl: matrixApiBase,
      userId: identity.userId,
      deviceId: deviceLit
    })
  }

  async function ensureCryptoReady(): Promise<boolean> {
    const matrixClient = client.value
    if (!matrixClient) {
      return false
    }
    if (matrixClient.getCrypto?.()) {
      return true
    }
    const deviceId = matrixClient.getDeviceId?.()
    if (!deviceId) {
      return false
    }
    try {
      const initialized = await initRustCryptoWithRecovery(
        matrixClient,
        'on demand'
      )
      if (!initialized) {
        return false
      }
    } catch {
      return false
    }
    return Boolean(matrixClient.getCrypto?.())
  }

  function getRooms(): sdk.Room[] {
    if (!client.value) return []
    return client.value.getRooms()
  }

  function getRoom(roomId: string): sdk.Room | null {
    return client.value?.getRoom(roomId) ?? null
  }

  async function markRoomAsRead(roomId: string): Promise<void> {
    const matrixClient = client.value
    if (!matrixClient) {
      return
    }
    const room = matrixClient.getRoom(roomId)
    if (!room) {
      return
    }
    const latestMessageEvent = findLatestReadableRoomMessageEvent(room)
    if (!latestMessageEvent) {
      return
    }
    const eventId = latestMessageEvent.getId()
    if (!eventId) {
      return
    }
    try {
      await matrixClient.sendReadReceipt(latestMessageEvent)
      await matrixClient.setRoomReadMarkers(
        roomId,
        eventId,
        latestMessageEvent,
      )
    } catch (thrownError) {
      console.error('markRoomAsRead failed', thrownError)
    }
  }

  async function sendRoomTyping(
    roomId: string,
    isTyping: boolean,
    timeoutMs: number,
  ): Promise<void> {
    if (!client.value) {
      return
    }
    await client.value.sendTyping(roomId, isTyping, timeoutMs)
  }

  async function sendMessage(
    roomId: string,
    body: string,
    options?: MessageReplyOptions | SendTextMessageOptions,
  ): Promise<void> {
    if (!client.value) throw new Error('Not logged in')
    const normalized = normalizeSendTextOptions(options)
    const content: Record<string, any> = {
      msgtype: MsgType.Text,
      body,
    }

    const threadRootId = normalized.threadRootEventId
    const replyEventId = normalized.replyTo?.eventId

    if (threadRootId) {
      content['m.relates_to'] = buildThreadRelatesTo({
        threadRootEventId: threadRootId,
        inReplyToEventId: replyEventId,
      })
    } else if (replyEventId) {
      content['m.relates_to'] = {
        'm.in_reply_to': {
          event_id: replyEventId,
        },
      }
    }

    await client.value.sendEvent(
      roomId,
      EventType.RoomMessage,
      content as any,
    )
  }

  async function sendEditMessage(
    roomId: string,
    newBody: string,
    targetEventId: string,
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    const trimmedBody = newBody.trim()
    if (!trimmedBody) {
      throw new Error('Edit body cannot be empty')
    }
    const content = buildTextEditContent(trimmedBody, targetEventId)
    await client.value.sendEvent(
      roomId,
      EventType.RoomMessage,
      content as any,
    )
  }

  async function sendImageMessage(
    roomId: string,
    imageFile: File | Blob,
    fileName = 'image'
  ): Promise<void> {
    const matrixClient = client.value
    if (!matrixClient) {
      throw new Error('Not logged in')
    }
    const mimetype = imageFile.type || ''
    if (!mimetype.startsWith('image/')) {
      throw new Error('Only image uploads are supported')
    }
    const room = matrixClient.getRoom(roomId)
    if (!room) {
      throw new Error('Room not found')
    }
    const dimensions = await readImageDimensions(imageFile)
    const imageInfo = getImageInfo(imageFile, dimensions)
    const encryptedRoom = isRoomEncrypted(room)

    if (encryptedRoom) {
      const cryptoReady = await ensureCryptoReady()
      if (!cryptoReady) {
        throw new Error('Encryption is not ready for media upload')
      }
      const plaintextData = await imageFile.arrayBuffer()
      const encryptedResult = await encryptAttachmentData(plaintextData)
      const encryptedBlob = new Blob(
        [encryptedResult.encryptedData],
        { type: 'application/octet-stream' }
      )
      const uploadResponse = await matrixClient.uploadContent(
        encryptedBlob,
        { type: 'application/octet-stream', includeFilename: true }
      )
      const mxcUrl = extractMxcUrl(uploadResponse)
      const encryptedFile: MatrixEncryptedFile = {
        ...encryptedResult.encryptedFile,
        url: mxcUrl
      }
      await matrixClient.sendEvent(roomId, EventType.RoomMessage, {
        msgtype: MsgType.Image,
        body: fileName,
        info: imageInfo,
        file: encryptedFile
      })
      return
    }

    const uploadResponse = await matrixClient.uploadContent(
      imageFile,
      { type: imageInfo.mimetype, includeFilename: true }
    )
    const mxcUrl = extractMxcUrl(uploadResponse)
    await matrixClient.sendEvent(roomId, EventType.RoomMessage, {
      msgtype: MsgType.Image,
      body: fileName,
      info: imageInfo,
      url: mxcUrl
    })
  }

  async function loadOlderMessages(roomId: string): Promise<boolean> {
    const room = client.value?.getRoom(roomId)
    if (!room || !client.value) return false
    const timeline = room.getLiveTimeline()
    return client.value.paginateEventTimeline(timeline, { backwards: true })
  }

  async function sendReaction(
    roomId: string,
    eventId: string,
    emoji: string
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    const trimmedEmoji = emoji.trim()
    if (!trimmedEmoji) {
      throw new Error('Emoji is required')
    }
    await client.value.sendEvent(roomId, 'm.reaction' as any, {
      'm.relates_to': {
        rel_type: 'm.annotation',
        event_id: eventId,
        key: trimmedEmoji
      }
    } as any)
  }

  async function redactEvent(
    roomId: string,
    reactionEventId: string
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    await (client.value as MatrixClient & {
      redactEvent: (
        roomId: string,
        eventId: string
      ) => Promise<unknown>
    }).redactEvent(roomId, reactionEventId)
  }

  async function toggleReaction(
    roomId: string,
    messageEventId: string,
    emoji: string,
    options?: ReactionToggleOptions | string[]
  ): Promise<void> {
    const ownReactionEventIds = Array.isArray(options)
      ? options
      : options?.ownReactionEventIds ?? []
    const firstOwnReactionEventId = ownReactionEventIds[0]
    if (firstOwnReactionEventId) {
      await redactEvent(roomId, firstOwnReactionEventId)
      return
    }
    await sendReaction(roomId, messageEventId, emoji)
  }

  function requireClient(): MatrixClient {
    const matrixClient = client.value
    if (!matrixClient) {
      throw new Error('Not logged in')
    }
    return matrixClient
  }

  async function reorderSpaceChildren(
    parentSpaceId: string,
    orderedChildRoomIds: string[]
  ): Promise<void> {
    const matrixClient = requireClient()
    await persistSpaceChildOrder(
      matrixClient,
      parentSpaceId,
      orderedChildRoomIds
    )
  }

  async function moveChannelBetweenSpaceParents(options: {
    roomId: string
    previousParentSpaceId: string | null
    nextParentSpaceId: string
    insertIndex?: number
  }): Promise<void> {
    const matrixClient = requireClient()
    await moveRoomBetweenParents({ matrixClient, ...options })
  }

  async function pinRoomEvent(
    roomId: string,
    eventId: string,
  ): Promise<void> {
    const matrixClient = requireClient()
    await pinRoomEventState(matrixClient, roomId, eventId)
  }

  async function unpinRoomEvent(
    roomId: string,
    eventId: string,
  ): Promise<void> {
    const matrixClient = requireClient()
    await unpinRoomEventState(matrixClient, roomId, eventId)
  }

  async function updateSpaceName(spaceId: string, name: string): Promise<void> {
    const matrixClient = requireClient()
    await setRoomName(matrixClient, spaceId, name)
  }

  async function updateSpaceTopic(
    spaceId: string,
    topic: string,
  ): Promise<void> {
    const matrixClient = requireClient()
    await setRoomTopic(matrixClient, spaceId, topic)
  }

  async function updateSpaceAvatar(
    spaceId: string,
    imageFile: File,
  ): Promise<void> {
    const matrixClient = requireClient()
    const mxcUrl = await uploadRoomAvatarFile(matrixClient, imageFile)
    await setRoomAvatarFromMxc(matrixClient, spaceId, mxcUrl)
  }

  async function removeSpaceAvatar(spaceId: string): Promise<void> {
    const matrixClient = requireClient()
    await clearRoomAvatar(matrixClient, spaceId)
  }

  async function updateSpaceJoinRule(
    spaceId: string,
    joinRule: SpaceAccessRule,
  ): Promise<void> {
    const matrixClient = requireClient()
    await setSpaceJoinRule(matrixClient, spaceId, joinRule)
  }

  async function upgradeSpaceRoom(
    spaceId: string,
    targetVersion: string,
  ): Promise<void> {
    const matrixClient = requireClient()
    await matrixClient.upgradeRoom(spaceId, targetVersion)
  }

  async function saveSpaceRoles(
    spaceId: string,
    content: SpaceRolesState,
    childRoomIds: string[] = [],
    scrubPowerLevel?: number,
  ): Promise<void> {
    const matrixClient = requireClient()
    await saveSpaceRolesAndSyncPowerLevels(
      matrixClient,
      spaceId,
      content,
      scrubPowerLevel,
    )
    if (childRoomIds.length > 0) {
      await syncChildRoomPowerLevelsFromSpaceRoles(
        matrixClient,
        content,
        childRoomIds,
        scrubPowerLevel,
      )
    }
  }

  async function mergeDirectAccountData(
    matrixClient: MatrixClient,
    peerUserId: string,
    roomId: string
  ): Promise<void> {
    const directEvent = matrixClient.getAccountData(EventType.Direct)
    const previous = (directEvent?.getContent() as
      | Record<string, string[]>
      | undefined) ?? {}
    const next: Record<string, string[]> = { ...previous }
    const existing = new Set(next[peerUserId] ?? [])
    existing.add(roomId)
    next[peerUserId] = [...existing]
    await matrixClient.setAccountData(EventType.Direct, next)
  }

  function findJoinedDirectRoomId(
    matrixClient: MatrixClient,
    peerUserId: string
  ): string | null {
    const directEvent = matrixClient.getAccountData(EventType.Direct)
    const content = directEvent?.getContent() as
      | Record<string, string[]>
      | undefined
    const candidates = content?.[peerUserId] ?? []
    for (const roomId of candidates) {
      const room = matrixClient.getRoom(roomId)
      if (room?.getMyMembership() === 'join') {
        return roomId
      }
    }
    return null
  }

  async function getOrCreateDirectMessageRoom(
    rawUserId: string
  ): Promise<string> {
    const matrixClient = requireClient()
    const selfId = matrixClient.getUserId()
    if (!selfId) {
      throw new Error('Not logged in')
    }
    const domain = homeserverFromUserId(selfId)
    const peerUserId = normalizeMatrixUserId(rawUserId, domain)
    if (peerUserId.toLowerCase() === selfId.toLowerCase()) {
      throw new Error('Cannot start a direct message with yourself')
    }
    const fromAccount = findJoinedDirectRoomId(matrixClient, peerUserId)
    if (fromAccount) {
      return fromAccount
    }
    const createOpts: sdk.ICreateRoomOpts = {
      invite: [peerUserId],
      preset: Preset.PrivateChat,
      is_direct: true
    }
    if (await ensureCryptoReady()) {
      createOpts.initial_state = [
        {
          type: EventType.RoomEncryption,
          state_key: '',
          content: { algorithm: 'm.megolm.v1.aes-sha2' }
        }
      ]
    }
    try {
      const { room_id: roomId } = await matrixClient.createRoom(createOpts)
      await mergeDirectAccountData(matrixClient, peerUserId, roomId)
      return roomId
    } catch (error) {
      if (isTransportFailureWithoutMatrixBody(error)) {
        throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
      }
      throwMappedMatrixError(error, 'Could not start direct message')
    }
  }

  function buildDirectMessageShareLink(rawUserId: string): string {
    const matrixClient = client.value
    const selfId = matrixClient?.getUserId()
    const domain = selfId ? homeserverFromUserId(selfId) : ''
    const peerUserId = normalizeMatrixUserId(rawUserId, domain)
    return buildMatrixToUserLink(peerUserId)
  }

  function buildOwnMatrixToLink(): string {
    const matrixClient = client.value
    const selfId = matrixClient?.getUserId()
    if (!selfId) {
      return MATRIX_TO_BASE
    }
    return buildMatrixToUserLink(selfId)
  }

  function buildRoomCreateInitialState(
    isPublic: boolean,
    includeEncryption: boolean,
  ): sdk.ICreateRoomOpts['initial_state'] {
    const encryptionReady = includeEncryption
    const encryptionState =
      encryptionReady
        ? [
            {
              type: EventType.RoomEncryption,
              state_key: '',
              content: { algorithm: 'm.megolm.v1.aes-sha2' },
            },
          ]
        : []
    return [
      {
        type: EventType.RoomJoinRules,
        state_key: '',
        content: {
          join_rule: isPublic ? JoinRule.Public : JoinRule.Invite,
        },
      },
      {
        type: EventType.RoomHistoryVisibility,
        state_key: '',
        content: {
          history_visibility: isPublic ? 'world_readable' : 'invited',
        },
      },
      ...encryptionState,
    ]
  }

  async function linkRoomToParentSpace(
    roomId: string,
    parentSpaceId: string,
    insertIndex?: number,
  ): Promise<void> {
    const matrixClient = requireClient()
    await moveChannelBetweenSpaceParents({
      roomId,
      previousParentSpaceId: null,
      nextParentSpaceId: parentSpaceId,
      insertIndex,
    })
    await waitForRoomSpaceParentLink(matrixClient, roomId, parentSpaceId)
  }

  async function createMatrixSpace(
    input: CreateMatrixSpaceInput,
  ): Promise<string> {
    const matrixClient = requireClient()
    const trimmedName = input.name.trim()
    if (!trimmedName) {
      throw new Error('Space name is required')
    }
    const topic = input.topic?.trim()
    const isPublic = input.visibility === 'public'
    const selfId = matrixClient.getUserId()
    const inviteUserIds = (input.inviteUserIds ?? []).filter(
      (matrixUserId) =>
        !selfId ||
        matrixUserId.toLowerCase() !== selfId.toLowerCase(),
    )
    const createOpts: sdk.ICreateRoomOpts = {
      name: trimmedName,
      ...(topic ? { topic } : {}),
      visibility: isPublic ? Visibility.Public : Visibility.Private,
      creation_content: { type: 'm.space' },
      ...(inviteUserIds.length > 0 ? { invite: inviteUserIds } : {}),
      initial_state: buildRoomCreateInitialState(isPublic, false),
    }
    try {
      const { room_id: roomId } = await matrixClient.createRoom(createOpts)
      if (input.parentSpaceId) {
        await linkRoomToParentSpace(
          roomId,
          input.parentSpaceId,
          input.insertIndex,
        )
      }
      return roomId
    } catch (error) {
      if (isTransportFailureWithoutMatrixBody(error)) {
        throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
      }
      throwMappedMatrixError(error, 'Could not create space')
    }
  }

  async function createGroupRoom(
    input: CreateGroupRoomInput
  ): Promise<string> {
    const matrixClient = requireClient()
    const trimmedName = input.name.trim()
    if (!trimmedName) {
      throw new Error('Room name is required')
    }
    const topic = input.topic?.trim()
    const isPublic = input.visibility === 'public'
    const encryptionReady = await ensureCryptoReady()
    const selfId = matrixClient.getUserId()
    const inviteUserIds = (input.inviteUserIds ?? []).filter(
      (matrixUserId) =>
        !selfId ||
        matrixUserId.toLowerCase() !== selfId.toLowerCase(),
    )
    const createOpts: sdk.ICreateRoomOpts = {
      name: trimmedName,
      ...(topic ? { topic } : {}),
      visibility: isPublic ? Visibility.Public : Visibility.Private,
      ...(isPublic ? { preset: Preset.PublicChat } : {}),
      is_direct: false,
      ...(inviteUserIds.length > 0 ? { invite: inviteUserIds } : {}),
      initial_state: buildRoomCreateInitialState(isPublic, encryptionReady),
    }
    try {
      const { room_id: roomId } = await matrixClient.createRoom(createOpts)
      if (input.parentSpaceId) {
        await linkRoomToParentSpace(
          roomId,
          input.parentSpaceId,
          input.insertIndex,
        )
      }
      return roomId
    } catch (error) {
      if (isTransportFailureWithoutMatrixBody(error)) {
        throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
      }
      throwMappedMatrixError(error, 'Could not create room')
    }
  }

  async function inviteUsersToRoom(
    roomId: string,
    matrixUserIds: string[],
  ): Promise<InviteUsersToRoomResult> {
    const matrixClient = requireClient()
    const selfId = matrixClient.getUserId()?.toLowerCase()
    const invited: string[] = []
    const failed: InviteUsersToRoomResult['failed'] = []
    for (const matrixUserId of matrixUserIds) {
      if (selfId && matrixUserId.toLowerCase() === selfId) {
        continue
      }
      try {
        await matrixClient.invite(roomId, matrixUserId)
        invited.push(matrixUserId)
      } catch (error) {
        failed.push({
          userId: matrixUserId,
          error:
            error instanceof Error ? error.message : String(error),
        })
      }
    }
    return { invited, failed }
  }

  async function joinRoomByIdOrAlias(roomIdOrAlias: string): Promise<string> {
    const matrixClient = requireClient()
    const trimmed = roomIdOrAlias.trim()
    if (!trimmed) {
      throw new Error('Room id or alias is required')
    }
    try {
      const room = await matrixClient.joinRoom(trimmed, {})
      return room.roomId
    } catch (error) {
      if (isTransportFailureWithoutMatrixBody(error)) {
        throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
      }
      throwMappedMatrixError(error, 'Could not join room')
    }
  }

  async function searchPublicRooms(options: {
    searchTerm?: string
    limit?: number
    since?: string
    server?: string
  }): Promise<SearchPublicRoomsResult> {
    const matrixClient = requireClient()
    const limit = options.limit ?? 30
    const term = options.searchTerm?.trim()
    try {
      if (term) {
        const response = await matrixClient.publicRooms({
          server: options.server,
          limit,
          since: options.since,
          filter: { generic_search_term: term }
        })
        return {
          rooms: mapPublicRoomsChunk(
            (response.chunk ?? []) as unknown as Array<
              Record<string, unknown>
            >
          ),
          nextBatch: response.next_batch,
          prevBatch: response.prev_batch,
          totalRoomCountEstimate: response.total_room_count_estimate
        }
      }
      const response = await matrixClient.publicRooms({
        server: options.server,
        limit,
        since: options.since
      })
      return {
        rooms: mapPublicRoomsChunk(
          (response.chunk ?? []) as unknown as Array<
            Record<string, unknown>
          >
        ),
        nextBatch: response.next_batch,
        prevBatch: response.prev_batch,
        totalRoomCountEstimate: response.total_room_count_estimate
      }
    } catch (error) {
      if (isTransportFailureWithoutMatrixBody(error)) {
        throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
      }
      throwMappedMatrixError(
        error,
        'Could not load public rooms from this homeserver'
      )
    }
  }

  async function searchUsersDirectory(options: {
    term: string
    limit?: number
  }): Promise<UserDirectoryResultItem[]> {
    const matrixClient = requireClient()
    const term = options.term.trim()
    if (term.length < 2) {
      return []
    }
    try {
      const response = await matrixClient.searchUserDirectory({
        term,
        limit: options.limit ?? 20
      })
      return (response.results ?? []).map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url
      }))
    } catch (error) {
      if (isTransportFailureWithoutMatrixBody(error)) {
        throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
      }
      throwMappedMatrixError(
        error,
        'User directory search is not available'
      )
    }
  }

  return {
    client,
    isLoggedIn,
    userId,
    sessionRestoreStatus,
    isSessionRestoreInProgress,
    isSessionRestoreFinished,
    ensureSessionRestoreCompleted,
    login,
    register,
    startEmailRegistration,
    finalizeEmailRegistration,
    clearSignupPending,
    submitSignupRecaptcha,
    signupPendingNeedsRecaptchaBeforeEmail,
    readSignupPendingPublic,
    logout,
    startDelegatedMatrixNativeOidcAuth,
    finalizeDelegatedMatrixOidcFromRedirectPayload,
    getRooms,
    getRoom,
    markRoomAsRead,
    sendRoomTyping,
    sendMessage,
    sendEditMessage,
    sendImageMessage,
    sendReaction,
    redactEvent,
    toggleReaction,
    loadOlderMessages,
    ensureCryptoReady,
    normalizeMatrixUserId,
    buildMatrixToUserLink,
    buildDirectMessageShareLink,
    buildOwnMatrixToLink,
    getOrCreateDirectMessageRoom,
    createGroupRoom,
    createMatrixSpace,
    inviteUsersToRoom,
    joinRoomByIdOrAlias,
    searchPublicRooms,
    searchUsersDirectory,
    reorderSpaceChildren,
    moveChannelBetweenSpaceParents,
    pinRoomEvent,
    unpinRoomEvent,
    updateSpaceName,
    updateSpaceTopic,
    updateSpaceAvatar,
    removeSpaceAvatar,
    updateSpaceJoinRule,
    upgradeSpaceRoom,
    saveSpaceRoles,
    incomingVerificationFromOtherOwnDeviceBeacon:
      getIncomingVerificationFromOtherOwnDeviceReadonly(),
    consumeIncomingVerificationFromOtherOwnDeviceBeacon
  }
}
