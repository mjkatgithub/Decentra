import { HOME_SPACE_ID } from "~/utils/spaceUnread";
import {
  buildSpaceRoomCategories,
  parseSpaceChildEvents,
  resolveRootSpaceIdForHierarchy,
  sortParsedSpaceChildren,
} from "~/utils/spaceRoomCategories";
import {
  canUserInviteToChannel,
  isJoinedRoom,
} from "~/utils/matrixRoomChannelPermissions";
import {
  canManageSpaceChildren,
} from "~/utils/matrixSpaceHierarchyPermissions";
import { canPerformSpaceRoleAction } from "~/utils/decentraSpaceRolesPermissions";
import type { RoomCategoryGroup, RoomItem } from "~/composables/chat/chatPageTypes";
import {
  getMatrixRoomId,
  getParentSpaceIds,
  getRoomType,
  isDirectMessageRoom,
  isGroupChatRoom,
  isPersonalChatRoom,
  toCategoryRoomBase,
} from "~/composables/chat/chatPageRoomHelpers";

export function useChatRoomSidebar(options: {
  client: Ref<Record<string, any> | null>;
  userId: Ref<string | null>;
  matrixRooms: Ref<Array<Record<string, any>>>;
  selectedSpaceId: Ref<string | null>;
  selectedRoomId: Ref<string | null>;
  visibleRoomsForSidebar: ComputedRef<RoomItem[]>;
  selectedSpaceName: ComputedRef<string>;
  translateText: (key: string, params?: Record<string, string>) => string;
  reorderSpaceChildren: (
    parentSpaceId: string,
    orderedRoomIds: string[],
  ) => Promise<void>;
  moveChannelBetweenSpaceParents: (payload: {
    roomId: string;
    previousParentSpaceId: string;
    nextParentSpaceId: string;
    insertIndex: number;
  }) => Promise<void>;
  refreshRooms: () => void;
}) {
  const inviteTarget = ref<{ roomId: string; label: string } | null>(null);

  const canInviteToSpace = computed(() => {
    const spaceId = options.selectedSpaceId.value;
    if (!spaceId || spaceId === HOME_SPACE_ID) {
      return false;
    }
    return canPerformSpaceRoleAction(
      options.client.value,
      spaceId,
      options.userId.value,
      "inviteMembers",
      options.selectedRoomId.value ?? undefined,
    );
  });

  function canInviteToRoom(roomId: string): boolean {
    const matrixClient = options.client.value;
    const matrixUserId = options.userId.value;
    const matrixRoom = options.matrixRooms.value.find(
      (entry) => entry.roomId === roomId,
    );
    if (
      isDirectMessageRoom(roomId, matrixRoom, matrixClient)
    ) {
      return false;
    }
    const spaceId = options.selectedSpaceId.value;
    if (!spaceId || spaceId === HOME_SPACE_ID) {
      return canUserInviteToChannel(
        matrixClient,
        roomId,
        matrixUserId,
        null,
      );
    }
    return canUserInviteToChannel(
      matrixClient,
      roomId,
      matrixUserId,
      spaceId,
    );
  }

  function canOpenRoomSettings(roomId: string): boolean {
    return isJoinedRoom(options.client.value, roomId);
  }

  function openRoomSettings(roomId: string) {
    const query: Record<string, string> = { room: roomId };
    const rootId = options.selectedSpaceId.value;
    if (rootId && rootId !== HOME_SPACE_ID) {
      query.root = rootId;
    }
    navigateTo({
      path: `/settings/room/${roomId}`,
      query,
    });
  }

  function openInviteToRoom(roomId: string) {
    const matrixClient = options.client.value;
    const label =
      matrixClient?.getRoom(roomId)?.name ||
      options.translateText("layout.roomFallback");
    inviteTarget.value = { roomId, label };
  }

  function openInviteToSpace() {
    const spaceId = options.selectedSpaceId.value;
    if (!spaceId || spaceId === HOME_SPACE_ID) {
      return;
    }
    inviteTarget.value = {
      roomId: spaceId,
      label: options.selectedSpaceName.value,
    };
  }

  function closeInviteOverlay() {
    inviteTarget.value = null;
  }

  function buildHomeSections(): RoomCategoryGroup[] {
    const personalRooms = options.visibleRoomsForSidebar.value.filter(
      (room) =>
        isPersonalChatRoom(
          room,
          options.matrixRooms.value,
          options.client.value,
        ),
    );
    const groupRooms = options.visibleRoomsForSidebar.value.filter((room) =>
      isGroupChatRoom(
        room,
        options.matrixRooms.value,
        options.client.value,
      ),
    );

    const categories: RoomCategoryGroup[] = [];
    if (personalRooms.length > 0) {
      categories.push({
        id: "personal-chats",
        name: options.translateText("layout.personalChats"),
        kind: "root",
        rootChildAnchorIds: [],
        canReorderRooms: false,
        rooms: personalRooms.map((room) => toCategoryRoomBase(room)),
      });
    }
    if (groupRooms.length > 0) {
      categories.push({
        id: "group-chats",
        name: options.translateText("layout.groupChats"),
        kind: "root",
        rootChildAnchorIds: [],
        canReorderRooms: false,
        rooms: groupRooms.map((room) => toCategoryRoomBase(room)),
      });
    }
    return categories;
  }

  function buildSpaceSections(): RoomCategoryGroup[] {
    const selectedId = options.selectedSpaceId.value;
    if (!selectedId || selectedId === HOME_SPACE_ID) {
      return [];
    }
    const built = buildSpaceRoomCategories({
      rootSpaceId: selectedId,
      matrixRooms: options.matrixRooms.value,
      getRoomType,
      getRoomId: getMatrixRoomId,
      getRoomDisplayName: (room) =>
        String(
          (room as { name?: string }).name ||
            options.translateText("layout.roomFallback"),
        ),
      generalCategoryLabel: options.translateText(
        "layout.spaceRoomsCategory",
      ),
    });
    const matrixClient = options.client.value;
    const matrixUserId = options.userId.value;
    const visibleRoomIdSet = new Set(
      options.visibleRoomsForSidebar.value.map((room) => room.roomId),
    );
    return built
      .map((category) => {
        const parentForRooms =
          category.kind === "subspace" && category.subspaceRoomId
            ? category.subspaceRoomId
            : selectedId;
        const canReorderRooms =
          matrixClient && parentForRooms
            ? canManageSpaceChildren(
                matrixClient,
                parentForRooms,
                matrixUserId,
              )
            : false;
        const rooms = category.rooms
          .filter((room) => visibleRoomIdSet.has(room.roomId))
          .map((room) => toCategoryRoomBase(room));
        return {
          id: category.id,
          name: category.name,
          kind: category.kind,
          subspaceRoomId: category.subspaceRoomId,
          nestingDepth: category.nestingDepth,
          parentSubspaceId: category.parentSubspaceId,
          rootChildAnchorIds: category.rootChildAnchorIds,
          canReorderRooms,
          rooms,
        };
      })
      .filter(
        (category) =>
          category.rooms.length > 0 || category.kind === "subspace",
      );
  }

  function canManageChildrenOnSpace(spaceRoomId: string): boolean {
    return canManageSpaceChildren(
      options.client.value,
      spaceRoomId,
      options.userId.value,
    );
  }

  const canReorderRootCategories = computed(() => {
    const rootId = options.selectedSpaceId.value;
    if (!rootId || rootId === HOME_SPACE_ID) {
      return false;
    }
    return canManageChildrenOnSpace(rootId);
  });

  const canAddSpaceChildren = computed(() => canReorderRootCategories.value);

  const hasJoinedNonSpaceRooms = computed(() => {
    return options.matrixRooms.value.some((room) => {
      if (getRoomType(room) === "m.space") {
        return false;
      }
      return room.getMyMembership?.() === "join";
    });
  });

  async function onPersistRoomOrder(payload: {
    parentSpaceId: string;
    orderedRoomIds: string[];
  }) {
    try {
      await options.reorderSpaceChildren(
        payload.parentSpaceId,
        payload.orderedRoomIds,
      );
      options.refreshRooms();
    } catch (thrownError) {
      console.error("reorderSpaceChildren failed", thrownError);
    }
  }

  async function onMoveRoomBetweenCategories(payload: {
    roomId: string;
    previousParentSpaceId: string;
    nextParentSpaceId: string;
    insertIndex: number;
  }) {
    try {
      await options.moveChannelBetweenSpaceParents(payload);
      options.refreshRooms();
    } catch (thrownError) {
      console.error(
        "moveChannelBetweenSpaceParents failed",
        thrownError,
      );
    }
  }

  async function onReorderRootCategories(
    orderedRootChildIds: string[],
  ) {
    const rootId = options.selectedSpaceId.value;
    if (!rootId || rootId === HOME_SPACE_ID) {
      return;
    }
    try {
      await options.reorderSpaceChildren(rootId, orderedRootChildIds);
      options.refreshRooms();
    } catch (thrownError) {
      console.error("reorder root categories failed", thrownError);
    }
  }

  function resolveRootSpaceIdForNavigation(
    spaceOrSubspaceId: string,
  ): string {
    const matrixClient = options.client.value;
    if (!matrixClient) {
      return spaceOrSubspaceId;
    }
    const rootId = options.selectedSpaceId.value;
    if (rootId && rootId !== HOME_SPACE_ID) {
      return rootId;
    }
    return resolveRootSpaceIdForHierarchy({
      spaceId: spaceOrSubspaceId,
      matrixRooms: options.matrixRooms.value,
      getRoomId: getMatrixRoomId,
      getRoomType,
      getParentSpaceIds,
    });
  }

  function resolveRoomInsertIndexForCategory(category: {
    kind?: string;
    rootChildAnchorIds?: string[];
  }): number | undefined {
    if (category.kind !== "root") {
      return undefined;
    }
    const anchorIds = category.rootChildAnchorIds;
    if (!anchorIds?.length) {
      return undefined;
    }
    const parentSpaceId = options.selectedSpaceId.value;
    const matrixClient = options.client.value;
    if (!parentSpaceId || !matrixClient) {
      return undefined;
    }
    const parentRoom = matrixClient.getRoom(parentSpaceId);
    if (!parentRoom) {
      return undefined;
    }
    const orderedChildIds = sortParsedSpaceChildren(
      parseSpaceChildEvents(parentRoom as never),
      (childId) => childId,
    ).map((parsed) => parsed.childRoomId);
    const lastAnchorId = anchorIds[anchorIds.length - 1];
    const anchorIndex = orderedChildIds.indexOf(lastAnchorId ?? "");
    if (anchorIndex < 0) {
      return undefined;
    }
    return anchorIndex + 1;
  }

  function openAddRoomToSpace(
    parentSpaceId: string,
    insertIndex?: number,
  ) {
    const rootSpaceId = resolveRootSpaceIdForNavigation(parentSpaceId);
    const query: Record<string, string> = {
      root: rootSpaceId,
      parent: parentSpaceId,
      kind: "room",
    };
    if (insertIndex !== undefined) {
      query.insertIndex = String(insertIndex);
    }
    navigateTo({
      path: "/rooms/new",
      query,
    });
  }

  function openAddSubspaceToSpace(parentSpaceId: string) {
    const rootSpaceId = resolveRootSpaceIdForNavigation(parentSpaceId);
    navigateTo({
      path: "/rooms/new",
      query: { root: rootSpaceId, parent: parentSpaceId, kind: "space" },
    });
  }

  return {
    inviteTarget,
    canInviteToSpace,
    canInviteToRoom,
    canOpenRoomSettings,
    openRoomSettings,
    openInviteToRoom,
    openInviteToSpace,
    closeInviteOverlay,
    buildHomeSections,
    buildSpaceSections,
    canManageChildrenOnSpace,
    canReorderRootCategories,
    canAddSpaceChildren,
    hasJoinedNonSpaceRooms,
    onPersistRoomOrder,
    onMoveRoomBetweenCategories,
    onReorderRootCategories,
    resolveRoomInsertIndexForCategory,
    openAddRoomToSpace,
    openAddSubspaceToSpace,
  };
}
