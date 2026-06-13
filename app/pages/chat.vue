<script setup lang="ts">
import { useAppI18n } from "~/composables/useAppI18n";
import { useChatMedia } from "~/composables/useChatMedia";
import { useRoomTyping } from "~/composables/useRoomTyping";
import { useGlobalMentionNotify } from "~/composables/useGlobalMentionNotify";
import { useNotificationSettings } from "~/composables/useNotificationSettings";
import { useMatrixSyncPrepared } from "~/composables/useMatrixSyncPrepared";
import { useSpaceUnreadById } from "~/composables/useSpaceUnreadById";
import { applyUnreadToRoomCategories } from "~/utils/roomCategoryUnread";
import {
  collectSpaceChildRoomIds,
  HOME_SPACE_ID,
} from "~/utils/spaceUnread";
import type { RoomNotificationLevel } from "~/utils/matrixNotificationRules";
import ChatOnboardingPanel from "~/components/Chat/Onboarding/ChatOnboardingPanel.vue";
import ChatDmStartPanel from "~/components/Chat/Onboarding/ChatDmStartPanel.vue";
import ChatPublicRoomsPanel from "~/components/Chat/Onboarding/ChatPublicRoomsPanel.vue";
import SpaceHomePanel from "~/components/Chat/SpaceHomePanel.vue";
import MatrixInvitePanel from "~/components/Chat/MatrixInvitePanel.vue";
import LeaveRoomConfirmPanel from "~/components/Chat/LeaveRoomConfirmPanel.vue";
import { canUserSendRoomMessage } from "~/utils/matrixRoomMessagePermissions";
import { canUserPinEvents } from "~/utils/matrixRoomPinnedEventsPermissions";
import { canPerformSpaceRoleAction } from "~/utils/decentraSpaceRolesPermissions";
import { useSpaceMembers } from "~/composables/useSpaceMembers";
import {
  getParentSpaceIds,
  getRoomType,
  buildSortedMemberItems,
} from "~/composables/chat/chatPageRoomHelpers";
import { type RoomCategoryGroup } from "~/composables/chat/chatPageTypes";
import { useChatTimelineWindow } from "~/composables/chat/useChatTimelineWindow";
import { useChatThreadPanels } from "~/composables/chat/useChatThreadPanels";
import { useChatSpaceRail } from "~/composables/chat/useChatSpaceRail";
import { useChatRoomSidebar } from "~/composables/chat/useChatRoomSidebar";
import { useChatMatrixEvents } from "~/composables/chat/useChatMatrixEvents";
import { useChatPageShell } from "~/composables/chat/useChatPageShell";
import { useSpaceLobbyHierarchy } from "~/composables/useSpaceLobbyHierarchy";

const {
  client,
  userId,
  getRooms,
  logout,
  loadOlderMessages,
  toggleReaction,
  reorderSpaceChildren,
  moveChannelBetweenSpaceParents,
  pinRoomEvent,
  unpinRoomEvent,
  markRoomAsRead,
  markThreadAsRead,
  joinRoomByIdOrAlias,
} = useMatrixClient();
const matrixSyncPrepared = useMatrixSyncPrepared(client);
const { translateText } = useAppI18n();
const {
  getSpaceAvatarUrl,
  getMemberAvatarUrl,
  getMediaUrl,
  resolveMediaBlobUrl,
} = useChatMedia(client as any);

const onboardingSubView = ref<null | "dm" | "public">(null);
const leftSidebarOpen = ref(true);
const rightSidebarOpen = ref(true);
const isMobile = ref(false);
const spaceRailExpanded = ref(false);

const selectedRoomId = useState<string | null>(
  "chat-selected-room-id",
  () => null,
);
const selectedSpaceId = useState<string | null>(
  "chat-selected-space-id",
  () => null,
);
const pendingRootSpaceId = ref<string | null>(null);
const suppressAutoRoomSelect = ref(false);
const lobbyJoiningRoomId = ref<string | null>(null);
const matrixRooms = ref<Array<Record<string, any>>>([]);
const spaceUnreadForRail = shallowRef<
  Record<
    string,
    {
      hasUnread?: boolean;
      hasMentionUnread?: boolean;
      totalCount?: number;
      highlightCount?: number;
    }
  >
>({});

const {
  unreadByRoomId,
  refreshUnread,
  scheduleMarkActiveRoomRead,
} = useRoomUnread({
  client,
  matrixRooms,
  selectedRoomId,
  markRoomAsRead,
});

