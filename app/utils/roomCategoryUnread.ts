import type { RoomUnreadState } from '~/utils/roomUnread'

export interface RoomCategoryRoomBase {
  roomId: string
  name: string
}

export interface RoomCategoryRoomWithUnread extends RoomCategoryRoomBase {
  hasUnread: boolean
  hasMentionUnread: boolean
}

export interface RoomCategorySectionWithRooms {
  rooms: RoomCategoryRoomBase[]
}

export function applyUnreadToRoomCategories<
  T extends RoomCategorySectionWithRooms,
>(
  categories: T[],
  unreadByRoomId: Record<string, RoomUnreadState>,
  includeUnread: boolean,
  activeRoomId?: string | null,
): Array<Omit<T, 'rooms'> & { rooms: RoomCategoryRoomWithUnread[] }> {
  return categories.map((category) => ({
    ...category,
    rooms: category.rooms.map((room) => {
      if (!includeUnread) {
        return {
          roomId: room.roomId,
          name: room.name,
          hasUnread: false,
          hasMentionUnread: false,
        }
      }
      if (activeRoomId && activeRoomId === room.roomId) {
        return {
          roomId: room.roomId,
          name: room.name,
          hasUnread: false,
          hasMentionUnread: false,
        }
      }
      const unreadState = unreadByRoomId[room.roomId]
      return {
        roomId: room.roomId,
        name: room.name,
        hasUnread: unreadState?.hasUnread ?? false,
        hasMentionUnread: unreadState?.hasMentionUnread ?? false,
      }
    }),
  }))
}
