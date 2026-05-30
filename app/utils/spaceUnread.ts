import {
  collectRoomIdsInSpaceSubtree,
} from '~/utils/spaceRoomCategories'
import type { RoomUnreadState } from '~/utils/roomUnread'

export const HOME_SPACE_ID = '__home__'

export interface SpaceUnreadState {
  hasUnread: boolean
  hasMentionUnread: boolean
  totalCount: number
  highlightCount: number
}

const EMPTY_SPACE_UNREAD: SpaceUnreadState = {
  hasUnread: false,
  hasMentionUnread: false,
  totalCount: 0,
  highlightCount: 0,
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
  /** Rooms shown on Home (DMs + non-space groups); excludes space channels. */
  homeRoomIds?: string[]
}

function aggregateRoomUnreadStates(
  roomIds: string[],
  unreadByRoomId: Record<string, RoomUnreadState>,
): SpaceUnreadState {
  let hasUnread = false
  let hasMentionUnread = false
  let totalCount = 0
  let highlightCount = 0
  for (const roomId of roomIds) {
    const state = unreadByRoomId[roomId]
    if (!state) {
      continue
    }
    totalCount += state.totalCount
    highlightCount += state.highlightCount
    if (state.hasMentionUnread) {
      hasMentionUnread = true
      hasUnread = true
      continue
    }
    if (state.hasUnread) {
      hasUnread = true
    }
  }
  return { hasUnread, hasMentionUnread, totalCount, highlightCount }
}

export interface CollectSpaceChildRoomIdsOptions {
  sidebarRooms: SidebarRoomRef[]
  matrixRoomsById: Map<string, unknown>
  getRoomType: (room: unknown) => string | undefined
  getParentSpaceIds: (room: unknown) => string[]
  homeRoomIds?: string[]
}

/** All joined non-space room ids under `spaceId` (or Home sidebar rooms). */
export function collectSpaceChildRoomIds(
  spaceId: string,
  options: CollectSpaceChildRoomIdsOptions,
): string[] {
  if (spaceId === HOME_SPACE_ID) {
    if (options.homeRoomIds) {
      return options.homeRoomIds
    }
    return options.sidebarRooms
      .filter((room) => room.parentSpaceIds.length === 0)
      .map((room) => room.roomId)
  }

  return Array.from(
    collectRoomIdsInSpaceSubtree(
      spaceId,
      options.matrixRoomsById,
      options.getRoomType,
      (room) =>
        String(
          (room as { name?: string; roomId?: string }).name ??
            (room as { roomId?: string }).roomId ??
            '',
        ),
    ),
  )
}

function roomIdsForSpace(
  spaceId: string,
  options: BuildSpaceUnreadByIdOptions,
): string[] {
  return collectSpaceChildRoomIds(spaceId, {
    sidebarRooms: options.sidebarRooms,
    matrixRoomsById: options.matrixRoomsById,
    getRoomType: options.getRoomType,
    getParentSpaceIds: options.getParentSpaceIds,
    homeRoomIds: options.homeRoomIds,
  })
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
