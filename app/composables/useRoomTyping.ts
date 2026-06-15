import { ClientEvent, RoomMemberEvent } from 'matrix-js-sdk'
import type { MatrixClient } from 'matrix-js-sdk'
import { useAppI18n } from '~/composables/useAppI18n'
import {
  buildTypingIndicatorLabel,
  getTypingMembers,
} from '~/utils/typingIndicator'

export function useRoomTyping(options: {
  client: Ref<MatrixClient | null>
  selectedRoomId: Ref<string | null>
  userId: Ref<string | null | undefined>
}) {
  const { translateText } = useAppI18n()
  const typingVersion = ref(0)

  function refreshTyping(): void {
    typingVersion.value += 1
  }

  const typingLabel = computed(() => {
    typingVersion.value
    const roomId = options.selectedRoomId.value
    const matrixClient = options.client.value
    if (!roomId || !matrixClient) {
      return null
    }
    const room = matrixClient.getRoom(roomId)
    if (!room) {
      return null
    }
    const members = getTypingMembers(
      room as never,
      options.userId.value ?? null,
    )
    return buildTypingIndicatorLabel(members, translateText)
  })

  watch(
    () => options.selectedRoomId.value,
    () => {
      refreshTyping()
    },
  )

  watch(
    () => options.client.value,
    (matrixClient, _previousClient, onCleanup) => {
      if (!matrixClient) {
        return
      }

      const typingHandler = (
        _event: unknown,
        member: { roomId?: string },
      ): void => {
        if (member.roomId === options.selectedRoomId.value) {
          refreshTyping()
        }
      }

      const syncHandler = (): void => {
        refreshTyping()
      }

      matrixClient.on(RoomMemberEvent.Typing, typingHandler)
      matrixClient.on(ClientEvent.Sync, syncHandler)
      onCleanup(() => {
        matrixClient.off(RoomMemberEvent.Typing, typingHandler)
        matrixClient.off(ClientEvent.Sync, syncHandler)
      })
    },
    { immediate: true },
  )

  return { typingLabel }
}
