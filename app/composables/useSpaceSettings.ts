import type { MatrixClient, Room } from 'matrix-js-sdk'
import { useMatrixClient } from '~/composables/useMatrixClient'
import { useChatMedia } from '~/composables/useChatMedia'
import {
  canUserSetRoomAvatar,
  canUserSetRoomName,
  canUserSetRoomTopic,
} from '~/utils/matrixRoomMetadataPermissions'
import {
  getRoomAvatarMxcFromState,
  getRoomNameFromState,
  getRoomTopicFromState,
} from '~/utils/matrixRoomMetadata'

export function useSpaceSettings(spaceId: Ref<string>) {
  const { client, userId, updateSpaceName, updateSpaceTopic, updateSpaceAvatar,
    removeSpaceAvatar } = useMatrixClient()
  const { getSpaceAvatarUrl } = useChatMedia(client)

  const spaceRoom = computed<Room | null>(() => {
    if (!spaceId.value || !client.value) {
      return null
    }
    return client.value.getRoom(spaceId.value) ?? null
  })

  const editableName = ref('')
  const editableTopic = ref('')
  const feedbackMessage = ref('')
  const feedbackTone = ref<'success' | 'error'>('success')
  const isSaving = ref(false)

  const permissions = computed(() => {
    const matrixClient = client.value
    const roomId = spaceId.value
    const matrixUserId = userId.value
    return {
      name: matrixClient
        ? canUserSetRoomName(matrixClient, roomId, matrixUserId)
        : false,
      topic: matrixClient
        ? canUserSetRoomTopic(matrixClient, roomId, matrixUserId)
        : false,
      avatar: matrixClient
        ? canUserSetRoomAvatar(matrixClient, roomId, matrixUserId)
        : false,
    }
  })

  const avatarPreviewUrl = computed(() => {
    const room = spaceRoom.value
    if (!room) {
      return undefined
    }
    return getSpaceAvatarUrl(room)
  })

  function syncFormFromRoom() {
    const room = spaceRoom.value
    if (!room) {
      return
    }
    editableName.value =
      getRoomNameFromState(room) || room.name || spaceId.value
    editableTopic.value = getRoomTopicFromState(room)
  }

  watch(spaceRoom, () => syncFormFromRoom(), { immediate: true })

  watch(
    () => spaceRoom.value?.getLiveTimeline?.()?.getEvents?.()?.length,
    () => syncFormFromRoom(),
  )

  async function saveProfile(avatarFile: File | null): Promise<void> {
    if (!spaceId.value) {
      return
    }
    isSaving.value = true
    feedbackMessage.value = ''
    try {
      if (permissions.value.name) {
        await updateSpaceName(spaceId.value, editableName.value)
      }
      if (permissions.value.topic) {
        await updateSpaceTopic(spaceId.value, editableTopic.value)
      }
      if (avatarFile && permissions.value.avatar) {
        await updateSpaceAvatar(spaceId.value, avatarFile)
      }
      feedbackTone.value = 'success'
      feedbackMessage.value = 'saved'
      syncFormFromRoom()
    } catch (thrownError) {
      feedbackTone.value = 'error'
      feedbackMessage.value =
        thrownError instanceof Error
          ? thrownError.message
          : String(thrownError)
    } finally {
      isSaving.value = false
    }
  }

  async function clearAvatar(): Promise<void> {
    if (!spaceId.value || !permissions.value.avatar) {
      return
    }
    isSaving.value = true
    try {
      await removeSpaceAvatar(spaceId.value)
      feedbackTone.value = 'success'
      feedbackMessage.value = 'saved'
    } catch (thrownError) {
      feedbackTone.value = 'error'
      feedbackMessage.value =
        thrownError instanceof Error
          ? thrownError.message
          : String(thrownError)
    } finally {
      isSaving.value = false
    }
  }

  return {
    spaceRoom,
    editableName,
    editableTopic,
    permissions,
    avatarPreviewUrl,
    feedbackMessage,
    feedbackTone,
    isSaving,
    saveProfile,
    clearAvatar,
    syncFormFromRoom,
  }
}
