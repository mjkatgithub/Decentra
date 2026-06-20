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

export function unreadStatesEqual(
  previous: RoomUnreadState | undefined,
  next: RoomUnreadState | undefined,
): boolean {
  if (!previous && !next) {
    return true
  }
  if (!previous || !next) {
    return false
  }
  return (
    previous.hasUnread === next.hasUnread
    && previous.hasMentionUnread === next.hasMentionUnread
    && previous.totalCount === next.totalCount
    && previous.highlightCount === next.highlightCount
  )
}

export function diffUnreadRoomIds(
  previous: Record<string, RoomUnreadState>,
  next: Record<string, RoomUnreadState>,
): string[] {
  const roomIds = new Set([
    ...Object.keys(previous),
    ...Object.keys(next),
  ])
  const changed: string[] = []
  for (const roomId of roomIds) {
    if (!unreadStatesEqual(previous[roomId], next[roomId])) {
      changed.push(roomId)
    }
  }
  return changed
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
    spaceUnreadById[spaceId] = recomputeSpaceUnreadForSpace(
      spaceId,
      options,
    )
  }

  return spaceUnreadById
}

export function recomputeSpaceUnreadForSpace(
  spaceId: string,
  options: BuildSpaceUnreadByIdOptions,
): SpaceUnreadState {
  const childRoomIds = roomIdsForSpace(spaceId, options)
  return aggregateRoomUnreadStates(
    childRoomIds,
    options.unreadByRoomId,
  )
}

export function buildRoomIdToSpaceIdsMap(
  spaceIds: string[],
  options: BuildSpaceUnreadByIdOptions,
): Map<string, Set<string>> {
  const roomIdToSpaceIds = new Map<string, Set<string>>()
  for (const spaceId of spaceIds) {
    const childRoomIds = roomIdsForSpace(spaceId, options)
    for (const roomId of childRoomIds) {
      let spaceSet = roomIdToSpaceIds.get(roomId)
      if (!spaceSet) {
        spaceSet = new Set()
        roomIdToSpaceIds.set(roomId, spaceSet)
      }
      spaceSet.add(spaceId)
    }
  }
  return roomIdToSpaceIds
}

export function collectSpaceIdsForChangedRooms(
  changedRoomIds: string[],
  roomIdToSpaceIds: Map<string, Set<string>>,
): string[] {
  const affectedSpaceIds = new Set<string>()
  for (const roomId of changedRoomIds) {
    const spaceSet = roomIdToSpaceIds.get(roomId)
    if (!spaceSet) {
      continue
    }
    for (const spaceId of spaceSet) {
      affectedSpaceIds.add(spaceId)
    }
  }
  return [...affectedSpaceIds]
}

export function patchSpaceUnreadById(
  previous: Record<string, SpaceUnreadState>,
  spaceIdsToUpdate: string[],
  options: BuildSpaceUnreadByIdOptions,
): Record<string, SpaceUnreadState> {
  const next = { ...previous }
  for (const spaceId of spaceIdsToUpdate) {
    next[spaceId] = recomputeSpaceUnreadForSpace(spaceId, options)
  }
  return next
}

export function getSpaceUnreadState(
  spaceId: string,
  spaceUnreadById: Record<string, SpaceUnreadState>,
): SpaceUnreadState {
  return spaceUnreadById[spaceId] ?? { ...EMPTY_SPACE_UNREAD }
}