let scheduleThreadNavRefresh = () => {};
let syncThreadPanelIfActive = (_roomId: string) => {};

function refreshRooms() {
  matrixRooms.value = getRooms();
  scheduleThreadNavRefresh();
  refreshUnread();
  refreshLobbyHierarchy();
}

const timeline = useChatTimelineWindow({
  client,
  selectedRoomId,
  loadOlderMessages,
  toggleReaction,
  translateText,
  getMemberAvatarUrl,
  getMediaUrl,
  scheduleMarkActiveRoomRead,
  onRoomMessagesUpdated: (roomId) => {
    syncThreadPanelIfActive(roomId);
    scheduleThreadNavRefresh();
  },
});

const {
  allMessages,
  messages,
  loadingOlder,
  loadingNewer,
  hasMoreOlderMessages,
  centerOnMessageId,
  stickToBottom,
  scrollIntentToken,
  preserveViewportOnPrepend,
  loadMessages,
  patchMessageReactions,
  scheduleLoadMessages,
  onComposerSend,
  onToggleReaction,
  onReachTop,
  onReachBottom,
  focusMessageInTimeline,
  isReactionRelatedEvent,
  clearLoadMessagesTimer,
  resetTimelineState,
  buildNoticeText,
  buildDeletedMessageText,
} = timeline;

const spaceRail = useChatSpaceRail({
  client,
  matrixRooms,
  selectedSpaceId,
  selectedRoomId,
  pendingRootSpaceId,
  translateText,
  getSpaceAvatarUrl,
  matrixSyncPrepared,
  spaceUnreadById: spaceUnreadForRail,
  allMessages,
  messages,
  suppressAutoRoomSelect,
});

const {
  roomItems,
  selectedSpaceName,
  visibleRoomsForSidebar,
  spaceMemberRoomIds,
  selectedSpaceIdRef,
  spaceIdsForUnread,
  homeRoomIdsForUnread,
  resolveHomeRoomIdsForUnread,
  setupSpaceRailWatchers,
  spaceRailItems,
} = spaceRail;

const selectedRoom = computed(() => {
  if (!selectedRoomId.value) {
    return null;
  }
  return client.value?.getRoom(selectedRoomId.value) ?? null;
});

function spaceRoleAllows(
  action:
    | "sendMessages"
    | "pinMessages"
    | "redactOthers"
    | "inviteMembers",
): boolean {
  const spaceId = selectedSpaceId.value;
  if (!spaceId || spaceId === HOME_SPACE_ID) {
    return true;
  }
  return canPerformSpaceRoleAction(
    client.value,
    spaceId,
    userId.value,
    action,
    selectedRoomId.value ?? undefined,
  );
}

const canPinInActiveRoom = computed(() => {
  const matrixClient = client.value;
  const roomId = selectedRoomId.value;
  const matrixUserId = userId.value;
  if (!matrixClient || !roomId || !matrixUserId) {
    return false;
  }
  if (!spaceRoleAllows("pinMessages")) {
    return false;
  }
  return canUserPinEvents(matrixClient, roomId, matrixUserId);
});

const threadPanels = useChatThreadPanels({
  client,
  userId,
  selectedRoomId,
  matrixSyncPrepared,
  unreadByRoomId,
  visibleRoomsForSidebar,
  selectedRoom,
  translateText,
  getMemberAvatarUrl,
  getMediaUrl,
  markThreadAsRead,
  refreshUnread,
  pinRoomEvent,
  unpinRoomEvent,
  canPinInActiveRoom,
  isMobile,
  rightSidebarOpen,
  buildNoticeText,
  buildDeletedMessageText,
  focusMessageInTimeline,
  hasMoreOlderMessages,
  loadOlderMessages,
  loadMessages,
});

scheduleThreadNavRefresh = threadPanels.scheduleThreadNavRefresh;
syncThreadPanelIfActive = threadPanels.syncThreadPanelIfActive;

