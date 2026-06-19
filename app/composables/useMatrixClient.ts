import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'
import { matrixRoomHasJoinedMembership } from '~/utils/matrixRoomChannelPermissions'
import {
  HOMESERVER_CONNECTION_HINT_ERROR,
  extractUserLocalpart,
  isSameHomeserver,
  isTransportFailureWithoutMatrixBody,
  readMatrixErrorMessage,
  resolveHomeserverBaseUrlForClient,
} from './matrix/matrixClientShared'
export {
  HOMESERVER_CONNECTION_HINT_ERROR,
  extractUserLocalpart,
  isSameHomeserver,
  resolveHomeserverBaseUrlForClient,
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
  SIGNUP_UNAVAILABLE_ERROR,
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
  SIGNUP_UNAVAILABLE_ERROR,
}
export type { SignupPendingStateV1 } from './matrix/matrixRegistrationUia'
export type { SignupTermsPolicyItem } from './matrix/matrixRegistrationUia'

const MATRIX_START_CLIENT_OPTS = {
  initialSyncLimit: 50,
  disablePresence: true,
} as const
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
  isTermsStage,
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
  type MatrixOidcIntent,
} from './matrix/matrixOidcNative'

export {
  MATRIX_DELEGATED_OIDC_CALLBACK_RELATIVE_PATH,
  fetchMatrixDelegatedClientHints,
  MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR,
  MATRIX_OIDC_INVALID_CALLBACK_ERROR,
  MATRIX_OIDC_NO_DELEGATED_AUTH_ERROR,
  MATRIX_OIDC_REGISTRATION_REJECTED_ERROR,
  MATRIX_OIDC_STATE_STORAGE_PREFIX,
} from './matrix/matrixOidcNative'

export type {
  CreateGroupRoomInput,
  CreateMatrixSpaceInput,
  InviteUsersToRoomResult,
  PublicRoomListItem,
  SearchPublicRoomsResult,
  SendAudioMessageOptions,
  SendImageMessageOptions,
  SendTextMessageOptions,
  SendVideoMessageOptions,
  UserDirectoryResultItem,
} from './matrix/matrixClientTypes'

export {
  buildMatrixToUserLink,
  normalizeMatrixUserId,
} from './matrix/matrixClientHelpers'

export {
  consumeIncomingVerificationFromOtherOwnDeviceBeacon,
  getIncomingVerificationFromOtherOwnDeviceReadonly,
  syncMatrixIncomingVerificationRelay,
} from './matrix/sessionCrypto'

import type {
  CreateGroupRoomInput,
  CreateMatrixSpaceInput,
  InviteUsersToRoomResult,
  MessageReplyOptions,
  ReactionToggleOptions,
  SearchPublicRoomsResult,
  SendAudioMessageOptions,
  SendImageMessageOptions,
  SendTextMessageOptions,
  SendVideoMessageOptions,
  SessionRestoreStatus,
  UserDirectoryResultItem,
} from './matrix/matrixClientTypes'
import {
  buildMatrixToUserLink,
  homeserverFromUserId,
  normalizeMatrixUserId,
} from './matrix/matrixClientHelpers'
import {
  clearStoredSession,
  consumeIncomingVerificationFromOtherOwnDeviceBeacon,
  getIncomingVerificationFromOtherOwnDeviceReadonly,
  initRustCryptoWithRecovery,
  readStoredDevice,
  readStoredSession,
  shouldReuseStoredDeviceId,
  syncMatrixIncomingVerificationRelay,
  writeStoredDevice,
  writeStoredSession,
} from './matrix/sessionCrypto'
import {
  setMatrixPresenceWithRetry,
  writeStoredMatrixPresence,
} from '~/utils/matrixPresencePreference'
import * as matrixMessages from './matrix/messages'
import * as matrixRooms from './matrix/roomsOrDirectory'
import { MATRIX_TO_BASE } from './matrix/matrixClientHelpers'

let sessionRestorePromise: Promise<void> | null = null

