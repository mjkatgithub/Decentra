import type { MatrixClient } from "matrix-js-sdk";
import type { RoomCategoryGroup } from "~/composables/chat/chatPageTypes";
import { sortParsedSpaceChildren } from "~/utils/spaceRoomCategories";

const SPACE_CHILD_EVENT = "m.space.child";
const ROOM_TYPE_SPACE = "m.space";

export interface HierarchyLobbyRoom {
  room_id: string;
  name?: string;
  avatar_url?: string;
  num_joined_members?: number;
  room_type?: string;
  children_state: Array<{
    type: string;
    state_key?: string;
    content?: { order?: string };
  }>;
}

export interface FetchSpaceHierarchyLobbyOptions {
  generalCategoryLabel: string;
  resolveAvatarUrl?: (mxcUrl: string | undefined) => string | undefined;
  isRoomJoined?: (roomId: string) => boolean;
}

function sortHierarchyChildIds(
  parent: HierarchyLobbyRoom,
  roomMap: Map<string, HierarchyLobbyRoom>,
): string[] {
  const parsed = parent.children_state
    .filter(
      (stateEvent) =>
        stateEvent.type === SPACE_CHILD_EVENT && stateEvent.state_key,
    )
    .map((stateEvent) => ({
      childRoomId: stateEvent.state_key as string,
      orderKey:
        typeof stateEvent.content?.order === "string"
          ? stateEvent.content.order
          : "",
    }));

  return sortParsedSpaceChildren(parsed, (childId) => {
    const child = roomMap.get(childId);
    return child?.name?.trim() || childId;
  }).map((entry) => entry.childRoomId);
}

function resolveHierarchyRoomName(
  room: HierarchyLobbyRoom | undefined,
  roomId: string,
): string {
  const name = room?.name?.trim();
  if (name) {
    return name;
  }
  return roomId.split(":")[0]?.replace(/^!/, "") ?? roomId;
}

function toLobbyRoomEntry(
  room: HierarchyLobbyRoom,
  roomId: string,
  options: FetchSpaceHierarchyLobbyOptions,
): RoomCategoryGroup["rooms"][number] {
  const isJoined = options.isRoomJoined?.(roomId) ?? false;
  return {
    roomId,
    name: resolveHierarchyRoomName(room, roomId),
    isJoined,
    avatarUrl: options.resolveAvatarUrl?.(room.avatar_url),
    memberCount: room.num_joined_members,
  };
}

/**
 * Build lobby categories from MSC2946 /hierarchy (full tree, incl. unjoined).
 */
export function buildLobbyCategoriesFromHierarchy(
  rootSpaceId: string,
  hierarchyRooms: HierarchyLobbyRoom[],
  options: FetchSpaceHierarchyLobbyOptions,
): RoomCategoryGroup[] {
  const roomMap = new Map<string, HierarchyLobbyRoom>();
  for (const room of hierarchyRooms) {
    roomMap.set(room.room_id, room);
  }

  const rootRoom = roomMap.get(rootSpaceId);
  if (!rootRoom) {
    return [];
  }

  const categories: RoomCategoryGroup[] = [];

  function appendSubspaceCategory(
    subspaceId: string,
    nestingDepth: number,
    parentSubspaceId?: string,
  ): void {
    const subspaceRoom = roomMap.get(subspaceId);
    if (!subspaceRoom) {
      return;
    }

    const childIds = sortHierarchyChildIds(subspaceRoom, roomMap);
    const channels: RoomCategoryGroup["rooms"] = [];
    const nestedSubspaceIds: string[] = [];

    for (const childId of childIds) {
      const childRoom = roomMap.get(childId);
      if (!childRoom) {
        continue;
      }
      if (childRoom.room_type === ROOM_TYPE_SPACE) {
        nestedSubspaceIds.push(childId);
      } else {
        channels.push(toLobbyRoomEntry(childRoom, childId, options));
      }
    }

    categories.push({
      id: subspaceId,
      name: resolveHierarchyRoomName(subspaceRoom, subspaceId),
      kind: "subspace",
      subspaceRoomId: subspaceId,
      subspaceAvatarUrl: options.resolveAvatarUrl?.(
        subspaceRoom.avatar_url,
      ),
      nestingDepth,
      parentSubspaceId,
      rootChildAnchorIds: [subspaceId],
      canReorderRooms: false,
      isSubspaceJoined: options.isRoomJoined?.(subspaceId) ?? false,
      rooms: channels,
    });

    for (const nestedSubspaceId of nestedSubspaceIds) {
      appendSubspaceCategory(
        nestedSubspaceId,
        nestingDepth + 1,
        subspaceId,
      );
    }
  }

  const rootChildIds = sortHierarchyChildIds(rootRoom, roomMap);
  const rootChannels: RoomCategoryGroup["rooms"] = [];
  const rootSubspaceIds: string[] = [];

  for (const childId of rootChildIds) {
    const childRoom = roomMap.get(childId);
    if (!childRoom) {
      continue;
    }
    if (childRoom.room_type === ROOM_TYPE_SPACE) {
      rootSubspaceIds.push(childId);
    } else {
      rootChannels.push(toLobbyRoomEntry(childRoom, childId, options));
    }
  }

  if (rootChannels.length > 0) {
    categories.push({
      id: `${rootSpaceId}-rooms`,
      name: options.generalCategoryLabel,
      kind: "root",
      nestingDepth: 0,
      rootChildAnchorIds: rootChannels.map((room) => room.roomId),
      canReorderRooms: false,
      rooms: rootChannels,
    });
  }

  for (const subspaceId of rootSubspaceIds) {
    appendSubspaceCategory(subspaceId, 1);
  }

  return categories;
}

export async function fetchSpaceHierarchyLobby(
  matrixClient: MatrixClient,
  rootSpaceId: string,
  options: FetchSpaceHierarchyLobbyOptions,
): Promise<RoomCategoryGroup[]> {
  const hierarchyRooms: HierarchyLobbyRoom[] = [];
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
        hierarchyRooms.push(room as HierarchyLobbyRoom);
      }
      nextBatch = response.next_batch;
    } while (nextBatch);
  } catch (thrownError) {
    console.warn("fetchSpaceHierarchyLobby failed", thrownError);
    return [];
  }

  return buildLobbyCategoriesFromHierarchy(
    rootSpaceId,
    hierarchyRooms,
    options,
  );
}

/** @deprecated Use fetchSpaceHierarchyLobby — kept for tests */
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
