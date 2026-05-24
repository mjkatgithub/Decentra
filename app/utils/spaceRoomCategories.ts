/**
 * Matrix Spaces (MSC1772): map m.space.child / m.space.parent into grouped
 * channel lists under a root space.
 */

export const SPACE_CHILD_EVENT = "m.space.child";
export const SPACE_PARENT_EVENT = "m.space.parent";

const ROOM_TYPE_SPACE = "m.space";

export interface ParsedSpaceChild {
  childRoomId: string;
  /** Lex sort key; empty string if missing */
  orderKey: string;
  rawOrder?: string;
  via?: string[];
}

export type SpaceCategoryKind = "root" | "subspace";

export interface SpaceRoomCategory {
  id: string;
  name: string;
  kind: SpaceCategoryKind;
  /** Present when kind === "subspace" */
  subspaceRoomId?: string;
  /** 0 = root room group; 1+ = subspace nesting depth */
  nestingDepth: number;
  /** Parent subspace room id (for collapse + indent) */
  parentSubspaceId?: string;
  /**
   * Child room IDs under the root space (m.space.child state keys) that this
   * UI block represents — used to reorder category blocks on the root.
   */
  rootChildAnchorIds: string[];
  rooms: Array<{ roomId: string; name: string }>;
}

export interface MatrixRoomLike {
  roomId: string;
  currentState?: {
    getStateEvents?: (eventType: string) => unknown;
  };
}

