import { NotificationCountType } from 'matrix-js-sdk'
import type { MatrixEvent, Room } from 'matrix-js-sdk'
import {
  buildMessageRelationIndex,
  collectMessageTimelineEvents,
  shouldIncludeMessageInThreadView,
} from '~/utils/chatTimeline'
import { getRedactedEventIds } from '~/utils/chatTimeline'

export interface RoomUnreadState {
  hasUnread: boolean
  totalCount: number
  highlightCount: number
  hasMentionUnread: boolean
}

export type ChannelUnreadVisual = 'none' | 'normal' | 'mention'

export interface GetRoomUnreadStateOptions {
  activeRoomId?: string | null
  getRoomType?: (room: Record<string, unknown>) => string | undefined
}

export interface GetThreadUnreadStateOptions {
  activeRoomId?: string | null
  activeThreadRootId?: string | null
}

const EMPTY_UNREAD_STATE: RoomUnreadState = {
  hasUnread: false,
  totalCount: 0,
  highlightCount: 0,
  hasMentionUnread: false,
}

export function resolveChannelUnreadVisual(state: {
  hasMentionUnread: boolean
  hasUnread: boolean
}): ChannelUnreadVisual {
  if (state.hasMentionUnread) {
    return 'mention'
  }
  if (state.hasUnread) {
    return 'normal'
  }
  return 'none'
}

function readNotificationCounts(
  readCount: (type: NotificationCountType) => number | undefined,
): RoomUnreadState {
  const totalCount = readCount(NotificationCountType.Total) ?? 0
  const highlightCount = readCount(NotificationCountType.Highlight) ?? 0
  return {
    hasUnread: totalCount > 0,
    totalCount,
    highlightCount,
    hasMentionUnread: highlightCount > 0,
  }
}

function isEligibleUnreadRoom(
  room: Record<string, unknown>,
  roomId: string,
  options: GetRoomUnreadStateOptions,
): boolean {
  if (!roomId) {
    return false
  }
  const resolveRoomType =
    options.getRoomType ??
    ((candidate) =>
      (candidate as { getType?: () => string }).getType?.())
  if (resolveRoomType(room) === 'm.space') {
    return false
  }
  const membership = (
    room as { getMyMembership?: () => string }
  ).getMyMembership?.()
  if (membership && membership !== 'join') {
    return false
  }
  return true
}

export function getRoomUnreadState(
  room: Record<string, unknown>,
  options: GetRoomUnreadStateOptions = {},
): RoomUnreadState {
  const roomId = String((room as { roomId?: string }).roomId ?? '')
  if (!roomId) {
    return { ...EMPTY_UNREAD_STATE }
  }

  if (options.activeRoomId && options.activeRoomId === roomId) {
    return { ...EMPTY_UNREAD_STATE }
  }

  if (!isEligibleUnreadRoom(room, roomId, options)) {
    return { ...EMPTY_UNREAD_STATE }
  }

  const matrixRoom = room as Room
  return readNotificationCounts((type) =>
    matrixRoom.getUnreadNotificationCount?.(type),
  )
}

export function getThreadUnreadState(
  room: Record<string, unknown>,
  threadRootEventId: string,
  options: GetThreadUnreadStateOptions = {},
): RoomUnreadState {
  const roomId = String((room as { roomId?: string }).roomId ?? '')
  if (!roomId || !threadRootEventId) {
    return { ...EMPTY_UNREAD_STATE }
  }

  if (
    options.activeRoomId === roomId &&
    options.activeThreadRootId === threadRootEventId
  ) {
    return { ...EMPTY_UNREAD_STATE }
  }

  if (!isEligibleUnreadRoom(room, roomId, options)) {
    return { ...EMPTY_UNREAD_STATE }
  }

  const matrixRoom = room as Room
  return readNotificationCounts((type) =>
    matrixRoom.getThreadUnreadNotificationCount?.(threadRootEventId, type),
  )
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

export function summarizeGlobalUnread(
  unreadByRoomId: Record<string, RoomUnreadState>,
): { unreadRoomCount: number; mentionRoomCount: number } {
  let unreadRoomCount = 0
  let mentionRoomCount = 0
  for (const state of Object.values(unreadByRoomId)) {
    if (state.hasMentionUnread) {
      mentionRoomCount += 1
      unreadRoomCount += 1
      continue
    }
    if (state.hasUnread) {
      unreadRoomCount += 1
    }
  }
  return { unreadRoomCount, mentionRoomCount }
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

export function findLatestReadableThreadMessageEvent(
  room: Record<string, unknown>,
  threadRootEventId: string,
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
  const redactedEventIds = getRedactedEventIds(timelineEvents)
  const messageEvents = collectMessageTimelineEvents(timelineEvents)
  const relationIndex = buildMessageRelationIndex(messageEvents)

  for (
    let eventIndex = messageEvents.length - 1;
    eventIndex >= 0;
    eventIndex -= 1
  ) {
    const timelineEvent = messageEvents[eventIndex]
    if (!timelineEvent) {
      continue
    }
    if (
      !shouldIncludeMessageInThreadView(
        timelineEvent,
        threadRootEventId,
        relationIndex,
        redactedEventIds,
      )
    ) {
      continue
    }
    const eventId = timelineEvent.getId?.()
    if (!eventId) {
      continue
    }
    return timelineEvent as MatrixEvent
  }

  return null
}
