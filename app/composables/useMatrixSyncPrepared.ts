import { ClientEvent, SyncState } from 'matrix-js-sdk'
import type { MatrixClient } from 'matrix-js-sdk'

function readSyncPrepared(matrixClient: MatrixClient): boolean {
  if (matrixClient.isInitialSyncComplete?.() === true) {
    return true
  }
  return matrixClient.getSyncState?.() === SyncState.Prepared
}

/**
 * Tracks whether the Matrix client finished its initial sync. Persists across
 * route changes so chat unread UI does not reset when leaving /chat briefly.
 */
export function useMatrixSyncPrepared(
  client: Ref<MatrixClient | null>,
) {
  const syncPrepared = useState('matrix-sync-prepared', () => false)

  watch(
    () => client.value,
    (matrixClient, _previousClient, onCleanup) => {
      if (!matrixClient) {
        syncPrepared.value = false
        return
      }

      syncPrepared.value = readSyncPrepared(matrixClient)

      const onSyncState = (state: string): void => {
        if (state === SyncState.Prepared) {
          syncPrepared.value = true
        }
      }

      matrixClient.on(ClientEvent.Sync, onSyncState)
      onCleanup(() => {
        matrixClient.off(ClientEvent.Sync, onSyncState)
      })
    },
    { immediate: true },
  )

  return syncPrepared
}
