import type { MatrixClient } from "matrix-js-sdk";
import type { RoomCategoryGroup } from "~/composables/chat/chatPageTypes";

/**
 * Load display names for space children via MSC2946 /hierarchy (incl. unjoined).
 */
export async function fetchSpaceHierarchyRoomNames(
  matrixClient: MatrixClient,
  rootSpaceId: string,
): Promise<Record<string, string>> {
  const namesById: Record<string, string> = {};
  let nextBatch: string | undefined;

  try {
    do {
      const response = await matrixClient.getRoomHierarchy(
        rootSpaceId,
        100,
        50,
        false,
        nextBatch,
      );
      for (const room of response.rooms) {
        const roomId = room.room_id;
        const name = typeof room.name === "string" ? room.name.trim() : "";
        if (roomId && name) {
          namesById[roomId] = name;
        }
      }
      nextBatch = response.next_batch;
    } while (nextBatch);
  } catch (thrownError) {
    console.warn("fetchSpaceHierarchyRoomNames failed", thrownError);
  }

  return namesById;
}

export function applyLobbyHierarchyNames(
  categories: RoomCategoryGroup[],
  namesById: Record<string, string>,
): RoomCategoryGroup[] {
  if (Object.keys(namesById).length === 0) {
    return categories;
  }
  return categories.map((category) => ({
    ...category,
    name:
      category.subspaceRoomId && namesById[category.subspaceRoomId]
        ? namesById[category.subspaceRoomId]
        : category.name,
    rooms: category.rooms.map((room) => ({
      ...room,
      name: namesById[room.roomId] ?? room.name,
    })),
  }));
}
