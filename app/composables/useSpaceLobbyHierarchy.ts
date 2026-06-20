import type { MatrixClient } from "matrix-js-sdk";
import type { RoomCategoryGroup } from "~/composables/chat/chatPageTypes";
import { matrixRoomHasJoinedMembership } from "~/utils/matrixRoomChannelPermissions";
import { fetchSpaceHierarchyLobby } from "~/utils/spaceLobbyHierarchy";

export function useSpaceLobbyHierarchy(options: {
  client: Ref<MatrixClient | null>;
  selectedSpaceId: Ref<string | null>;
  matrixSyncPrepared: Ref<boolean>;
  isHomeSpace: (spaceId: string | null) => boolean;
  translateText: (key: string) => string;
  resolveMxcAvatarUrl: (mxcUrl: string | undefined) => string | undefined;
}) {
  const lobbyCategories = ref<RoomCategoryGroup[]>([]);
  let requestId = 0;
  let debounceTimerId: number | null = null;

  function isRoomJoined(roomId: string): boolean {
    const matrixClient = options.client.value;
    if (!matrixClient) {
      return false;
    }
    return matrixRoomHasJoinedMembership(matrixClient.getRoom(roomId));
  }

  async function loadLobby(spaceId: string) {
    const matrixClient = options.client.value;
    if (!matrixClient) {
      return;
    }
    const currentRequest = ++requestId;
    const categories = await fetchSpaceHierarchyLobby(
      matrixClient,
      spaceId,
      {
        generalCategoryLabel: options.translateText(
          "layout.spaceRoomsCategory",
        ),
        resolveAvatarUrl: options.resolveMxcAvatarUrl,
        isRoomJoined,
      },
    );
    if (currentRequest !== requestId) {
      return;
    }
    lobbyCategories.value = categories;
  }

  function scheduleLoadLobby(spaceId: string) {
    if (debounceTimerId !== null) {
      window.clearTimeout(debounceTimerId);
    }
    debounceTimerId = window.setTimeout(() => {
      debounceTimerId = null;
      void loadLobby(spaceId);
    }, 250);
  }

  function clearLobby() {
    requestId++;
    if (debounceTimerId !== null) {
      window.clearTimeout(debounceTimerId);
      debounceTimerId = null;
    }
    lobbyCategories.value = [];
  }

  watch(
    [
      options.client,
      options.selectedSpaceId,
      options.matrixSyncPrepared,
    ],
    ([matrixClient, spaceId, prepared]) => {
      if (!matrixClient || !prepared || options.isHomeSpace(spaceId)) {
        clearLobby();
        return;
      }
      scheduleLoadLobby(spaceId as string);
    },
    { immediate: true },
  );

  function refreshLobbyHierarchy() {
    const spaceId = options.selectedSpaceId.value;
    if (
      !options.client.value ||
      !options.matrixSyncPrepared.value ||
      options.isHomeSpace(spaceId) ||
      !spaceId
    ) {
      return;
    }
    scheduleLoadLobby(spaceId);
  }

  return {
    lobbyCategories,
    refreshLobbyHierarchy,
  };
}
