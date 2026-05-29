import { isRoomUnderAncestorSpace } from '~/utils/spaceRoomCategories'
import type { RoomUnreadState } from '~/utils/roomUnread'

export const HOME_SPACE_ID = '__home__'

export interface SpaceUnreadState {
  hasUnread: boolean
  hasMentionUnread: boolean
}

const EMPTY_SPACE_UNREAD: SpaceUnreadState = {
  hasUnread: false,
  hasMentionUnread: false,
}

export interface SidebarRoomRef {
  roomId: string
  parentSpaceIds: string[]
}

export interface BuildSpaceUnreadByIdOptions {
  spaceIds: string[]
  sidebarRooms: SidebarRoomRef[]
  unreadByRoomId: Record<string, RoomUnreadState>
  matrixRoomsById: Map<string, unknown>
  getRoomType: (room: unknown) => string | undefined
  getParentSpaceIds: (room: unknown) => string[]
}

function aggregateRoomUnreadStates(
  roomIds: string[],
  unreadByRoomId: Record<string, RoomUnreadState>,
): SpaceUnreadState {
  let hasUnread = false
  let hasMentionUnread = false
  for (const roomId of roomIds) {
    const state = unreadByRoomId[roomId]
    if (!state) {
      continue
    }
    if (state.hasMentionUnread) {
      hasMentionUnread = true
      hasUnread = true
      continue
    }
    if (state.hasUnread) {
      hasUnread = true
    }
  }
  return { hasUnread, hasMentionUnread }
}

export interface CollectSpaceChildRoomIdsOptions {
  sidebarRooms: SidebarRoomRef[]
  matrixRoomsById: Map<string, unknown>
  getRoomType: (room: unknown) => string | undefined
  getParentSpaceIds: (room: unknown) => string[]
}

/** All joined non-space room ids that resolve under `spaceId` (or all on Home). */
export function collectSpaceChildRoomIds(
  spaceId: string,
  options: CollectSpaceChildRoomIdsOptions,
): string[] {
  if (spaceId === HOME_SPACE_ID) {
    return options.sidebarRooms.map((room) => room.roomId)
  }

  const roomIds: string[] = []
  for (const sidebarRoom of options.sidebarRooms) {
    if (sidebarRoom.parentSpaceIds.length === 0) {
      continue
    }
    const underSpace = isRoomUnderAncestorSpace({
      roomParentIds: sidebarRoom.parentSpaceIds,
      ancestorSpaceId: spaceId,
      roomsById: options.matrixRoomsById,
      getRoomType: options.getRoomType,
      getParentSpaceIds: options.getParentSpaceIds,
    })
    if (underSpace) {
      roomIds.push(sidebarRoom.roomId)
    }
  }
  return roomIds
}

function roomIdsForSpace(
  spaceId: string,
  options: BuildSpaceUnreadByIdOptions,
): string[] {
  return collectSpaceChildRoomIds(spaceId, options)
}

export function buildSpaceUnreadById(
  options: BuildSpaceUnreadByIdOptions,
): Record<string, SpaceUnreadState> {
  const spaceUnreadById: Record<string, SpaceUnreadState> = {}

  for (const spaceId of options.spaceIds) {
    const childRoomIds = roomIdsForSpace(spaceId, options)
    spaceUnreadById[spaceId] = aggregateRoomUnreadStates(
      childRoomIds,
      options.unreadByRoomId,
    )
  }

  return spaceUnreadById
}

export function getSpaceUnreadState(
  spaceId: string,
  spaceUnreadById: Record<string, SpaceUnreadState>,
): SpaceUnreadState {
  return spaceUnreadById[spaceId] ?? { ...EMPTY_SPACE_UNREAD }
}
