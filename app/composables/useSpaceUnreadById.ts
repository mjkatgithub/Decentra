import type { Ref, ComputedRef } from 'vue'
import type { RoomUnreadState } from '~/utils/roomUnread'
import {
  buildRoomIdToSpaceIdsMap,
  buildSpaceUnreadById,
  collectSpaceIdsForChangedRooms,
  diffUnreadRoomIds,
  patchSpaceUnreadById,
  type BuildSpaceUnreadByIdOptions,
  type SidebarRoomRef,
  type SpaceUnreadState,
} from '~/utils/spaceUnread'

export function useSpaceUnreadById(options: {
  matrixSyncPrepared: Ref<boolean>
  unreadByRoomId: ComputedRef<Record<string, RoomUnreadState>>
  spaceIds: ComputedRef<string[]>
  sidebarRooms: ComputedRef<SidebarRoomRef[]>
  matrixRooms: Ref<Array<Record<string, unknown>>>
  homeRoomIds: ComputedRef<string[]>
  getRoomType: (room: unknown) => string | undefined
  getParentSpaceIds: (room: unknown) => string[]
}) {
  const spaceUnreadById = shallowRef<Record<string, SpaceUnreadState>>({})
  const roomIdToSpaceIds = shallowRef<Map<string, Set<string>>>(
    new Map(),
  )
  let lastUnreadSnapshot: Record<string, RoomUnreadState> = {}

  function buildUnreadOptions(): BuildSpaceUnreadByIdOptions {
    const matrixRoomsById = new Map<string, unknown>(
      options.matrixRooms.value.map((room) => [
        String((room as { roomId: string }).roomId),
        room,
      ]),
    )
    return {
      spaceIds: options.spaceIds.value,
      sidebarRooms: options.sidebarRooms.value,
      unreadByRoomId: options.unreadByRoomId.value,
      matrixRoomsById,
      getRoomType: options.getRoomType,
      getParentSpaceIds: options.getParentSpaceIds,
      homeRoomIds: options.homeRoomIds.value,
    }
  }

  function fullRebuild(): void {
    const unreadOptions = buildUnreadOptions()
    spaceUnreadById.value = buildSpaceUnreadById(unreadOptions)
    roomIdToSpaceIds.value = buildRoomIdToSpaceIdsMap(
      unreadOptions.spaceIds,
      unreadOptions,
    )
    lastUnreadSnapshot = { ...options.unreadByRoomId.value }
  }

  function clearState(): void {
    spaceUnreadById.value = {}
    roomIdToSpaceIds.value = new Map()
    lastUnreadSnapshot = {}
  }

  watch(
    [
      options.matrixSyncPrepared,
      options.spaceIds,
      options.sidebarRooms,
      options.matrixRooms,
      options.homeRoomIds,
    ],
    () => {
      if (!options.matrixSyncPrepared.value) {
        clearState()
        return
      }
      fullRebuild()
    },
    { deep: true, immediate: true },
  )

  watch(
    options.unreadByRoomId,
    (nextUnread) => {
      if (!options.matrixSyncPrepared.value) {
        return
      }
      const changedRoomIds = diffUnreadRoomIds(
        lastUnreadSnapshot,
        nextUnread,
      )
      lastUnreadSnapshot = { ...nextUnread }
      if (changedRoomIds.length === 0) {
        return
      }
      const unreadOptions = buildUnreadOptions()
      const affectedSpaceIds = collectSpaceIdsForChangedRooms(
        changedRoomIds,
        roomIdToSpaceIds.value,
      )
      if (affectedSpaceIds.length === 0) {
        fullRebuild()
        return
      }
      spaceUnreadById.value = patchSpaceUnreadById(
        spaceUnreadById.value,
        affectedSpaceIds,
        unreadOptions,
      )
    },
    { flush: 'sync' },
  )

  return {
    spaceUnreadById: computed(() => spaceUnreadById.value),
  }
}