const {
  rightSidebarView,
  activeThread,
  threadPanelAllMessages,
  activeThreadReplyTo,
  activeThreadEditTo,
  threadCenterOnMessageId,
  threadScrollIntentToken,
  activeReplyTo,
  activeEditTo,
  threadNavByRoomId,
  selectedRoomThreadEntries,
  roomThreadsPanelActive,
  membersPanelActive,
  pinnedPanelActive,
  activeRoomPinnedEventIds,
  selectedRoomPinnedEntries,
  threadPanelTitle,
  threadPanelStartedBy,
  setReplyTarget,
  clearReplyTarget,
  setEditTarget,
  clearEditTarget,
  openThreadInSidebar,
  openThreadFromRoomNav,
  closeActiveThread,
  closeRoomThreadsPanel,
  closePinnedMessagesPanel,
  togglePinnedMessagesPanel,
  toggleRoomThreadsPanel,
  openMembersPanel,
  jumpToMessageInThread,
  jumpToMessageInRoom,
  onPinMessage,
  onUnpinMessage,
  openThreadFromRoomThreadList,
  setActiveThreadReplyTarget,
  clearActiveThreadReply,
  setActiveThreadEditTarget,
  clearActiveThreadEditTarget,
  resetThreadStateIfRoomChanged,
  clearThreadNavRefreshTimer,
} = threadPanels;

const { typingLabel } = useRoomTyping({
  client,
  selectedRoomId,
  userId,
});

const roomSidebar = useChatRoomSidebar({
  client,
  userId,
  matrixRooms,
  selectedSpaceId,
  selectedRoomId,
  visibleRoomsForSidebar,
  selectedSpaceName,
  translateText,
  reorderSpaceChildren,
  moveChannelBetweenSpaceParents,
  refreshRooms,
});

const {
  inviteTarget,
  leaveTarget,
  canInviteToSpace,
  canInviteToRoom,
  canOpenRoomSettings,
  canLeaveRoom,
  openRoomSettings,
  openInviteToRoom,
  openInviteToSpace,
  closeInviteOverlay,
  openLeaveRoom,
  closeLeaveOverlay,
  buildHomeSections,
  buildSpaceSections,
  buildSpaceLobbySections,
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
} = roomSidebar;

function isHomeSpaceContext(spaceId: string | null): boolean {
  return spaceId === null || spaceId === HOME_SPACE_ID;
}

const { lobbyCategories: lobbyHierarchyCategories, refreshLobbyHierarchy } =
  useSpaceLobbyHierarchy({
    client,
    selectedSpaceId,
    matrixSyncPrepared,
    isHomeSpace: isHomeSpaceContext,
    translateText,
    resolveMxcAvatarUrl: (mxcUrl) => {
      const matrixClient = client.value;
      if (!mxcUrl || !matrixClient?.mxcUrlToHttp) {
        return undefined;
      }
      try {
        const httpUrl = matrixClient.mxcUrlToHttp(
          mxcUrl,
          40,
          40,
          "crop",
          false,
          true,
          true,
        ) as string;
        const accessToken = matrixClient.getAccessToken?.();
        if (!accessToken || !httpUrl.includes("/_matrix/")) {
          return httpUrl;
        }
        if (httpUrl.includes("access_token=")) {
          return httpUrl;
        }
        const separator = httpUrl.includes("?") ? "&" : "?";
        return `${httpUrl}${separator}access_token=${encodeURIComponent(
          accessToken,
        )}`;
      } catch {
        return undefined;
      }
    },
  });

function navigateToChatHome() {
  suppressAutoRoomSelect.value = true;
  onboardingSubView.value = null;
  selectedSpaceId.value = HOME_SPACE_ID;
  selectedRoomId.value = null;
  closeActiveThread();
  resetTimelineState();
  closeRoomThreadsPanel();
  closePinnedMessagesPanel();
}

function isInMatrixSpace(): boolean {
  const spaceId = selectedSpaceId.value;
  return spaceId !== null && spaceId !== HOME_SPACE_ID;
}

function navigateToSpaceHome() {
  suppressAutoRoomSelect.value = true;
  onboardingSubView.value = null;
  selectedRoomId.value = null;
  closeActiveThread();
  resetTimelineState();
  closeRoomThreadsPanel();
  closePinnedMessagesPanel();
}

function navigateAfterLeavingActiveRoom() {
  if (isInMatrixSpace()) {
    navigateToSpaceHome();
  } else {
    navigateToChatHome();
  }
}

function onLeaveConfirming(roomId: string) {
  if (selectedRoomId.value === roomId) {
    navigateAfterLeavingActiveRoom();
  }
}

function onRoomLeft(_leftRoomId: string) {
  navigateAfterLeavingActiveRoom();
  refreshRooms();
  closeLeaveOverlay();
}

const { spaceUnreadById } = useSpaceUnreadById({
  matrixSyncPrepared,
  unreadByRoomId,
  spaceIds: spaceIdsForUnread,
  sidebarRooms: roomItems,
  matrixRooms,
  homeRoomIds: homeRoomIdsForUnread,
  getRoomType,
  getParentSpaceIds,
});

