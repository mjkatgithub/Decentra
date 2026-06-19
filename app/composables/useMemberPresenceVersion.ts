import { ClientEvent, UserEvent } from 'matrix-js-sdk'
import type { MatrixClient } from 'matrix-js-sdk'

export function useMemberPresenceVersion(
  client: Ref<MatrixClient | null>,
) {
  const memberPresenceVersion = ref(0)

  function refreshMemberPresence(): void {
    memberPresenceVersion.value += 1
  }

  watch(
    () => client.value,
    (matrixClient, _previousClient, onCleanup) => {
      if (!matrixClient) {
        return
      }

      const syncHandler = (): void => {
        refreshMemberPresence()
      }

      const presenceHandler = (): void => {
        refreshMemberPresence()
      }

      matrixClient.on(ClientEvent.Sync, syncHandler)
      matrixClient.on(UserEvent.Presence, presenceHandler)
      onCleanup(() => {
        matrixClient.off(ClientEvent.Sync, syncHandler)
        matrixClient.off(UserEvent.Presence, presenceHandler)
      })
    },
    { immediate: true },
  )

  return { memberPresenceVersion }
}
