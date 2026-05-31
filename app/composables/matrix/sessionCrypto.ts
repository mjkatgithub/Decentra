import type { MatrixClient } from 'matrix-js-sdk'
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api'
import { initAsync as initCryptoWasm } from '@matrix-org/matrix-sdk-crypto-wasm'
import { readonly, shallowRef } from 'vue'
import {
  extractUserLocalpart,
  isSameHomeserver,
} from './matrixClientShared'
import type {
  StoredMatrixDevice,
  StoredMatrixSession,
} from './matrixClientTypes'

export const MATRIX_SESSION_STORAGE_KEY = 'decentra.matrix.session.v1'
export const MATRIX_DEVICE_STORAGE_KEY = 'decentra.matrix.device.v1'

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
  request: unknown,
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
  matrixClient: MatrixClient | null,
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
        onMatrixVerificationRelayRequestReceived,
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
    onMatrixVerificationRelayRequestReceived,
  )
}

export async function bootstrapRustCrossSigningIfNeeded(
  matrixClient: MatrixClient,
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

export function shouldReuseStoredDeviceId(
  storedSession: StoredMatrixSession | null,
  storedDevice: StoredMatrixDevice | null,
  baseUrl: string,
  username: string,
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

export function isCryptoStoreAccountMismatch(error: unknown): boolean {
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
    'matrix-js-sdk::matrix-sdk-crypto',
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

export async function ensureCryptoWasmInitialized(): Promise<void> {
  if (!cryptoWasmInitialization) {
    cryptoWasmInitialization = initCryptoWasm()
      .catch((error) => {
        cryptoWasmInitialization = null
        throw error
      })
  }
  await cryptoWasmInitialization
}

export function readStoredSession(): StoredMatrixSession | null {
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

export function writeStoredSession(session: StoredMatrixSession): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(
    MATRIX_SESSION_STORAGE_KEY,
    JSON.stringify(session),
  )
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(MATRIX_SESSION_STORAGE_KEY)
}

export function readStoredDevice(): StoredMatrixDevice | null {
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

export function writeStoredDevice(device: StoredMatrixDevice): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(
    MATRIX_DEVICE_STORAGE_KEY,
    JSON.stringify(device),
  )
}

export async function initRustCryptoWithRecovery(
  matrixClient: MatrixClient,
  context: string,
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
        retryError,
      )
      return false
    }
  }
}