watchEffect(() => {
  spaceUnreadForRail.value = spaceUnreadById.value;
});

const { memberGroups: spaceMemberGroups } = useSpaceMembers(
  selectedSpaceIdRef,
  spaceMemberRoomIds,
);

const spaceMemberCountLabel = computed(() => {
  const total = spaceMemberGroups.value.reduce(
    (sum, group) => sum + group.members.length,
    0,
  );
  if (total === 0) {
    return translateText("layout.members");
  }
  return translateText("layout.spaceMembersCount", {
    count: String(total),
  });
});

const selectedSpaceAvatarUrl = computed(() => {
  const spaceId = selectedSpaceId.value;
  if (!spaceId || isHomeSpaceContext(spaceId)) {
    return undefined;
  }
  return spaceRailItems.value.find((space) => space.id === spaceId)
    ?.avatarUrl;
});

const selectedSpaceTopic = computed(() => {
  const spaceId = selectedSpaceId.value;
  if (!spaceId || isHomeSpaceContext(spaceId)) {
    return undefined;
  }
  const spaceRoom = client.value?.getRoom(spaceId);
  const topic = spaceRoom?.currentState
    ?.getStateEvents?.("m.room.topic", "")
    ?.getContent?.()?.topic;
  return typeof topic === "string" && topic.length > 0 ? topic : undefined;
});

const spaceLobbyCategories = computed<RoomCategoryGroup[]>(() => {
  if (isHomeSpaceContext(selectedSpaceId.value)) {
    return [];
  }
  if (lobbyHierarchyCategories.value.length > 0) {
    return lobbyHierarchyCategories.value;
  }
  return buildSpaceLobbySections();
});

const roomCategoryStructure = computed<RoomCategoryGroup[]>(() => {
  if (selectedSpaceId.value === HOME_SPACE_ID) {
    return buildHomeSections();
  }
  return buildSpaceSections();
});

const roomCategories = computed<RoomCategoryGroup[]>(() => {
  unreadByRoomId.value;
  return applyUnreadToRoomCategories(
    roomCategoryStructure.value,
    unreadByRoomId.value,
    matrixSyncPrepared.value,
  ) as RoomCategoryGroup[];
});

const memberItems = computed(() =>
  buildSortedMemberItems(selectedRoom.value, getMemberAvatarUrl),
);

const canSendMessagesInActiveRoom = computed(() => {
  const matrixClient = client.value;
  const roomId = selectedRoomId.value;
  const matrixUserId = userId.value;
  if (!matrixClient || !roomId || !matrixUserId) {
    return false;
  }
  if (!spaceRoleAllows("sendMessages")) {
    return false;
  }
  return canUserSendRoomMessage(matrixClient, roomId, matrixUserId);
});

const {
  getRoomLevel: getRoomNotificationLevel,
  getSpaceLevel: getSpaceNotificationLevel,
  setRoomLevel: setRoomNotificationLevel,
  setSpaceLevel: setSpaceNotificationLevel,
} = useNotificationSettings({ client });

useGlobalMentionNotify({
  client,
  unreadByRoomId,
  selectedRoomId,
  getRoomDisplayName: (roomId) => {
    const room = roomItems.value.find((item) => item.roomId === roomId);
    return room?.name ?? translateText("layout.roomFallback");
  },
  getRoomNotificationLevel: (roomId) => {
    if (!matrixSyncPrepared.value) {
      return "default";
    }
    return getRoomNotificationLevel(roomId);
  },
});

function roomNotificationLevelForRoom(roomId: string): RoomNotificationLevel {
  if (!matrixSyncPrepared.value) {
    return "default";
  }
  return getRoomNotificationLevel(roomId);
}

function roomIdsUnderSpace(spaceId: string): string[] {
  const matrixRoomsById = new Map<string, unknown>(
    matrixRooms.value.map((room) => [room.roomId, room]),
  );
  return collectSpaceChildRoomIds(spaceId, {
    sidebarRooms: roomItems.value,
    matrixRoomsById,
    getRoomType,
    getParentSpaceIds,
    homeRoomIds: resolveHomeRoomIdsForUnread(),
  });
}

const selectedSpaceNotificationLevel = computed(() => {
  const spaceId = selectedSpaceId.value;
  if (!spaceId) {
    return "default" as const;
  }
  return getSpaceNotificationLevel(roomIdsUnderSpace(spaceId));
});

