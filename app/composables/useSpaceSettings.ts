import type { MatrixClient, Room } from 'matrix-js-sdk'
import { JoinRule, RoomEvent } from 'matrix-js-sdk'
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
import {
  canSetJoinRule,
  readDirectoryVisibility,
  readJoinRuleFromRoom,
  readPublishedAddresses,
  readRoomVersion,
  setDirectoryVisibility,
  setSpaceJoinRule,
  type SpaceAccessRule,
} from '~/utils/matrixSpaceGeneralSettings'
import { isSpaceRoomFounder } from '~/utils/spaceRolesMatrixSync'

export function useSpaceSettings(spaceId: Ref<string>) {
  const {
    client,
    userId,
    updateSpaceName,
    updateSpaceTopic,
    updateSpaceAvatar,
    removeSpaceAvatar,
    updateSpaceJoinRule,
    upgradeSpaceRoom,
  } = useMatrixClient()
  const { getSpaceAvatarUrl } = useChatMedia(client)

  const spaceRoom = computed<Room | null>(() => {
    if (!spaceId.value || !client.value) {
      return null
    }
    return client.value.getRoom(spaceId.value) ?? null
  })

  const isProfileEditing = ref(false)
  const localAddressesExpanded = ref(false)
  const editableName = ref('')
  const editableTopic = ref('')
  const joinRule = ref<SpaceAccessRule>(JoinRule.Invite)
  const directoryPublished = ref(false)
  const roomVersionLabel = ref('')
  const recommendedVersion = ref<{
    version: string
    needsUpgrade: boolean
    urgent: boolean
  } | null>(null)
  const feedbackMessage = ref('')
  const feedbackTone = ref<'success' | 'error'>('success')
  const isSaving = ref(false)
  const isSavingOptions = ref(false)
  const isUpgrading = ref(false)

  const displayName = computed(() => {
    const room = spaceRoom.value
    if (!room) {
      return ''
    }
    return getRoomNameFromState(room) || room.name || spaceId.value
  })

  const displayTopic = computed(() => {
    const room = spaceRoom.value
    if (!room) {
      return ''
    }
    return getRoomTopicFromState(room) || ''
  })

  const publishedAddresses = computed(() =>
    readPublishedAddresses(spaceRoom.value),
  )

  const publishToDirectory = computed(() => directoryPublished.value)

  async function refreshDirectoryPublished(): Promise<void> {
    const matrixClient = client.value
    if (!matrixClient || !spaceId.value) {
      directoryPublished.value = false
      return
    }
    directoryPublished.value = await readDirectoryVisibility(
      matrixClient,
      spaceId.value,
    )
  }

  const canManageGeneral = computed(() => {
    const matrixClient = client.value
    const roomId = spaceId.value
    const matrixUserId = userId.value
    if (!matrixClient || !roomId || !matrixUserId) {
      return false
    }
    if (isSpaceRoomFounder(matrixClient, roomId, matrixUserId)) {
      return true
    }
    return canSetJoinRule(matrixClient, roomId, matrixUserId)
  })

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
    joinRule.value = readJoinRuleFromRoom(room)
    roomVersionLabel.value = readRoomVersion(room)
  }

  async function refreshRecommendedVersion() {
    const room = spaceRoom.value
    if (!room?.getRecommendedVersion) {
      recommendedVersion.value = null
      return
    }
    try {
      recommendedVersion.value = await room.getRecommendedVersion()
    } catch {
      recommendedVersion.value = null
    }
  }

  watch(spaceRoom, () => {
    syncFormFromRoom()
    void refreshRecommendedVersion()
    void refreshDirectoryPublished()
  }, { immediate: true })

  watch(
    () => spaceRoom.value?.getLiveTimeline?.()?.getEvents?.()?.length,
    () => syncFormFromRoom(),
  )

  watch([client, spaceId], (current, _previous, onCleanup) => {
    const matrixClient = current[0]
    const roomId = current[1]
    if (!matrixClient || !roomId) {
      return
    }
    const room = matrixClient.getRoom(roomId)
    if (!room) {
      return
    }
    const onStateUpdated = () => {
      syncFormFromRoom()
      void refreshRecommendedVersion()
    }
    room.on(RoomEvent.CurrentStateUpdated, onStateUpdated)
    onCleanup(() => {
      room.off(RoomEvent.CurrentStateUpdated, onStateUpdated)
    })
  }, { immediate: true })

  function startProfileEdit() {
    syncFormFromRoom()
    isProfileEditing.value = true
    feedbackMessage.value = ''
  }

  function cancelProfileEdit() {
    isProfileEditing.value = false
    syncFormFromRoom()
    feedbackMessage.value = ''
  }

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
      isProfileEditing.value = false
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

  async function saveJoinRule(nextRule: SpaceAccessRule): Promise<void> {
    if (!spaceId.value || !canManageGeneral.value) {
      return
    }
    isSavingOptions.value = true
    feedbackMessage.value = ''
    try {
      await updateSpaceJoinRule(spaceId.value, nextRule)
      joinRule.value = nextRule
      feedbackTone.value = 'success'
      feedbackMessage.value = 'saved'
    } catch (thrownError) {
      feedbackTone.value = 'error'
      feedbackMessage.value =
        thrownError instanceof Error
          ? thrownError.message
          : String(thrownError)
    } finally {
      isSavingOptions.value = false
    }
  }

  async function setPublishToDirectory(enabled: boolean): Promise<void> {
    const matrixClient = client.value
    if (!matrixClient || !spaceId.value || !canManageGeneral.value) {
      return
    }
    if (directoryPublished.value === enabled) {
      return
    }
    const previousPublished = directoryPublished.value
    directoryPublished.value = enabled
    isSavingOptions.value = true
    feedbackMessage.value = ''
    try {
      await setDirectoryVisibility(matrixClient, spaceId.value, enabled)
      await refreshDirectoryPublished()
      feedbackTone.value = 'success'
      feedbackMessage.value = 'saved'
    } catch (thrownError) {
      directoryPublished.value = previousPublished
      await refreshDirectoryPublished()
      feedbackTone.value = 'error'
      feedbackMessage.value =
        thrownError instanceof Error
          ? thrownError.message
          : String(thrownError)
    } finally {
      isSavingOptions.value = false
    }
  }

  async function runSpaceUpgrade(): Promise<void> {
    const recommendation = recommendedVersion.value
    if (!spaceId.value || !recommendation?.needsUpgrade) {
      return
    }
    isUpgrading.value = true
    feedbackMessage.value = ''
    try {
      await upgradeSpaceRoom(spaceId.value, recommendation.version)
      await refreshRecommendedVersion()
      syncFormFromRoom()
      feedbackTone.value = 'success'
      feedbackMessage.value = 'saved'
    } catch (thrownError) {
      feedbackTone.value = 'error'
      feedbackMessage.value =
        thrownError instanceof Error
          ? thrownError.message
          : String(thrownError)
    } finally {
      isUpgrading.value = false
    }
  }

  return {
    spaceRoom,
    displayName,
    displayTopic,
    editableName,
    editableTopic,
    joinRule,
    directoryPublished,
    publishToDirectory,
    publishedAddresses,
    localAddressesExpanded,
    roomVersionLabel,
    recommendedVersion,
    isProfileEditing,
    permissions,
    canManageGeneral,
    avatarPreviewUrl,
    feedbackMessage,
    feedbackTone,
    isSaving,
    isSavingOptions,
    isUpgrading,
    saveProfile,
    clearAvatar,
    syncFormFromRoom,
    startProfileEdit,
    cancelProfileEdit,
    saveJoinRule,
    setPublishToDirectory,
    runSpaceUpgrade,
  }
}
