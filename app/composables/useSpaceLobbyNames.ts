import type { MatrixClient } from "matrix-js-sdk";
import { fetchSpaceHierarchyRoomNames } from "~/utils/spaceLobbyHierarchy";

export function useSpaceLobbyNames(options: {
  client: Ref<MatrixClient | null>;
  selectedSpaceId: Ref<string | null>;
  matrixSyncPrepared: Ref<boolean>;
  isHomeSpace: (spaceId: string | null) => boolean;
}) {
  const lobbyRoomNamesById = ref<Record<string, string>>({});
  let requestId = 0;
  let debounceTimerId: number | null = null;

  async function loadNames(spaceId: string) {
    const matrixClient = options.client.value;
    if (!matrixClient) {
      return;
    }
    const currentRequest = ++requestId;
    const names = await fetchSpaceHierarchyRoomNames(
      matrixClient,
      spaceId,
    );
    if (currentRequest !== requestId) {
      return;
    }
    lobbyRoomNamesById.value = names;
  }

  function scheduleLoadNames(spaceId: string) {
    if (debounceTimerId !== null) {
      window.clearTimeout(debounceTimerId);
    }
    debounceTimerId = window.setTimeout(() => {
      debounceTimerId = null;
      void loadNames(spaceId);
    }, 250);
  }

  function clearLobbyNames() {
    requestId++;
    if (debounceTimerId !== null) {
      window.clearTimeout(debounceTimerId);
      debounceTimerId = null;
    }
    lobbyRoomNamesById.value = {};
  }

  watch(
    [
      options.client,
      options.selectedSpaceId,
      options.matrixSyncPrepared,
    ],
    ([matrixClient, spaceId, prepared]) => {
      if (!matrixClient || !prepared || options.isHomeSpace(spaceId)) {
        clearLobbyNames();
        return;
      }
      scheduleLoadNames(spaceId as string);
    },
    { immediate: true },
  );

  function refreshLobbyNames() {
    const spaceId = options.selectedSpaceId.value;
    if (
      !options.client.value ||
      !options.matrixSyncPrepared.value ||
      options.isHomeSpace(spaceId) ||
      !spaceId
    ) {
      return;
    }
    scheduleLoadNames(spaceId);
  }

  return {
    lobbyRoomNamesById,
    refreshLobbyNames,
  };
}