async function onSetRoomNotification(payload: {
  roomId: string;
  level: RoomNotificationLevel;
}) {
  await setRoomNotificationLevel(payload.roomId, payload.level);
  refreshUnread();
}

async function onSetSpaceNotification(level: RoomNotificationLevel) {
  const spaceId = selectedSpaceId.value;
  if (!spaceId) {
    return;
  }
  await setSpaceNotificationLevel(roomIdsUnderSpace(spaceId), level);
  refreshUnread();
}

watch(matrixSyncPrepared, (prepared) => {
  if (prepared) {
    refreshRooms();
  }
});

setupSpaceRailWatchers();

watch(selectedRoomId, (roomId) => {
  rightSidebarView.value = "members";
  hasMoreOlderMessages.value = true;
  activeReplyTo.value = null;
  activeEditTo.value = null;
  resetThreadStateIfRoomChanged(roomId);
  if (!roomId) {
    resetTimelineState();
    return;
  }
  loadMessages(roomId, { resetWindow: true });
  scheduleMarkActiveRoomRead();
});

watch(stickToBottom, (isAtBottom) => {
  if (isAtBottom) {
    scheduleMarkActiveRoomRead();
  }
});

function handleLogout() {
  logout();
  navigateTo("/");
}

function openHomeCreateRoom() {
  navigateTo("/rooms/new");
}

function openSpaceSettings() {
  if (!selectedSpaceId.value) {
    return;
  }
  if (selectedSpaceId.value === HOME_SPACE_ID) {
    return;
  }
  navigateTo(`/settings/space/${selectedSpaceId.value}`);
}

function openCreateSpace() {
  navigateTo("/spaces/new");
}

const pageShell = useChatPageShell({
  client,
  matrixRooms,
  selectedSpaceId,
  selectedRoomId,
  pendingRootSpaceId,
  leftSidebarOpen,
  rightSidebarOpen,
  isMobile,
  spaceRailExpanded,
  onboardingSubView,
  suppressAutoRoomSelect,
  refreshRooms,
  clearLoadMessagesTimer,
  clearThreadNavRefreshTimer,
});

const {
  scheduleSpaceHierarchyRefresh,
  closeMobileOverlays,
  toggleLeftSidebar,
  toggleSpaceRail,
  openHomeStartDm,
  openHomeExplorePublic,
  onDirectMessageStarted,
  onPublicRoomJoined,
  setupShellWatchers,
  mountShell,
  unmountShell,
} = pageShell;

function selectSpace(spaceId: string) {
  closeActiveThread();
  resetTimelineState();
  closeRoomThreadsPanel();
  closePinnedMessagesPanel();
  pageShell.selectSpace(spaceId);
}

function openSpaceLobby() {
  navigateToSpaceHome();
}

async function onJoinLobbyRoom(roomId: string) {
  if (lobbyJoiningRoomId.value) {
    return;
  }
  lobbyJoiningRoomId.value = roomId;
  try {
    const joinedRoomId = await joinRoomByIdOrAlias(roomId);
    refreshRooms();
    selectRoom(joinedRoomId);
  } catch (thrownError) {
    console.error("joinRoomByIdOrAlias failed", thrownError);
  } finally {
    lobbyJoiningRoomId.value = null;
  }
}

function selectRoom(roomId: string) {
  suppressAutoRoomSelect.value = false;
  pageShell.selectRoom(roomId, activeThread.value, closeActiveThread);
}

setupShellWatchers();
onMounted(mountShell);
onBeforeUnmount(unmountShell);

const { setupMatrixEventWatchers } = useChatMatrixEvents({
  client,
  selectedRoomId,
  selectedSpaceId,
  pinnedListVersion: threadPanels.pinnedListVersion,
  scheduleThreadNavRefresh: threadPanels.scheduleThreadNavRefresh,
  patchMessageReactions,
  scheduleLoadMessages,
  isReactionRelatedEvent,
  scheduleSpaceHierarchyRefresh,
  refreshRooms,
});

setupMatrixEventWatchers();
</script>