export function useMatrixClient() {
  const client = useState<MatrixClient | null>('matrix-client', () => null)
  const sessionRestoreStatus = useState<SessionRestoreStatus>(
    'matrix-client-restore-status',
    () => 'idle',
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
            clientId: session.oidcClientId,
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
            oauthTokenExpiresAtMs: expiresMs,
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
      deviceId: session.deviceId,
    })
    if (session.deviceId) {
      await initRustCryptoWithRecovery(restoredClient, 'for restored session')
    }
    restoredClient.startClient(MATRIX_START_CLIENT_OPTS)
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
    password: string,
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
        username,
      )
      const preferredDeviceId = shouldReuseDeviceId
        ? storedSession?.deviceId || storedDevice?.deviceId
        : undefined
      const loginLocalpart = extractUserLocalpart(username)
      const authData = await authClient.loginRequest({
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: loginLocalpart,
        },
        password,
        device_id: preferredDeviceId,
      })
      const deviceId = authData.device_id

      const newClient = sdk.createClient({
        baseUrl: resolvedBaseUrl,
        accessToken: authData.access_token,
        userId: authData.user_id,
        deviceId,
      })

      if (!deviceId) {
        console.warn(
          'Missing device_id in login response; skipping Rust crypto init',
        )
      } else {
        await initRustCryptoWithRecovery(newClient, 'during login')
      }

      newClient.startClient(MATRIX_START_CLIENT_OPTS)
      client.value = newClient
      writeStoredMatrixPresence('online')
      void setMatrixPresenceWithRetry(newClient, 'online').catch(() => {})
      syncMatrixIncomingVerificationRelay(newClient)
      writeStoredSession({
        baseUrl: resolvedBaseUrl,
        accessToken: authData.access_token,
        userId: authData.user_id,
        deviceId,
      })
      if (deviceId) {
        writeStoredDevice({
          baseUrl: resolvedBaseUrl,
          userId: authData.user_id,
          deviceId,
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
    email?: string,
  ): Promise<void> {
    const trimmedEmail = email?.trim() || ''
    if (trimmedEmail) {
      await startEmailRegistration(
        baseUrl,
        username,
        password,
        trimmedEmail,
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
      String(runtimeCfg.public.siteUrl || '').trim(),
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
        runtimeCfg.public.matrixOidcClientId || '',
      ).trim(),
      callbackPath: MATRIX_DELEGATED_OIDC_CALLBACK_RELATIVE_PATH,
      intent: payload.intent,
    })
  }

  async function finalizeDelegatedMatrixOidcFromRedirectPayload(
    payload: { code: string; state: string },
  ): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error(MATRIX_OIDC_INVALID_CALLBACK_ERROR)
    }
    const exchanged = await exchangeNativeOidcAuthorizationCode({
      code: payload.code,
      state: payload.state,
    })
    const identity = await fetchMatrixWhoAmI(
      exchanged.pending.matrixClientApiBaseUrl,
      exchanged.tokens.accessToken,
    )
    const ttlSeconds = exchanged.tokens.expiresInSeconds ?? 300
    const oauthExpiresAtMs = Date.now() + ttlSeconds * 1000
    const deviceLit = exchanged.pending.oidcDeviceId
    const matrixApiBase = exchanged.pending.matrixClientApiBaseUrl
    const delegatedClient = sdk.createClient({
      baseUrl: matrixApiBase,
      accessToken: exchanged.tokens.accessToken,
      userId: identity.userId,
      deviceId: deviceLit,
    })
    await initRustCryptoWithRecovery(
      delegatedClient,
      'during delegated OIDC',
    )
    delegatedClient.startClient(MATRIX_START_CLIENT_OPTS)
    writeStoredMatrixPresence('online')
    void setMatrixPresenceWithRetry(delegatedClient, 'online').catch(() => {})
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
      oidcClientId: exchanged.pending.oauthClientId,
    })
    writeStoredDevice({
      baseUrl: matrixApiBase,
      userId: identity.userId,
      deviceId: deviceLit,
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
        'on demand',
      )
      if (!initialized) {
        return false
      }
    } catch {
      return false
    }
    return Boolean(matrixClient.getCrypto?.())
  }

  function requireClient(): MatrixClient {
    const matrixClient = client.value
    if (!matrixClient) {
      throw new Error('Not logged in')
    }
    return matrixClient
  }

  function getRooms(): sdk.Room[] {
    if (!client.value) {
      return []
    }
    return client.value
      .getRooms()
      .filter((room) => matrixRoomHasJoinedMembership(room))
  }

  function getRoom(roomId: string): sdk.Room | null {
    return client.value?.getRoom(roomId) ?? null
  }

  async function markRoomAsRead(roomId: string): Promise<void> {
    const matrixClient = client.value
    if (!matrixClient) {
      return
    }
    return matrixMessages.markRoomAsRead(matrixClient, roomId)
  }

  async function markThreadAsRead(
    roomId: string,
    threadRootEventId: string,
  ): Promise<void> {
    const matrixClient = client.value
    if (!matrixClient) {
      return
    }
    return matrixMessages.markThreadAsRead(
      matrixClient,
      roomId,
      threadRootEventId,
    )
  }

  async function sendRoomTyping(
    roomId: string,
    isTyping: boolean,
    timeoutMs: number,
  ): Promise<void> {
    if (!client.value) {
      return
    }
    return matrixMessages.sendRoomTyping(
      client.value,
      roomId,
      isTyping,
      timeoutMs,
    )
  }

  async function sendMessage(
    roomId: string,
    body: string,
    options?: MessageReplyOptions | SendTextMessageOptions,
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    return matrixMessages.sendMessage(
      client.value,
      roomId,
      body,
      options,
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
    return matrixMessages.sendEditMessage(
      client.value,
      roomId,
      newBody,
      targetEventId,
    )
  }

  async function sendImageMessage(
    roomId: string,
    imageFile: File | Blob,
    fileName = 'image',
    options?: SendImageMessageOptions,
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    return matrixMessages.sendImageMessage(
      client.value,
      roomId,
      imageFile,
      fileName,
      options,
      ensureCryptoReady,
    )
  }

  async function sendAudioMessage(
    roomId: string,
    audioFile: File | Blob,
    fileName = 'voice-message',
    options?: SendAudioMessageOptions,
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    return matrixMessages.sendAudioMessage(
      client.value,
      roomId,
      audioFile,
      fileName,
      options,
      ensureCryptoReady,
    )
  }

  async function sendVideoMessage(
    roomId: string,
    videoFile: File | Blob,
    fileName = 'video',
    options?: SendVideoMessageOptions,
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    return matrixMessages.sendVideoMessage(
      client.value,
      roomId,
      videoFile,
      fileName,
      options,
      ensureCryptoReady,
    )
  }

  async function loadOlderMessages(roomId: string): Promise<boolean> {
    if (!client.value) {
      return false
    }
    return matrixMessages.loadOlderMessages(client.value, roomId)
  }

  async function sendReaction(
    roomId: string,
    eventId: string,
    emoji: string,
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    return matrixMessages.sendReaction(
      client.value,
      roomId,
      eventId,
      emoji,
    )
  }

  async function redactEvent(
    roomId: string,
    reactionEventId: string,
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    return matrixMessages.redactEvent(
      client.value,
      roomId,
      reactionEventId,
    )
  }

  async function toggleReaction(
    roomId: string,
    messageEventId: string,
    emoji: string,
    options?: ReactionToggleOptions | string[],
  ): Promise<void> {
    if (!client.value) {
      throw new Error('Not logged in')
    }
    return matrixMessages.toggleReaction(
      client.value,
      roomId,
      messageEventId,
      emoji,
      options,
    )
  }

  async function reorderSpaceChildren(
    parentSpaceId: string,
    orderedChildRoomIds: string[],
  ): Promise<void> {
    return matrixRooms.reorderSpaceChildren(
      requireClient(),
      parentSpaceId,
      orderedChildRoomIds,
    )
  }

  async function moveChannelBetweenSpaceParents(options: {
    roomId: string
    previousParentSpaceId: string | null
    nextParentSpaceId: string
    insertIndex?: number
  }): Promise<void> {
    return matrixRooms.moveChannelBetweenSpaceParents(
      requireClient(),
      options,
    )
  }

  async function pinRoomEvent(
    roomId: string,
    eventId: string,
  ): Promise<void> {
    return matrixRooms.pinRoomEvent(requireClient(), roomId, eventId)
  }

  async function unpinRoomEvent(
    roomId: string,
    eventId: string,
  ): Promise<void> {
    return matrixRooms.unpinRoomEvent(requireClient(), roomId, eventId)
  }

  async function updateSpaceName(
    spaceId: string,
    name: string,
  ): Promise<void> {
    return matrixRooms.updateSpaceName(requireClient(), spaceId, name)
  }

  async function updateSpaceTopic(
    spaceId: string,
    topic: string,
  ): Promise<void> {
    return matrixRooms.updateSpaceTopic(requireClient(), spaceId, topic)
  }

  async function updateSpaceAvatar(
    spaceId: string,
    imageFile: File,
  ): Promise<void> {
    return matrixRooms.updateSpaceAvatar(
      requireClient(),
      spaceId,
      imageFile,
    )
  }

  async function removeSpaceAvatar(spaceId: string): Promise<void> {
    return matrixRooms.removeSpaceAvatar(requireClient(), spaceId)
  }

  async function updateSpaceJoinRule(
    spaceId: string,
    joinRule: Parameters<typeof matrixRooms.updateSpaceJoinRule>[2],
  ): Promise<void> {
    return matrixRooms.updateSpaceJoinRule(
      requireClient(),
      spaceId,
      joinRule,
    )
  }

  async function upgradeSpaceRoom(
    spaceId: string,
    targetVersion: string,
  ): Promise<void> {
    return matrixRooms.upgradeSpaceRoom(
      requireClient(),
      spaceId,
      targetVersion,
    )
  }

  async function saveSpaceRoles(
    spaceId: string,
    content: SpaceRolesState,
    childRoomIds: string[] = [],
    scrubPowerLevel?: number,
  ): Promise<void> {
    return matrixRooms.saveSpaceRoles(
      requireClient(),
      spaceId,
      content,
      childRoomIds,
      scrubPowerLevel,
    )
  }

  async function getOrCreateDirectMessageRoom(
    rawUserId: string,
  ): Promise<string> {
    return matrixRooms.getOrCreateDirectMessageRoom(
      requireClient(),
      rawUserId,
      ensureCryptoReady,
    )
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

  async function createMatrixSpace(
    input: CreateMatrixSpaceInput,
  ): Promise<string> {
    return matrixRooms.createMatrixSpace(requireClient(), input)
  }

  async function createGroupRoom(
    input: CreateGroupRoomInput,
  ): Promise<string> {
    return matrixRooms.createGroupRoom(
      requireClient(),
      input,
      ensureCryptoReady,
    )
  }

  async function inviteUsersToRoom(
    roomId: string,
    matrixUserIds: string[],
  ): Promise<InviteUsersToRoomResult> {
    return matrixRooms.inviteUsersToRoom(
      requireClient(),
      roomId,
      matrixUserIds,
    )
  }

  async function joinRoomByIdOrAlias(
    roomIdOrAlias: string,
  ): Promise<string> {
    return matrixRooms.joinRoomByIdOrAlias(
      requireClient(),
      roomIdOrAlias,
    )
  }

  async function leaveRoom(roomId: string): Promise<void> {
    return matrixRooms.leaveRoom(requireClient(), roomId)
  }

  async function searchPublicRooms(options: {
    searchTerm?: string
    limit?: number
    since?: string
    server?: string
  }): Promise<SearchPublicRoomsResult> {
    return matrixRooms.searchPublicRooms(requireClient(), options)
  }

  async function searchUsersDirectory(options: {
    term: string
    limit?: number
  }): Promise<UserDirectoryResultItem[]> {
    return matrixRooms.searchUsersDirectory(requireClient(), options)
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
    markThreadAsRead,
    sendRoomTyping,
    sendMessage,
    sendEditMessage,
    sendImageMessage,
    sendVideoMessage,
    sendAudioMessage,
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
    leaveRoom,
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
    consumeIncomingVerificationFromOtherOwnDeviceBeacon,
  }
}
