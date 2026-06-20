import {
  buildRoomThreadNavEntries,
  type ThreadNavEntry,
} from '~/utils/chatTimeline'

export function collectVisibleSidebarRoomIds(
  visibleRooms: Array<{ roomId: string }>,
): string[] {
  return visibleRooms.map((room) => room.roomId)
}

export interface BuildSidebarThreadNavOptions {
  visibleRoomIds: string[]
  getJoinedRoom: (
    roomId: string,
  ) => Record<string, unknown> | null | undefined
  enrichEntry?: (
    room: Record<string, unknown>,
    entry: ThreadNavEntry,
  ) => ThreadNavEntry
}

/** Thread nav for sidebar rooms only (selected space / home). */
export function buildSidebarThreadNavByRoomId(
  options: BuildSidebarThreadNavOptions,
): Record<string, ThreadNavEntry[]> {
  const out: Record<string, ThreadNavEntry[]> = {}
  for (const roomId of options.visibleRoomIds) {
    const joinedRoom = options.getJoinedRoom(roomId)
    if (!joinedRoom) {
      continue
    }
    let entries = buildRoomThreadNavEntries(joinedRoom)
    if (options.enrichEntry) {
      entries = entries.map((entry) =>
        options.enrichEntry!(joinedRoom, entry),
      )
    }
    if (entries.length > 0) {
      out[roomId] = entries
    }
  }
  return out
}