<template>
  <div
    class="decentra-shell relative flex h-dvh overflow-hidden bg-gray-100 dark:bg-gray-950"
  >
    <div
      v-if="isMobile && (leftSidebarOpen || rightSidebarOpen)"
      class="absolute inset-0 z-20 bg-black/50"
      @click="closeMobileOverlays"
    />

    <aside
      class="z-30 h-full overflow-hidden transition-all duration-200"
      :class="[
        isMobile
          ? spaceRailExpanded
            ? 'absolute left-0 top-0 w-[92vw] max-w-[544px]'
            : 'absolute left-0 top-0 w-[360px]'
          : leftSidebarOpen
            ? spaceRailExpanded
              ? 'relative w-[544px] shrink-0 border-r border-gray-200 dark:border-gray-800'
              : 'relative w-[360px] shrink-0 border-r border-gray-200 dark:border-gray-800'
            : 'relative w-0 shrink-0 border-r-0',
        isMobile
          ? leftSidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'
          : 'translate-x-0',
      ]"
    >
      <div class="flex h-full">
        <ChatSpaceList
          :spaces="spaceRailItems"
          :selected-space-id="selectedSpaceId"
          :expanded="spaceRailExpanded"
          @select-space="selectSpace"
          @toggle-expanded="toggleSpaceRail"
          @create-space="openCreateSpace"
        />
        <ChatRoomCategoryList
          :selected-space-name="selectedSpaceName"
          :categories="roomCategories"
          :selected-room-id="selectedRoomId"
          :can-reorder-categories="canReorderRootCategories"
          :can-add-children="canAddSpaceChildren"
          :can-add-to-parent="canManageChildrenOnSpace"
          :selected-root-space-id="
            selectedSpaceId === HOME_SPACE_ID ? null : selectedSpaceId
          "
          :threads-by-room-id="threadNavByRoomId"
          :active-thread-root-id="
            activeThread?.presentation === 'main'
              ? activeThread.rootEventId
              : null
          "
          :active-main-thread-room-id="
            activeThread?.presentation === 'main'
              ? activeThread.roomId
              : null
          "
          @select-room="selectRoom"
          @select-thread="openThreadFromRoomNav"
          @open-space-settings="openSpaceSettings"
          @add-room="(parentId, insertIndex) =>
            openAddRoomToSpace(parentId, insertIndex)"
          @add-subspace="openAddSubspaceToSpace"
          :can-invite-to-space="canInviteToSpace"
          :can-invite-to-room="canInviteToRoom"
          :can-open-room-settings="canOpenRoomSettings"
          :can-leave-room="canLeaveRoom"
          :resolve-room-insert-index="resolveRoomInsertIndexForCategory"
          @invite-space="openInviteToSpace"
          @invite-room="openInviteToRoom"
          @open-room-settings="openRoomSettings"
          @leave-room="openLeaveRoom"
          @open-home-start-dm="openHomeStartDm"
          @open-home-create-room="openHomeCreateRoom"
          @open-home-explore-public="openHomeExplorePublic"
          @open-space-lobby="openSpaceLobby"
          @persist-room-order="onPersistRoomOrder"
          @move-room-between-categories="onMoveRoomBetweenCategories"
          @reorder-root-categories="onReorderRootCategories"
          :get-room-notification-level="roomNotificationLevelForRoom"
          :space-notification-level="selectedSpaceNotificationLevel"
          @set-room-notification="onSetRoomNotification"
          @set-space-notification="onSetSpaceNotification"
        />
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
      >
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-panels-left-bottom"
          :aria-label="translateText('layout.toggleNavigation')"
          @click="toggleLeftSidebar"
        />
        <div class="min-w-0 flex-1">
          <template v-if="activeThread?.presentation === 'main'">
            <div class="flex min-w-0 items-center gap-1 text-sm">
              <UIcon
                name="i-lucide-hash"
                class="size-4 shrink-0 text-gray-500 dark:text-gray-400"
              />
              <span
                class="truncate font-semibold text-gray-800 dark:text-gray-100"
              >
                {{ selectedRoom?.name }}
              </span>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 shrink-0 text-gray-400"
              />
              <UIcon
                name="i-lucide-messages-square"
                class="size-4 shrink-0 text-gray-500 dark:text-gray-400"
              />
              <span
                class="min-w-0 truncate font-semibold text-gray-800
                       dark:text-gray-100"
              >
                {{ threadPanelTitle }}
              </span>
            </div>
            <p class="truncate text-xs text-gray-500 dark:text-gray-400">
              {{ translateText("chat.threadStartedBy") }}
              {{ threadPanelStartedBy }}
            </p>
          </template>
          <template v-else>
            <p
              class="truncate text-sm font-semibold text-gray-800
                     dark:text-gray-100"
            >
              {{ selectedRoom?.name || translateText("chat.selectRoom") }}
            </p>
            <p
              v-if="userId"
              class="truncate text-xs text-gray-500 dark:text-gray-400"
            >
              {{ translateText("chat.loggedInAs") }} {{ userId }}
            </p>
          </template>
        </div>
        <UButton
          v-if="activeThread?.presentation === 'main'"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          :aria-label="translateText('chat.threadBackToChannel')"
          @click="closeActiveThread"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-user-cog"
          :to="'/settings/account'"
          :aria-label="translateText('layout.openAccountSettings')"
        />
        <ChatRoomHeaderToolbar
          v-if="selectedRoomId"
          :threads-active="roomThreadsPanelActive && rightSidebarOpen"
          :pinned-active="pinnedPanelActive && rightSidebarOpen"
          :members-active="membersPanelActive && rightSidebarOpen"
          @open-threads="toggleRoomThreadsPanel"
          @open-pinned="togglePinnedMessagesPanel"
          @open-members="openMembersPanel"
        />
        <UButton size="sm" color="neutral" variant="soft" @click="handleLogout">
          {{ translateText("chat.signOut") }}
        </UButton>
      </header>

      <div
        v-if="!selectedRoomId"
        class="flex flex-1 items-center justify-center overflow-auto p-4"
      >
        <template v-if="isHomeSpaceContext(selectedSpaceId)">
          <ChatDmStartPanel
            v-if="onboardingSubView === 'dm'"
            @back="onboardingSubView = null"
            @started="onDirectMessageStarted"
          />
          <ChatPublicRoomsPanel
            v-else-if="onboardingSubView === 'public'"
            @back="onboardingSubView = null"
            @joined="onPublicRoomJoined"
          />
          <ChatOnboardingPanel
            v-else
            :show-header="!hasJoinedNonSpaceRooms"
            @open-dm="onboardingSubView = 'dm'"
            @open-create-room="navigateTo('/rooms/new')"
            @open-public-rooms="onboardingSubView = 'public'"
          />
        </template>
        <SpaceHomePanel
          v-else
          :space-name="selectedSpaceName"
          :space-avatar-url="selectedSpaceAvatarUrl"
          :space-topic="selectedSpaceTopic"
          :member-count-label="spaceMemberCountLabel"
          :categories="spaceLobbyCategories"
          :can-invite="canInviteToSpace"
          :joining-room-id="lobbyJoiningRoomId"
          @select-room="selectRoom"
          @join-room="onJoinLobbyRoom"
          @invite="openInviteToSpace"
          @open-settings="openSpaceSettings"
        />
      </div>
      <template v-else>
        <template v-if="activeThread?.presentation === 'main'">
          <ChatMessageList
            :messages="threadPanelAllMessages"
            :current-user-id="userId ?? undefined"
            :can-send-messages="canSendMessagesInActiveRoom"
            :pinned-event-ids="activeRoomPinnedEventIds"
            :resolve-media-blob-url="resolveMediaBlobUrl"
            :center-on-message-id="threadCenterOnMessageId"
            :scroll-intent-token="threadScrollIntentToken"
            is-thread-view
            @reply="setActiveThreadReplyTarget"
            @edit="setActiveThreadEditTarget"
            @open-reply-target="jumpToMessageInThread"
            @toggle-reaction="onToggleReaction"
          />
          <ChatTypingIndicator :label="typingLabel" />
          <ChatMessageInput
            :room-id="selectedRoomId"
            :disabled="!client"
            :frequent-scope-key="userId ?? undefined"
            :reply-to="activeThreadReplyTo"
            :edit-to="activeThreadEditTo"
            :thread-root-event-id="activeThread.rootEventId"
            @cancel-reply="clearActiveThreadReply"
            @cancel-edit="clearActiveThreadEditTarget"
            @send="onComposerSend"
          />
        </template>
        <template v-else>
          <ChatMessageList
            :messages="messages"
            :current-user-id="userId ?? undefined"
            :can-send-messages="canSendMessagesInActiveRoom"
            :can-pin="canPinInActiveRoom"
            :pinned-event-ids="activeRoomPinnedEventIds"
            :loading-older="loadingOlder"
            :loading-newer="loadingNewer"
            :center-on-message-id="centerOnMessageId"
            :stick-to-bottom="stickToBottom"
            :scroll-intent-token="scrollIntentToken"
            :preserve-viewport-on-prepend="preserveViewportOnPrepend"
            :resolve-media-blob-url="resolveMediaBlobUrl"
            @reach-top="onReachTop"
            @reach-bottom="onReachBottom"
            @reply="setReplyTarget"
            @edit="setEditTarget"
            @pin="onPinMessage"
            @unpin="onUnpinMessage"
            @open-thread="openThreadInSidebar"
            @open-thread-preview="openThreadInSidebar"
            @open-reply-target="jumpToMessageInRoom"
            @toggle-reaction="onToggleReaction"
          />
          <ChatTypingIndicator
            v-if="
              !activeThread || activeThread.presentation !== 'sidebar'
            "
            :label="typingLabel"
          />
          <ChatMessageInput
            v-if="
              !activeThread || activeThread.presentation !== 'sidebar'
            "
            :room-id="selectedRoomId"
            :disabled="!client"
            :frequent-scope-key="userId ?? undefined"
            :reply-to="activeReplyTo"
            :edit-to="activeEditTo"
            @cancel-reply="clearReplyTarget"
            @cancel-edit="clearEditTarget"
            @send="onComposerSend"
          />
        </template>
      </template>
    </main>

    <aside
      class="z-30 h-full overflow-hidden transition-all duration-200"
      :class="[
        isMobile
          ? 'absolute right-0 top-0 w-72'
          : rightSidebarOpen
            ? 'relative w-72 shrink-0 border-l border-gray-200 dark:border-gray-800'
            : 'relative w-0 shrink-0 border-l-0',
        isMobile
          ? rightSidebarOpen
            ? 'translate-x-0'
            : 'translate-x-full'
          : 'translate-x-0',
      ]"
    >
      <ChatThreadPanel
        v-if="
          activeThread?.presentation === 'sidebar' &&
            selectedRoomId &&
            activeThread.roomId === selectedRoomId
        "
        class="h-full min-h-0"
        :room-id="selectedRoomId"
        :root-event-id="activeThread.rootEventId"
        :title="threadPanelTitle"
        :started-by-name="threadPanelStartedBy"
        :messages="threadPanelAllMessages"
        :current-user-id="userId ?? undefined"
        :can-send-messages="canSendMessagesInActiveRoom"
        :pinned-event-ids="activeRoomPinnedEventIds"
        :disabled="!client"
        :reply-to="activeThreadReplyTo"
        :edit-to="activeThreadEditTo"
        :resolve-media-blob-url="resolveMediaBlobUrl"
        :center-on-message-id="threadCenterOnMessageId"
        :scroll-intent-token="threadScrollIntentToken"
        @close="closeActiveThread"
        @reply="setActiveThreadReplyTarget"
        @edit="setActiveThreadEditTarget"
        @open-reply-target="jumpToMessageInThread"
        @cancel-reply="clearActiveThreadReply"
        @cancel-edit="clearActiveThreadEditTarget"
        @send="onComposerSend"
        @toggle-reaction="onToggleReaction"
      />
      <ChatPinnedMessagesPanel
        v-else-if="pinnedPanelActive && selectedRoomId"
        :entries="selectedRoomPinnedEntries"
        @close="closePinnedMessagesPanel"
        @open-message="jumpToMessageInRoom"
      />
      <ChatRoomThreadListPanel
        v-else-if="roomThreadsPanelActive && selectedRoomId"
        :threads="selectedRoomThreadEntries"
        @close="closeRoomThreadsPanel"
        @open-thread="openThreadFromRoomThreadList"
      />
      <ChatMemberList
        v-else-if="selectedSpaceIdRef && spaceMemberGroups.length > 0"
        :grouped-members="spaceMemberGroups"
        :member-count-label="spaceMemberCountLabel"
      />
      <ChatMemberList v-else :members="memberItems" />
    </aside>

    <div
      v-if="inviteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center
             bg-black/50 p-4"
      @click.self="closeInviteOverlay"
    >
      <MatrixInvitePanel
        :target-room-id="inviteTarget.roomId"
        :target-label="inviteTarget.label"
        @close="closeInviteOverlay"
        @invited="closeInviteOverlay"
      />
    </div>

    <div
      v-if="leaveTarget"
      class="fixed inset-0 z-50 flex items-center justify-center
             bg-black/50 p-4"
      @click.self="closeLeaveOverlay"
    >
      <LeaveRoomConfirmPanel
        :target-room-id="leaveTarget.roomId"
        :target-label="leaveTarget.label"
        @close="closeLeaveOverlay"
        @confirming="onLeaveConfirming"
        @left="onRoomLeft"
      />
    </div>
  </div>
</template>
