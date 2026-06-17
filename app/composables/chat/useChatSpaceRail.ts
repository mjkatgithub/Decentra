import { HOME_SPACE_ID } from "~/utils/spaceUnread";
import {
  getJoinedSpaceRoomIds,
  getJoinedSpaceIdsListedAsChild,
  isRoomListedUnderSpaceSubtree,
  isRoomUnderAncestorSpace,
  isTopLevelSpaceForRail,
} from "~/utils/spaceRoomCategories";
import type { RoomItem, SpaceItem } from "~/composables/chat/chatPageTypes";
import {
  getMatrixRoomId,
  getParentSpaceIds,
  getRoomType,
  isGroupChatRoom,
  isPersonalChatRoom,
  resolveSidebarRoomName,
} from "~/composables/chat/chatPageRoomHelpers";

export function useChatSpaceRail(options: {
  client: Ref<Record<string, any> | null>;
  matrixRooms: Ref<Array<Record<string, any>>>;
  selectedSpaceId: Ref<string | null>;
  selectedRoomId: Ref<string | null>;
  pendingRootSpaceId: Ref<string | null>;
  translateText: (key: string, params?: Record<string, string>) => string;
  getSpaceAvatarUrl: (spaceRoom: Record<string, any>) => string | undefined;
  matrixSyncPrepared: Ref<boolean>;
  spaceUnreadById: Ref<
    Record<
      string,
      {
        hasUnread?: boolean;
        hasMentionUnread?: boolean;
        totalCount?: number;
        highlightCount?: number;
      }
    >
  >;
  allMessages: Ref<unknown[]>;
  messages: Ref<unknown[]>;
  suppressAutoRoomSelect?: Ref<boolean>;
  spaceLobbyRoomIds?: Ref<ReadonlySet<string>>;
}) {
  const joinedSpaceIds = computed(() =>
    getJoinedSpaceRoomIds(
      options.matrixRooms.value.map((room) => ({
        roomId: room.roomId,
        getType: () => getRoomType(room),
      })),
    ),
  );

  const joinedSpaceIdsListedAsChild = computed(() =>
    getJoinedSpaceIdsListedAsChild(
      options.matrixRooms.value,
      getRoomType,
      getMatrixRoomId,
    ),
  );

  const spaceItems = computed<SpaceItem[]>(() => {
    const spaces = options.matrixRooms.value
      .filter((room) => getRoomType(room) === "m.space")
      .filter((room) =>
        isTopLevelSpaceForRail(
          room.roomId,
          joinedSpaceIds.value,
          joinedSpaceIdsListedAsChild.value,
        ),
      )
      .map((spaceRoom) => ({
        id: spaceRoom.roomId,
        name: spaceRoom.name || options.translateText("layout.spaceFallback"),
        avatarUrl: options.getSpaceAvatarUrl(spaceRoom),
      }));

    return [
      { id: HOME_SPACE_ID, name: options.translateText("layout.homeSpace") },
      ...spaces,
    ];
  });

  const roomItems = computed<RoomItem[]>(() => {
    return options.matrixRooms.value
      .filter((room) => getRoomType(room) !== "m.space")
      .map((room) => ({
        roomId: room.roomId,
        name: resolveSidebarRoomName(room, options.translateText),
        parentSpaceIds: getParentSpaceIds(room),
      }));
  });

  const selectedSpaceName = computed(() => {
    return (
      spaceItems.value.find((space) => space.id === options.selectedSpaceId.value)
        ?.name ?? options.translateText("layout.homeSpace")
    );
  });

  const visibleRooms = computed(() => {
    if (options.selectedSpaceId.value === HOME_SPACE_ID) {
      return roomItems.value.filter(
        (room) =>
          isPersonalChatRoom(
            room,
            options.matrixRooms.value,
            options.client.value,
          ) ||
          isGroupChatRoom(
            room,
            options.matrixRooms.value,
            options.client.value,
          ),
      );
    }
    if (!options.selectedSpaceId.value) {
      return [];
    }
    const activeSpaceId = options.selectedSpaceId.value;
    const roomsById = new Map<string, unknown>(
      options.matrixRooms.value.map((room) => [room.roomId, room]),
    );
    const roomDisplayName = (room: unknown) =>
      resolveSidebarRoomName(
        room as Record<string, unknown>,
        options.translateText,
      );

    return roomItems.value.filter((room) => {
      if (room.parentSpaceIds.length === 0) {
        return isRoomListedUnderSpaceSubtree(
          room.roomId,
          activeSpaceId,
          roomsById,
          getRoomType,
          roomDisplayName,
        );
      }
      if (
        isRoomUnderAncestorSpace({
          roomParentIds: room.parentSpaceIds,
          ancestorSpaceId: activeSpaceId,
          roomsById,
          getRoomType,
          getParentSpaceIds,
        })
      ) {
        return true;
      }
      return isRoomListedUnderSpaceSubtree(
        room.roomId,
        activeSpaceId,
        roomsById,
        getRoomType,
        roomDisplayName,
      );
    });
  });

  const visibleRoomsForSidebar = computed(() => visibleRooms.value);

  const spaceMemberRoomIds = computed(() =>
    visibleRoomsForSidebar.value.map((room) => room.roomId),
  );

  const selectedSpaceIdRef = computed(() => {
    const spaceId = options.selectedSpaceId.value;
    if (!spaceId || spaceId === HOME_SPACE_ID) {
      return null;
    }
    return spaceId;
  });

  const spaceIdsForUnread = computed(() =>
    spaceItems.value.map((space) => space.id),
  );

  function resolveHomeRoomIdsForUnread(): string[] {
    return roomItems.value
      .filter(
        (room) =>
          isPersonalChatRoom(
            room,
            options.matrixRooms.value,
            options.client.value,
          ) ||
          isGroupChatRoom(
            room,
            options.matrixRooms.value,
            options.client.value,
          ),
      )
      .map((room) => room.roomId);
  }

  const homeRoomIdsForUnread = computed(() => resolveHomeRoomIdsForUnread());

  const spaceRailItems = computed<SpaceItem[]>(() => {
    if (!options.matrixSyncPrepared.value) {
      return spaceItems.value;
    }
    const unreadBySpace = options.spaceUnreadById.value;
    return spaceItems.value.map((space) => {
      const unreadState = unreadBySpace[space.id];
      return {
        ...space,
        hasUnread: unreadState?.hasUnread ?? false,
        hasMentionUnread: unreadState?.hasMentionUnread ?? false,
        totalCount: unreadState?.totalCount ?? 0,
        highlightCount: unreadState?.highlightCount ?? 0,
      };
    });
  });

  function setupSpaceRailWatchers() {
    watch(
      spaceItems,
      (spaces) => {
        if (options.pendingRootSpaceId.value) {
          const pendingId = options.pendingRootSpaceId.value;
          const pendingInRail = spaces.some(
            (space) => space.id === pendingId,
          );
          const matrixClient = options.client.value;
          const pendingRoom = matrixClient?.getRoom(pendingId);
          if (
            pendingInRail ||
            (pendingRoom &&
              getRoomType(pendingRoom) === "m.space" &&
              pendingRoom.getMyMembership?.() === "join")
          ) {
            options.selectedSpaceId.value = pendingId;
            options.pendingRootSpaceId.value = null;
            return;
          }
        }
        if (spaces.length === 0) {
          options.selectedSpaceId.value = null;
          return;
        }
        const currentId = options.selectedSpaceId.value;
        if (!currentId || currentId === HOME_SPACE_ID) {
          if (!currentId && spaces.length > 0) {
            options.selectedSpaceId.value = HOME_SPACE_ID;
          }
          return;
        }
        const selectedExists = spaces.some(
          (space) => space.id === currentId,
        );
        if (selectedExists) {
          return;
        }
        const matrixClient = options.client.value;
        const selectedRoom = matrixClient?.getRoom(currentId);
        if (
          selectedRoom &&
          getRoomType(selectedRoom) === "m.space" &&
          selectedRoom.getMyMembership?.() === "join"
        ) {
          return;
        }
        options.selectedSpaceId.value = HOME_SPACE_ID;
        options.selectedRoomId.value = null;
      },
      { immediate: true },
    );

    watch(
      visibleRooms,
      (rooms) => {
        const activeRoomId = options.selectedRoomId.value;
        if (!activeRoomId) {
          return;
        }
        const selectedExists = rooms.some(
          (room) => room.roomId === activeRoomId,
        );
        if (!selectedExists) {
          const lobbyRoomIds = options.spaceLobbyRoomIds?.value;
          if (lobbyRoomIds?.has(activeRoomId)) {
            return;
          }
          options.selectedRoomId.value = null;
          options.allMessages.value = [];
          options.messages.value = [];
        }
      },
      { immediate: true },
    );
  }

  return {
    joinedSpaceIds,
    joinedSpaceIdsListedAsChild,
    spaceItems,
    roomItems,
    selectedSpaceName,
    visibleRooms,
    visibleRoomsForSidebar,
    spaceMemberRoomIds,
    selectedSpaceIdRef,
    spaceIdsForUnread,
    homeRoomIdsForUnread,
    spaceRailItems,
    resolveHomeRoomIdsForUnread,
    setupSpaceRailWatchers,
    getRoomType,
    getParentSpaceIds,
    getMatrixRoomId,
  };
}
