import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'
import { ClientEvent, EventType, MsgType } from 'matrix-js-sdk'
import { initAsync as initCryptoWasm } from '@matrix-org/matrix-sdk-crypto-wasm'

interface StoredMatrixSession {
  baseUrl: string
  accessToken: string
  userId: string
  deviceId?: string
}

type SessionRestoreStatus = 'idle' | 'loading' | 'success' | 'failure'

const MATRIX_SESSION_STORAGE_KEY = 'decentra.matrix.session.v1'
let cryptoWasmInitialization: Promise<void> | null = null
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

interface ReactionToggleOptions {
  ownReactionEventIds?: string[]
}

function extractUserLocalpart(userIdOrUsername: string): string {
  const normalized = userIdOrUsername.trim().toLowerCase()
  const withoutAtPrefix = normalized.startsWith('@')
    ? normalized.slice(1)
    : normalized
  return withoutAtPrefix.split(':')[0] ?? withoutAtPrefix
}

function shouldReuseStoredDeviceId(
  storedSession: StoredMatrixSession | null,
  username: string
): boolean {
  if (!storedSession?.deviceId || !storedSession.userId) {
    return false
  }
  const normalizedUsername = username.trim().toLowerCase()
  if (normalizedUsername.startsWith('@')) {
    return storedSession.userId.toLowerCase() === normalizedUsername
  }
  return extractUserLocalpart(storedSession.userId) ===
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

  async function initializeClientFromStoredSession(): Promise<void> {
    if (client.value) {
      return
    }
    const session = readStoredSession()
    if (!session) {
      return
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
    const authClient = sdk.createClient({ baseUrl })
    const storedSession = readStoredSession()
    const authData = await authClient.loginRequest({
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: username
      },
      password,
      device_id: shouldReuseStoredDeviceId(storedSession, username)
        ? storedSession?.deviceId
        : undefined
    })
    const deviceId = authData.device_id

    const newClient = sdk.createClient({
      baseUrl,
      accessToken: authData.access_token,
      userId: authData.user_id,
      deviceId
    })

    if (!deviceId) {
      console.warn('Missing device_id in login response; skipping Rust crypto init')
    } else {
      await initRustCryptoWithRecovery(newClient, 'during login')
    }

    newClient.startClient({ initialSyncLimit: 50 })
    client.value = newClient
    writeStoredSession({
      baseUrl,
      accessToken: authData.access_token,
      userId: authData.user_id,
      deviceId
    })
  }

  function logout(): void {
    if (client.value) {
      client.value.stopClient()
      client.value = null
    }
    clearStoredSession()
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

  async function sendMessage(
    roomId: string,
    body: string,
    replyTo?: MessageReplyOptions
  ): Promise<void> {
    if (!client.value) throw new Error('Not logged in')
    const content: Record<string, any> = {
      msgtype: MsgType.Text,
      body
    }

    if (replyTo?.eventId) {
      content['m.relates_to'] = {
        'm.in_reply_to': {
          event_id: replyTo.eventId
        }
      }
    }

    await client.value.sendEvent(
      roomId,
      EventType.RoomMessage,
      content as any
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

  return {
    client,
    isLoggedIn,
    userId,
    sessionRestoreStatus,
    isSessionRestoreInProgress,
    isSessionRestoreFinished,
    ensureSessionRestoreCompleted,
    login,
    logout,
    getRooms,
    getRoom,
    sendMessage,
    sendImageMessage,
    sendReaction,
    redactEvent,
    toggleReaction,
    loadOlderMessages,
    ensureCryptoReady
  }
}
