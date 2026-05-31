import { RoomEvent } from "matrix-js-sdk";
import { resolveRootSpaceIdForHierarchy } from "~/utils/spaceRoomCategories";
import { HOME_SPACE_ID } from "~/utils/spaceUnread";
import {
  getMatrixRoomId,
  getParentSpaceIds,
  getRoomType,
} from "~/composables/chat/chatPageRoomHelpers";
import { MOBILE_BREAKPOINT } from "~/composables/chat/chatPageTypes";

export function useChatPageShell(options: {
  client: Ref<Record<string, any> | null>;
  matrixRooms: Ref<Array<Record<string, any>>>;
  selectedSpaceId: Ref<string | null>;
  selectedRoomId: Ref<string | null>;
  pendingRootSpaceId: Ref<string | null>;
  leftSidebarOpen: Ref<boolean>;
  rightSidebarOpen: Ref<boolean>;
  isMobile: Ref<boolean>;
  spaceRailExpanded: Ref<boolean>;
  onboardingSubView: Ref<null | "dm" | "public">;
  refreshRooms: () => void;
  clearLoadMessagesTimer: () => void;
  clearThreadNavRefreshTimer: () => void;
}) {
  const route = useRoute();
  const viewportInitialized = ref(false);
  let spaceHierarchyRefreshTimerId: number | null = null;

  function scheduleSpaceHierarchyRefresh() {
    if (spaceHierarchyRefreshTimerId !== null) {
      window.clearTimeout(spaceHierarchyRefreshTimerId);
    }
    options.refreshRooms();
    spaceHierarchyRefreshTimerId = window.setTimeout(() => {
      options.refreshRooms();
      spaceHierarchyRefreshTimerId = null;
    }, 800);
  }

  function resolveRootSpaceIdFromQuery(
    rawRoot: string | undefined,
    rawLegacySpace: string | undefined,
  ): string | null {
    const candidate = rawRoot || rawLegacySpace;
    if (!candidate) {
      return null;
    }
    options.refreshRooms();
    return resolveRootSpaceIdForHierarchy({
      spaceId: candidate,
      matrixRooms: options.matrixRooms.value,
      getRoomId: getMatrixRoomId,
      getRoomType,
      getParentSpaceIds,
    });
  }

  function applyRoomIdFromRouteQuery() {
    const rawRoom = route.query.room;
    const roomQuery = Array.isArray(rawRoom) ? rawRoom[0] : rawRoom;
    const rawRoot = route.query.root;
    const rootQuery = Array.isArray(rawRoot) ? rawRoot[0] : rawRoot;
    const rawSpace = route.query.space;
    const spaceQuery = Array.isArray(rawSpace) ? rawSpace[0] : rawSpace;
    const rootSpaceId = resolveRootSpaceIdFromQuery(
      typeof rootQuery === "string" ? rootQuery : undefined,
      typeof spaceQuery === "string" ? spaceQuery : undefined,
    );
    if (rootSpaceId) {
      options.pendingRootSpaceId.value = rootSpaceId;
      options.selectedSpaceId.value = rootSpaceId;
    }
    if (typeof roomQuery === "string" && roomQuery.length > 0) {
      if (!rootSpaceId) {
        options.selectedSpaceId.value = HOME_SPACE_ID;
      }
      options.selectedRoomId.value = roomQuery;
      options.refreshRooms();
      void navigateTo({ path: "/chat", query: {} }, { replace: true });
      scheduleSpaceHierarchyRefresh();
    } else if (rootSpaceId) {
      options.refreshRooms();
      void navigateTo({ path: "/chat", query: {} }, { replace: true });
      scheduleSpaceHierarchyRefresh();
    }
  }

  function closeMobileOverlays() {
    if (!options.isMobile.value) {
      return;
    }
    options.leftSidebarOpen.value = false;
    options.rightSidebarOpen.value = false;
  }

  function syncViewport(force = false) {
    if (!import.meta.client) {
      return;
    }
    const wasMobile = options.isMobile.value;
    options.isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;

    const shouldReset =
      force || !viewportInitialized.value || wasMobile !== options.isMobile.value;

    if (shouldReset) {
      options.leftSidebarOpen.value = !options.isMobile.value;
      options.rightSidebarOpen.value = !options.isMobile.value;
      options.spaceRailExpanded.value = false;
    }

    viewportInitialized.value = true;
  }

  const resizeHandler = () => syncViewport();

  function toggleLeftSidebar() {
    options.leftSidebarOpen.value = !options.leftSidebarOpen.value;
  }

  function toggleSpaceRail() {
    options.spaceRailExpanded.value = !options.spaceRailExpanded.value;
  }

  function selectSpace(spaceId: string) {
    options.selectedSpaceId.value = spaceId;
    if (options.isMobile.value) {
      options.leftSidebarOpen.value = false;
    }
  }

  function selectRoom(
    roomId: string,
    activeThread: { presentation: string; roomId: string } | null,
    closeActiveThread: () => void,
  ) {
    if (
      activeThread?.presentation === "main" &&
      activeThread.roomId === roomId
    ) {
      closeActiveThread();
    }
    options.selectedRoomId.value = roomId;
    if (options.isMobile.value) {
      options.leftSidebarOpen.value = false;
    }
  }

  function openHomeStartDm() {
    options.selectedSpaceId.value = HOME_SPACE_ID;
    options.selectedRoomId.value = null;
    options.onboardingSubView.value = "dm";
  }

  function openHomeExplorePublic() {
    options.selectedSpaceId.value = HOME_SPACE_ID;
    options.selectedRoomId.value = null;
    options.onboardingSubView.value = "public";
  }

  function onDirectMessageStarted(roomId: string) {
    options.onboardingSubView.value = null;
    options.selectedSpaceId.value = HOME_SPACE_ID;
    options.selectedRoomId.value = roomId;
    options.refreshRooms();
  }

  function onPublicRoomJoined(roomId: string) {
    options.onboardingSubView.value = null;
    options.selectedSpaceId.value = HOME_SPACE_ID;
    options.selectedRoomId.value = roomId;
    options.refreshRooms();
  }

  function setupShellWatchers() {
    watch(
      () => route.query.room,
      () => {
        applyRoomIdFromRouteQuery();
      },
      { immediate: true },
    );

    watch(
      [options.client, options.selectedSpaceId],
      (current, _previous, onCleanup) => {
        const matrixClient = current[0];
        const spaceId = current[1];
        if (!matrixClient || !spaceId || spaceId === HOME_SPACE_ID) {
          return;
        }
        const spaceRoom = matrixClient.getRoom(spaceId);
        if (!spaceRoom) {
          return;
        }
        const onSpaceStateUpdated = () => {
          scheduleSpaceHierarchyRefresh();
        };
        spaceRoom.on(RoomEvent.CurrentStateUpdated, onSpaceStateUpdated);
        onCleanup(() => {
          spaceRoom.off(RoomEvent.CurrentStateUpdated, onSpaceStateUpdated);
        });
      },
      { immediate: true },
    );
  }

  function mountShell() {
    syncViewport(true);
    window.addEventListener("resize", resizeHandler);
    if (options.client.value) {
      options.refreshRooms();
    }
  }

  function unmountShell() {
    if (!import.meta.client) {
      return;
    }
    options.clearLoadMessagesTimer();
    options.clearThreadNavRefreshTimer();
    if (spaceHierarchyRefreshTimerId !== null) {
      window.clearTimeout(spaceHierarchyRefreshTimerId);
      spaceHierarchyRefreshTimerId = null;
    }
    window.removeEventListener("resize", resizeHandler);
  }

  return {
    scheduleSpaceHierarchyRefresh,
    closeMobileOverlays,
    toggleLeftSidebar,
    toggleSpaceRail,
    selectSpace,
    selectRoom,
    openHomeStartDm,
    openHomeExplorePublic,
    onDirectMessageStarted,
    onPublicRoomJoined,
    setupShellWatchers,
    mountShell,
    unmountShell,
  };
}
