import { describe, expect, it } from 'vitest'
import { ClientEvent, SyncState } from 'matrix-js-sdk'
import { ref } from 'vue'
import { useMatrixSyncPrepared } from '~/composables/useMatrixSyncPrepared'

describe('useMatrixSyncPrepared', () => {
  it('starts false without a client', () => {
    const client = ref(null)
    const syncPrepared = useMatrixSyncPrepared(client)
    expect(syncPrepared.value).toBe(false)
  })

  it('reads prepared state from an already synced client', () => {
    const matrixClient = {
      isInitialSyncComplete: () => true,
      getSyncState: () => SyncState.Prepared,
      on: () => undefined,
      off: () => undefined,
    }
    const client = ref(matrixClient as never)
    const syncPrepared = useMatrixSyncPrepared(client)
    expect(syncPrepared.value).toBe(true)
  })

  it('becomes true when Sync PREPARED fires', () => {
    const handlers = new Map<string, (state: string) => void>()
    const matrixClient = {
      isInitialSyncComplete: () => false,
      getSyncState: () => SyncState.Syncing,
      on: (event: string, handler: (state: string) => void) => {
        handlers.set(event, handler)
      },
      off: (event: string) => {
        handlers.delete(event)
      },
    }
    const client = ref(matrixClient as never)
    const syncPrepared = useMatrixSyncPrepared(client)
    expect(syncPrepared.value).toBe(false)

    handlers.get(ClientEvent.Sync)?.(SyncState.Prepared)
    expect(syncPrepared.value).toBe(true)
  })

  it('resets when the client is cleared', async () => {
    const matrixClient = {
      isInitialSyncComplete: () => true,
      getSyncState: () => SyncState.Prepared,
      on: () => undefined,
      off: () => undefined,
    }
    const client = ref(matrixClient as never)
    const syncPrepared = useMatrixSyncPrepared(client)
    expect(syncPrepared.value).toBe(true)

    client.value = null
    await Promise.resolve()
    expect(syncPrepared.value).toBe(false)
  })
})
