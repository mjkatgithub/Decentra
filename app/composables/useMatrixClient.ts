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

const MATRIX_SESSION_STORAGE_KEY = 'decentra.matrix.session.v1'
let cryptoWasmInitialization: Promise<void> | null = null

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

export function useMatrixClient() {
  const client = useState<MatrixClient | null>('matrix-client', () => null)
  const restoreAttempted = useState<boolean>(
    'matrix-client-restore-attempted',
    () => false
  )
  const isLoggedIn = computed(() => client.value !== null)
  const userId = computed(() => client.value?.getUserId() ?? null)

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

  if (typeof window !== 'undefined' && !restoreAttempted.value) {
    restoreAttempted.value = true
    void initializeClientFromStoredSession()
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

  async function sendMessage(roomId: string, body: string): Promise<void> {
    if (!client.value) throw new Error('Not logged in')
    await client.value.sendEvent(roomId, EventType.RoomMessage, {
      msgtype: MsgType.Text,
      body
    })
  }

  async function loadOlderMessages(roomId: string): Promise<boolean> {
    const room = client.value?.getRoom(roomId)
    if (!room || !client.value) return false
    const timeline = room.getLiveTimeline()
    return client.value.paginateEventTimeline(timeline, { backwards: true })
  }

  return {
    client,
    isLoggedIn,
    userId,
    login,
    logout,
    getRooms,
    getRoom,
    sendMessage,
    loadOlderMessages,
    ensureCryptoReady
  }
}
