import { ClientEvent, SyncState } from 'matrix-js-sdk'

const MATRIX_PRESENCE_STORAGE_KEY = 'decentra.matrix.presence.v1'

export type StoredMatrixPresence =
  | 'online'
  | 'offline'
  | 'unavailable'
  | 'org.matrix.msc3026.busy'

export function isStoredMatrixPresence(
  value: unknown,
): value is StoredMatrixPresence {
  return (
    value === 'online' ||
    value === 'offline' ||
    value === 'unavailable' ||
    value === 'org.matrix.msc3026.busy'
  )
}

export function readStoredMatrixPresence(): StoredMatrixPresence | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const rawValue = window.localStorage.getItem(MATRIX_PRESENCE_STORAGE_KEY)
    if (!rawValue) {
      return null
    }
    const parsed = JSON.parse(rawValue) as { presence?: unknown }
    if (isStoredMatrixPresence(parsed.presence)) {
      return parsed.presence
    }
    return null
  } catch {
    return null
  }
}

export function writeStoredMatrixPresence(
  presence: StoredMatrixPresence,
): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(
    MATRIX_PRESENCE_STORAGE_KEY,
    JSON.stringify({ presence }),
  )
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds)
  })
}

function isPresenceRateLimited(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('M_LIMIT_EXCEEDED') || message.includes('429')
}

export async function waitForMatrixClientSyncPrepared(
  matrixClient: {
    getSyncState?: () => string | null
    isInitialSyncComplete?: () => boolean
    on: (event: string, handler: (state: string) => void) => void
    off: (event: string, handler: (state: string) => void) => void
  },
): Promise<void> {
  if (
    matrixClient.isInitialSyncComplete?.() === true ||
    matrixClient.getSyncState?.() === SyncState.Prepared
  ) {
    return
  }
  await new Promise<void>((resolvePromise) => {
    const handler = (state: string) => {
      if (state === SyncState.Prepared) {
        matrixClient.off(ClientEvent.Sync, handler)
        resolvePromise()
      }
    }
    matrixClient.on(ClientEvent.Sync, handler)
  })
}

export async function setMatrixPresenceWithRetry(
  matrixClient: {
    setPresence: (options: {
      presence: 'online' | 'offline' | 'unavailable'
    }) => Promise<void>
  },
  presence: StoredMatrixPresence,
  maxAttempts = 5,
): Promise<void> {
  if (presence === 'org.matrix.msc3026.busy') {
    return
  }
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await matrixClient.setPresence({ presence })
      return
    } catch (error) {
      lastError = error
      if (!isPresenceRateLimited(error) || attempt >= maxAttempts - 1) {
        throw error
      }
      await sleep(1500 * (attempt + 1))
    }
  }
  throw lastError
}
