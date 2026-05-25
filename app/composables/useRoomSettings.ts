import type { Room } from 'matrix-js-sdk'
import { useMatrixClient } from '~/composables/useMatrixClient'
import {
  canUserSetRoomName,
  canUserSetRoomTopic,
} from '~/utils/matrixRoomMetadataPermissions'
import {
  getRoomNameFromState,
  getRoomTopicFromState,
  setRoomName,
  setRoomTopic,
} from '~/utils/matrixRoomMetadata'

export function useRoomSettings(roomId: Ref<string>) {
  const { client, userId } = useMatrixClient()

  const matrixRoom = computed<Room | null>(() => {
    if (!roomId.value || !client.value) {
      return null
    }
    return client.value.getRoom(roomId.value) ?? null
  })

  const isEditing = ref(false)
  const editableName = ref('')
  const editableTopic = ref('')
  const feedbackMessage = ref('')
  const feedbackTone = ref<'success' | 'error'>('success')
  const isSaving = ref(false)

  const displayName = computed(() => {
    const room = matrixRoom.value
    if (!room) {
      return ''
    }
    return getRoomNameFromState(room) || room.name || roomId.value
  })

  const displayTopic = computed(() => {
    const room = matrixRoom.value
    if (!room) {
      return ''
    }
    return getRoomTopicFromState(room) || ''
  })

  const permissions = computed(() => {
    const matrixClient = client.value
    const id = roomId.value
    const matrixUserId = userId.value
    return {
      name: matrixClient
        ? canUserSetRoomName(matrixClient, id, matrixUserId)
        : false,
      topic: matrixClient
        ? canUserSetRoomTopic(matrixClient, id, matrixUserId)
        : false,
    }
  })

  const canEdit = computed(
    () => permissions.value.name || permissions.value.topic,
  )

  function startEdit() {
    editableName.value = displayName.value
    editableTopic.value = displayTopic.value
    isEditing.value = true
    feedbackMessage.value = ''
  }

  function cancelEdit() {
    isEditing.value = false
    feedbackMessage.value = ''
  }

  async function saveProfile(): Promise<void> {
    const matrixClient = client.value
    const id = roomId.value
    if (!matrixClient || !id) {
      return
    }
    isSaving.value = true
    feedbackMessage.value = ''
    try {
      if (permissions.value.name) {
        await setRoomName(matrixClient, id, editableName.value)
      }
      if (permissions.value.topic) {
        await setRoomTopic(matrixClient, id, editableTopic.value)
      }
      isEditing.value = false
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

  watch(roomId, () => {
    isEditing.value = false
    feedbackMessage.value = ''
  })

  return {
    matrixRoom,
    displayName,
    displayTopic,
    editableName,
    editableTopic,
    isEditing,
    permissions,
    canEdit,
    feedbackMessage,
    feedbackTone,
    isSaving,
    startEdit,
    cancelEdit,
    saveProfile,
  }
}