function normalizeStateEventList(raw: unknown): Array<{
  getStateKey?: () => string;
  getContent?: () => Record<string, unknown>;
}> {
  if (!raw) {
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Read m.space.child links from a parent space room (state_key = child room id).
 */
export function parseSpaceChildEvents(
  parentRoom: MatrixRoomLike,
): ParsedSpaceChild[] {
  const stateEvents = parentRoom.currentState?.getStateEvents?.(
    SPACE_CHILD_EVENT,
  );
  const list = normalizeStateEventList(stateEvents);
  const result: ParsedSpaceChild[] = [];
  for (const stateEvent of list) {
    const childRoomId = stateEvent.getStateKey?.();
    if (!childRoomId) {
      continue;
    }
    const content = stateEvent.getContent?.() ?? {};
    const rawOrder =
      typeof content.order === "string" ? content.order : undefined;
    const via = Array.isArray(content.via)
      ? (content.via as string[]).filter((entry) => typeof entry === "string")
      : undefined;
    result.push({
      childRoomId,
      orderKey: rawOrder ?? "",
      rawOrder,
      via,
    });
  }
  return result;
}

export function sortParsedSpaceChildren(
  children: ParsedSpaceChild[],
  tieBreakLabel: (childRoomId: string) => string,
): ParsedSpaceChild[] {
  return [...children].sort((childA, childB) => {
    const orderCompare = childA.orderKey.localeCompare(childB.orderKey);
    if (orderCompare !== 0) {
      return orderCompare;
    }
    return tieBreakLabel(childA.childRoomId).localeCompare(
      tieBreakLabel(childB.childRoomId),
    );
  });
}

export function getJoinedSpaceRoomIds(
  rooms: Array<{ roomId: string; getType?: () => string }>,
): Set<string> {
  const ids = new Set<string>();
  for (const room of rooms) {
    if (room.getType?.() === ROOM_TYPE_SPACE) {
      ids.add(room.roomId);
    }
  }
  return ids;
}

/**
 * Root space = no joined m.space parent (parent must be another joined space).
 */
export function isRootSpaceRoom(
  spaceRoom: { roomId: string; getType?: () => string },
  joinedSpaceIds: Set<string>,
  getParentSpaceIds: (room: unknown) => string[],
): boolean {
  if (spaceRoom.getType?.() !== ROOM_TYPE_SPACE) {
    return false;
  }
  const parents = getParentSpaceIds(spaceRoom);
  return !parents.some((parentId) => joinedSpaceIds.has(parentId));
}

/**
 * Joined spaces listed as m.space.child of another joined space (any depth
 * link from a parent). Used for the space rail: subspaces stay in-channel only.
 */
export function getJoinedSpaceIdsListedAsChild(
  matrixRooms: unknown[],
  getRoomType: (room: unknown) => string | undefined,
  getRoomId: (room: unknown) => string,
): Set<string> {
  const joinedSpaceIds = getJoinedSpaceRoomIds(
    matrixRooms.map((room) => ({
      roomId: getRoomId(room),
      getType: () => getRoomType(room),
    })),
  );
  const listedAsChild = new Set<string>();
  for (const room of matrixRooms) {
    if (getRoomType(room) !== ROOM_TYPE_SPACE) {
      continue;
    }
    if (!joinedSpaceIds.has(getRoomId(room))) {
      continue;
    }
    for (const parsed of parseSpaceChildEvents(room as MatrixRoomLike)) {
      const childRoom = matrixRooms.find(
        (candidate) => getRoomId(candidate) === parsed.childRoomId,
      );
      if (
        childRoom &&
        getRoomType(childRoom) === ROOM_TYPE_SPACE &&
        joinedSpaceIds.has(parsed.childRoomId)
      ) {
        listedAsChild.add(parsed.childRoomId);
      }
    }
  }
  return listedAsChild;
}

/** Top-level space for the left rail (not a child of another joined space). */
export function isTopLevelSpaceForRail(
  spaceRoomId: string,
  joinedSpaceIds: Set<string>,
  joinedSpaceIdsListedAsChild: Set<string>,
): boolean {
  return (
    joinedSpaceIds.has(spaceRoomId) &&
    !joinedSpaceIdsListedAsChild.has(spaceRoomId)
  );
}

/** All non-space room ids reachable via m.space.child under a space. */
export function collectRoomIdsInSpaceSubtree(
  rootSpaceId: string,
  roomsById: Map<string, unknown>,
  getRoomType: (room: unknown) => string | undefined,
  getRoomDisplayName: (room: unknown) => string,
): Set<string> {
  const roomIds = new Set<string>();
  const visitedSpaces = new Set<string>();

  function walkSpace(spaceId: string): void {
    if (visitedSpaces.has(spaceId)) {
      return;
    }
    visitedSpaces.add(spaceId);
    const spaceRoom = roomsById.get(spaceId);
    if (!spaceRoom || getRoomType(spaceRoom) !== ROOM_TYPE_SPACE) {
      return;
    }
    const parsedChildren = sortParsedSpaceChildren(
      parseSpaceChildEvents(spaceRoom as MatrixRoomLike),
      (childId) =>
        getRoomDisplayName(roomsById.get(childId) ?? { roomId: childId }),
    );
    for (const parsed of parsedChildren) {
      const childRoom = roomsById.get(parsed.childRoomId);
      if (!childRoom) {
        continue;
      }
      if (getRoomType(childRoom) === ROOM_TYPE_SPACE) {
        walkSpace(parsed.childRoomId);
      } else {
        roomIds.add(parsed.childRoomId);
      }
    }
  }

  walkSpace(rootSpaceId);
  return roomIds;
}

export function isRoomListedUnderSpaceSubtree(
  roomId: string,
  spaceId: string,
  roomsById: Map<string, unknown>,
  getRoomType: (room: unknown) => string | undefined,
  getRoomDisplayName: (room: unknown) => string,
): boolean {
  return collectRoomIdsInSpaceSubtree(
    spaceId,
    roomsById,
    getRoomType,
    getRoomDisplayName,
  ).has(roomId);
}

export function viaServersFromRoomId(roomId: string): string[] {
  const domain = roomId.split(":")[1];
  return domain ? [domain] : [];
}

/**
 * Assign fresh lex orders for a full sibling list (persist after reorder).
 */
export function assignLexOrdersForSiblingCount(count: number): string[] {
  if (count <= 0) {
    return [];
  }
  const width = Math.max(4, String(count - 1).length);
  return Array.from({ length: count }, (_, index) =>
    String(index).padStart(width, "0"),
  );
}

/**
 * Whether a non-space room should appear when a root (or nested) space is
 * selected: some parent in m.space.parent chain equals selectedSpaceId.
 */
export function isRoomAssociatedWithSpace(
  parentSpaceIds: string[],
  selectedSpaceId: string,
): boolean {
  return parentSpaceIds.includes(selectedSpaceId);
}

/**
 * True if `ancestorSpaceId` appears in the parent chain of a room, walking
 * through joined parent spaces (for nested subspaces under a root).
 */
export function isRoomUnderAncestorSpace(options: {
  roomParentIds: string[];
  ancestorSpaceId: string;
  roomsById: Map<string, unknown>;
  getRoomType: (room: unknown) => string | undefined;
  getParentSpaceIds: (room: unknown) => string[];
}): boolean {
  const {
    roomParentIds,
    ancestorSpaceId,
    roomsById,
    getRoomType,
    getParentSpaceIds,
  } = options;
  if (roomParentIds.includes(ancestorSpaceId)) {
    return true;
  }
  const visited = new Set<string>();
  const queue = [...roomParentIds];
  while (queue.length > 0) {
    const parentId = queue.shift();
    if (!parentId || visited.has(parentId)) {
      continue;
    }
    visited.add(parentId);
    if (parentId === ancestorSpaceId) {
      return true;
    }
    const parentRoom = roomsById.get(parentId);
    if (!parentRoom) {
      continue;
    }
    if (getRoomType(parentRoom) !== ROOM_TYPE_SPACE) {
      continue;
    }
    for (const grandParentId of getParentSpaceIds(parentRoom)) {
      queue.push(grandParentId);
    }
  }
  return false;
}

function appendSubspaceCategoriesDepthFirst(
  subspaceId: string,
  roomsById: Map<string, unknown>,
  getRoomType: (room: unknown) => string | undefined,
  getRoomDisplayName: (room: unknown) => string,
  categories: SpaceRoomCategory[],
  rootChildAnchorIds: string[],
  nestingDepth: number,
  parentSubspaceId?: string,
): void {
  const subspaceRoom = roomsById.get(subspaceId);
  if (!subspaceRoom || getRoomType(subspaceRoom) !== ROOM_TYPE_SPACE) {
    return;
  }

  const parsedChildren = sortParsedSpaceChildren(
    parseSpaceChildEvents(subspaceRoom as MatrixRoomLike),
    (childId) =>
      getRoomDisplayName(roomsById.get(childId) ?? { roomId: childId }),
  );

  const roomsInSubspace: Array<{ roomId: string; name: string }> = [];
  const nestedSubspaceIds: string[] = [];

  for (const parsed of parsedChildren) {
    const memberRoom = roomsById.get(parsed.childRoomId);
    if (!memberRoom) {
      continue;
    }
    if (getRoomType(memberRoom) === ROOM_TYPE_SPACE) {
      nestedSubspaceIds.push(parsed.childRoomId);
    } else {
      roomsInSubspace.push({
        roomId: parsed.childRoomId,
        name: getRoomDisplayName(memberRoom),
      });
    }
  }

  categories.push({
    id: subspaceId,
    name: getRoomDisplayName(subspaceRoom),
    kind: "subspace",
    subspaceRoomId: subspaceId,
    nestingDepth,
    parentSubspaceId,
    rootChildAnchorIds,
    rooms: roomsInSubspace,
  });

  for (const nestedSubspaceId of nestedSubspaceIds) {
    appendSubspaceCategoriesDepthFirst(
      nestedSubspaceId,
      roomsById,
      getRoomType,
      getRoomDisplayName,
      categories,
      [],
      nestingDepth + 1,
      subspaceId,
    );
  }
}

/**
 * Build category sections for the middle column from Matrix space state.
 * Preserves m.space.child order on the root: consecutive non-space children
 * share one "General" segment; each subspace (including nested subspaces)
 * is its own block with direct non-space children, in depth-first order.
 */
export function buildSpaceRoomCategories(options: {
  rootSpaceId: string;
  matrixRooms: unknown[];
  getRoomType: (room: unknown) => string | undefined;
  getRoomId: (room: unknown) => string;
  getRoomDisplayName: (room: unknown) => string;
  generalCategoryLabel: string;
}): SpaceRoomCategory[] {
  const {
    rootSpaceId,
    matrixRooms,
    getRoomType,
    getRoomId,
    getRoomDisplayName,
    generalCategoryLabel,
  } = options;

  const roomsById = new Map<string, unknown>();
  for (const room of matrixRooms) {
    roomsById.set(getRoomId(room), room);
  }

  const rootRoom = roomsById.get(rootSpaceId);
  if (!rootRoom || getRoomType(rootRoom) !== ROOM_TYPE_SPACE) {
    return [];
  }

  const parsedRootChildren = sortParsedSpaceChildren(
    parseSpaceChildEvents(rootRoom as MatrixRoomLike),
    (childId) => getRoomDisplayName(roomsById.get(childId) ?? { roomId: childId }),
  );

  const categories: SpaceRoomCategory[] = [];
  let directSegmentIndex = 0;
  let directBuffer: Array<{ roomId: string; name: string }> = [];

  function flushDirectBuffer() {
    if (directBuffer.length === 0) {
      return;
    }
    categories.push({
      id: `${rootSpaceId}-direct-${directSegmentIndex}`,
      name: generalCategoryLabel,
      kind: "root",
      nestingDepth: 0,
      rootChildAnchorIds: directBuffer.map((entry) => entry.roomId),
      rooms: directBuffer,
    });
    directSegmentIndex += 1;
    directBuffer = [];
  }

  for (const parsed of parsedRootChildren) {
    const childRoom = roomsById.get(parsed.childRoomId);
    if (!childRoom) {
      continue;
    }
    const childType = getRoomType(childRoom);
    if (childType === ROOM_TYPE_SPACE) {
      flushDirectBuffer();
      appendSubspaceCategoriesDepthFirst(
        parsed.childRoomId,
        roomsById,
        getRoomType,
        getRoomDisplayName,
        categories,
        [parsed.childRoomId],
        1,
      );
    } else {
      directBuffer.push({
        roomId: parsed.childRoomId,
        name: getRoomDisplayName(childRoom),
      });
    }
  }
  flushDirectBuffer();

  return categories;
}
