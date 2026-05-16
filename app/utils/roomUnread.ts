import { NotificationCountType } from 'matrix-js-sdk'
import type { MatrixEvent, Room } from 'matrix-js-sdk'

export interface RoomUnreadState {
  hasUnread: boolean
  totalCount: number
}

export interface GetRoomUnreadStateOptions {
  activeRoomId?: string | null
  getRoomType?: (room: Record<string, unknown>) => string | undefined
}

export function getRoomUnreadState(
  room: Record<string, unknown>,
  options: GetRoomUnreadStateOptions = {},
): RoomUnreadState {
  const roomId = String((room as { roomId?: string }).roomId ?? '')
  if (!roomId) {
    return { hasUnread: false, totalCount: 0 }
  }

  if (options.activeRoomId && options.activeRoomId === roomId) {
    return { hasUnread: false, totalCount: 0 }
  }

  const resolveRoomType =
    options.getRoomType ??
    ((candidate) =>
      (candidate as { getType?: () => string }).getType?.())

  if (resolveRoomType(room) === 'm.space') {
    return { hasUnread: false, totalCount: 0 }
  }

  const membership = (
    room as { getMyMembership?: () => string }
  ).getMyMembership?.()
  if (membership && membership !== 'join') {
    return { hasUnread: false, totalCount: 0 }
  }

  const matrixRoom = room as Room
  const totalCount =
    matrixRoom.getUnreadNotificationCount?.(
      NotificationCountType.Total,
    ) ?? 0

  return {
    hasUnread: totalCount > 0,
    totalCount,
  }
}

export function buildUnreadByRoomId(
  rooms: Array<Record<string, unknown>>,
  options: GetRoomUnreadStateOptions = {},
): Record<string, RoomUnreadState> {
  const unreadByRoomId: Record<string, RoomUnreadState> = {}

  for (const room of rooms) {
    const roomId = String((room as { roomId?: string }).roomId ?? '')
    if (!roomId) {
      continue
    }
    unreadByRoomId[roomId] = getRoomUnreadState(room, options)
  }

  return unreadByRoomId
}

export function findLatestReadableRoomMessageEvent(
  room: Record<string, unknown>,
): MatrixEvent | null {
  const liveTimeline = (
    room as {
      getLiveTimeline?: () => { getEvents: () => MatrixEvent[] }
    }
  ).getLiveTimeline?.()
  if (!liveTimeline) {
    return null
  }

  const timelineEvents = liveTimeline.getEvents()
  for (
    let eventIndex = timelineEvents.length - 1;
    eventIndex >= 0;
    eventIndex -= 1
  ) {
    const timelineEvent = timelineEvents[eventIndex]
    if (!timelineEvent) {
      continue
    }
    const eventType = timelineEvent.getType?.() ?? ''
    if (eventType !== 'm.room.message') {
      continue
    }
    const eventId = timelineEvent.getId?.()
    if (!eventId) {
      continue
    }
    return timelineEvent
  }

  return null
}
