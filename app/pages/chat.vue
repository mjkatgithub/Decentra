<script setup lang="ts">
import {
  ClientEvent,
  EventType,
  MatrixEventEvent,
  RoomEvent,
} from "matrix-js-sdk";
import { useAppI18n } from "~/composables/useAppI18n";
import { useChatMedia } from "~/composables/useChatMedia";
import { useRoomTyping } from "~/composables/useRoomTyping";
import ChatOnboardingPanel from "~/components/Chat/Onboarding/ChatOnboardingPanel.vue";
import ChatDmStartPanel from "~/components/Chat/Onboarding/ChatDmStartPanel.vue";
import ChatPublicRoomsPanel from "~/components/Chat/Onboarding/ChatPublicRoomsPanel.vue";
import MatrixInvitePanel from "~/components/Chat/MatrixInvitePanel.vue";
import {
  canUserInviteToChannel,
  isJoinedRoom,
} from "~/utils/matrixRoomChannelPermissions";
import {
  buildReactionSummaryByEventId,
  buildRoomThreadNavEntries,
  mapTimelineEventsToMessages,
  resolvePreservedTimelineWindow,
  resolveTimelineWindowSelection,
  type ChatTimelineReply,
  type ThreadNavEntry,
} from "~/utils/chatTimeline";
import {
  buildSpaceRoomCategories,
  getJoinedSpaceRoomIds,
  getJoinedSpaceIdsListedAsChild,
  isRoomListedUnderSpaceSubtree,
  isRoomUnderAncestorSpace,
  isTopLevelSpaceForRail,
  parseSpaceChildEvents,
  resolveRootSpaceIdForHierarchy,
  sortParsedSpaceChildren,
} from "~/utils/spaceRoomCategories";
import { canUserSendRoomMessage } from "~/utils/matrixRoomMessagePermissions";
import { canUserPinEvents } from "~/utils/matrixRoomPinnedEventsPermissions";
import { getPinnedEventIds } from "~/utils/matrixRoomPinnedEvents";
import { buildPinnedMessageEntries } from "~/utils/matrixPinnedMessageEntries";
import {
  canManageSpaceChildren,
  canUserSendSpaceChildState,
} from "~/utils/matrixSpaceHierarchyPermissions";
import { canPerformSpaceRoleAction } from "~/utils/decentraSpaceRolesPermissions";
import { useSpaceMembers } from "~/composables/useSpaceMembers";
import { getRoomNameFromState } from "~/utils/matrixRoomMetadata";
import {
  isHomeGroupChatFromCounts,
  isPersonalChatFromCounts,
} from "~/utils/homeRoomCategories";
import type { Room } from "matrix-js-sdk";

type PresenceStatus = "online" | "away" | "busy" | "offline" | "unknown";

interface ChatMessage {
  id: string;
  kind: "message" | "notice";
  isDecryptionError?: boolean;
  isMessageDeleted?: boolean;
  senderId: string;
  senderName: string;
  avatarUrl?: string;
  body: string;
  replyTo?: ChatTimelineReply;
  media?: {
    url: string;
    mxcUrl: string;
    mimetype?: string;
    isEncrypted?: boolean;
    encryptionInfo?: Record<string, any>;
    info?: {
      w?: number;
      h?: number;
      size?: number;
    };
  };
  reactions: Array<{
    emoji: string;
    count: number;
    hasOwnReaction: boolean;
    ownReactionEventIds: string[];
  }>;
  readBy: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string;
  }>;
  threadSummary?: {
    replyCount: number;
    lastReply?: {
      eventId: string;
      senderName: string;
      body: string;
      originServerTs: number;
    };
  };
  isEdited?: boolean;
  editTargetEventId?: string;
}

type ThreadPresentation = "sidebar" | "main";
type RightSidebarView = "members" | "threads" | "pinned";

interface ActiveThreadState {
  roomId: string;
  rootEventId: string;
  presentation: ThreadPresentation;
}

interface SpaceItem {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface RoomItem {
  roomId: string;
  name: string;
  parentSpaceIds: string[];
}

interface RoomCategoryGroup {
  id: string;
  name: string;
  kind: "root" | "subspace";
  subspaceRoomId?: string;
  nestingDepth?: number;
  parentSubspaceId?: string;
  rootChildAnchorIds: string[];
  /** Power-level: may send m.space.child on the parent of these rooms */
  canReorderRooms: boolean;
  rooms: Array<{ roomId: string; name: string; hasUnread?: boolean }>;
}

interface MemberItem {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  status: PresenceStatus;
}

const MOBILE_BREAKPOINT = 1024;
const HOME_SPACE_ID = "__home__";
const INITIAL_TIMELINE_WINDOW_SIZE = 80;
const SCROLL_WINDOW_EXPAND_STEP = 40;
const JUMP_TO_MESSAGE_MAX_PAGINATIONS = 20;

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
} = useMatrixClient();
const { translateText } = useAppI18n();
const {
  getSpaceAvatarUrl,
  getMemberAvatarUrl,
  getMediaUrl,
  resolveMediaBlobUrl,
} = useChatMedia(client as any);

const route = useRoute();
const onboardingSubView = ref<null | "dm" | "public">(null);

const selectedRoomId = ref<string | null>(null);
const selectedSpaceId = ref<string | null>(null);
/** Keeps root space selected while the space rail list is still syncing. */
const pendingRootSpaceId = ref<string | null>(null);
const allMessages = ref<ChatMessage[]>([]);
const messages = ref<ChatMessage[]>([]);
const matrixRooms = ref<Array<Record<string, any>>>([]);
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
const { typingLabel } = useRoomTyping({
  client,
  selectedRoomId,
  userId,
});
const loadingOlder = ref(false);
const loadingNewer = ref(false);
const hasMoreOlderMessages = ref(true);
const windowStartIndex = ref(0);
const windowEndIndex = ref(0);
const centerOnMessageId = ref<string | undefined>(undefined);
const threadCenterOnMessageId = ref<string | undefined>(undefined);
const stickToBottom = ref(false);
const scrollIntentToken = ref(0);
const threadScrollIntentToken = ref(0);
const preserveViewportOnPrepend = ref(false);
const activeReplyTo = ref<ChatMessage["replyTo"] | null>(null);
const activeEditTo = ref<{ eventId: string; body: string } | null>(null);
const loadMessagesTimerId = ref<number | null>(null);
const leftSidebarOpen = ref(true);
const rightSidebarOpen = ref(true);
const rightSidebarView = ref<RightSidebarView>("members");
const isMobile = ref(false);
const viewportInitialized = ref(false);
const spaceRailExpanded = ref(false);
const activeThread = ref<ActiveThreadState | null>(null);
const threadPanelAllMessages = ref<ChatMessage[]>([]);
const activeThreadReplyTo = ref<ChatMessage["replyTo"] | null>(null);
const activeThreadEditTo = ref<{ eventId: string; body: string } | null>(null);
const threadNavVersion = ref(0);
const pinnedListVersion = ref(0);
let threadNavRefreshTimerId: number | null = null;
const THREAD_NAV_REFRESH_MS = 250;

function getRoomType(room: Record<string, any>): string | undefined {
  return (room as { getType?: () => string }).getType?.();
}

function getParentSpaceIds(room: Record<string, any>): string[] {
  const currentState = room.currentState;
  const stateEvents = currentState?.getStateEvents?.("m.space.parent");

  if (!stateEvents) {
    return [];
  }

  const normalizedEvents = Array.isArray(stateEvents)
    ? stateEvents
    : [stateEvents];

  return normalizedEvents
    .map((stateEvent) => stateEvent?.getStateKey?.())
    .filter((spaceId): spaceId is string => Boolean(spaceId));
}

function getMatrixRoomId(room: unknown): string {
  return String((room as { roomId: string }).roomId);
}

function refreshRooms() {
  matrixRooms.value = getRooms();
  scheduleThreadNavRefresh();
  refreshUnread();
}

function toCategoryRoomItem(room: { roomId: string; name: string }) {
  return {
    roomId: room.roomId,
    name: room.name,
    hasUnread: unreadByRoomId.value[room.roomId]?.hasUnread ?? false,
  };
}

function scheduleThreadNavRefresh() {
  if (!import.meta.client) {
    threadNavVersion.value += 1;
    return;
  }
  if (threadNavRefreshTimerId !== null) {
    window.clearTimeout(threadNavRefreshTimerId);
  }
  threadNavRefreshTimerId = window.setTimeout(() => {
    threadNavRefreshTimerId = null;
    threadNavVersion.value += 1;
  }, THREAD_NAV_REFRESH_MS);
}

const joinedSpaceIds = computed(() =>
  getJoinedSpaceRoomIds(
    matrixRooms.value.map((room) => ({
      roomId: room.roomId,
      getType: () => getRoomType(room),
    })),
  ),
);

const joinedSpaceIdsListedAsChild = computed(() =>
  getJoinedSpaceIdsListedAsChild(
    matrixRooms.value,
    getRoomType,
    getMatrixRoomId,
  ),
);

const spaceItems = computed<SpaceItem[]>(() => {
  const spaces = matrixRooms.value
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
      name: spaceRoom.name || translateText("layout.spaceFallback"),
      avatarUrl: getSpaceAvatarUrl(spaceRoom),
    }));

  return [
    { id: HOME_SPACE_ID, name: translateText("layout.homeSpace") },
    ...spaces,
  ];
});

function resolveSidebarRoomName(room: Record<string, unknown>): string {
  const rawName = String((room as { name?: string }).name ?? "").trim();
  if (rawName) {
    return rawName;
  }
  const fromState = getRoomNameFromState(room as Room).trim();
  if (fromState) {
    return fromState;
  }
  return translateText("layout.roomFallback");
}

const roomItems = computed<RoomItem[]>(() => {
  return matrixRooms.value
    .filter((room) => getRoomType(room) !== "m.space")
    .map((room) => ({
      roomId: room.roomId,
      name: resolveSidebarRoomName(room),
      parentSpaceIds: getParentSpaceIds(room),
    }));
});

const selectedSpaceName = computed(() => {
  return (
    spaceItems.value.find((space) => space.id === selectedSpaceId.value)
      ?.name ?? translateText("layout.homeSpace")
  );
});

const visibleRooms = computed(() => {
  if (selectedSpaceId.value === HOME_SPACE_ID) {
    return roomItems.value;
  }
  if (!selectedSpaceId.value) {
    return [];
  }
  const activeSpaceId = selectedSpaceId.value;
  const roomsById = new Map<string, unknown>(
    matrixRooms.value.map((room) => [room.roomId, room]),
  );
  const roomDisplayName = (room: unknown) =>
    resolveSidebarRoomName(room as Record<string, unknown>);

  return roomItems.value.filter((room) => {
    if (room.parentSpaceIds.length === 0) {
      return activeSpaceId === HOME_SPACE_ID;
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

const spaceChildRoomIds = computed(() =>
  visibleRoomsForSidebar.value.map((room) => room.roomId),
);

const selectedSpaceIdRef = computed(() => {
  const spaceId = selectedSpaceId.value;
  if (!spaceId || spaceId === HOME_SPACE_ID) {
    return null;
  }
  return spaceId;
});

const { memberGroups: spaceMemberGroups } = useSpaceMembers(
  selectedSpaceIdRef,
  spaceChildRoomIds,
);

const spaceMemberCountLabel = computed(() => {
  const total = spaceMemberGroups.value.reduce(
    (sum, group) => sum + group.members.length,
    0,
  );
  if (total === 0) {
    return translateText("layout.members");
  }
  return translateText("layout.spaceMembersCount", { count: String(total) });
});

const inviteTarget = ref<{ roomId: string; label: string } | null>(null);

const canInviteToSpace = computed(() => {
  const spaceId = selectedSpaceId.value;
  if (!spaceId || spaceId === HOME_SPACE_ID) {
    return false;
  }
  return canPerformSpaceRoleAction(
    client.value,
    spaceId,
    userId.value,
    "inviteMembers",
    selectedRoomId.value ?? undefined,
  );
});

function canInviteToRoom(roomId: string): boolean {
  const matrixClient = client.value;
  const matrixUserId = userId.value;
  const matrixRoom = matrixRooms.value.find(
    (entry) => entry.roomId === roomId,
  );
  if (isDirectMessageRoom(roomId, matrixRoom)) {
    return false;
  }
  const spaceId = selectedSpaceId.value;
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
  return isJoinedRoom(client.value, roomId);
}

function openRoomSettings(roomId: string) {
  const query: Record<string, string> = { room: roomId };
  const rootId = selectedSpaceId.value;
  if (rootId && rootId !== HOME_SPACE_ID) {
    query.root = rootId;
  }
  navigateTo({
    path: `/settings/room/${roomId}`,
    query,
  });
}

function openInviteToRoom(roomId: string) {
  const matrixClient = client.value;
  const label =
    matrixClient?.getRoom(roomId)?.name ||
    translateText("layout.roomFallback");
  inviteTarget.value = { roomId, label };
}

function openInviteToSpace() {
  const spaceId = selectedSpaceId.value;
  if (!spaceId || spaceId === HOME_SPACE_ID) {
    return;
  }
  inviteTarget.value = {
    roomId: spaceId,
    label: selectedSpaceName.value,
  };
}

function closeInviteOverlay() {
  inviteTarget.value = null;
}

function openHomeStartDm() {
  selectedSpaceId.value = HOME_SPACE_ID;
  selectedRoomId.value = null;
  onboardingSubView.value = "dm";
}

function openHomeCreateRoom() {
  navigateTo("/rooms/new");
}

function openHomeExplorePublic() {
  selectedSpaceId.value = HOME_SPACE_ID;
  selectedRoomId.value = null;
  onboardingSubView.value = "public";
}

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

const hasJoinedNonSpaceRooms = computed(() => {
  return matrixRooms.value.some((room) => {
    if (getRoomType(room) === "m.space") {
      return false;
    }
    return room.getMyMembership?.() === "join";
  });
});

const roomCategories = computed<RoomCategoryGroup[]>(() => {
  unreadByRoomId.value;
  if (selectedSpaceId.value === HOME_SPACE_ID) {
    return buildHomeSections();
  }
  return buildSpaceSections();
});

function canManageChildrenOnSpace(spaceRoomId: string): boolean {
  return canManageSpaceChildren(
    client.value,
    spaceRoomId,
    userId.value,
  );
}

const canReorderRootCategories = computed(() => {
  const rootId = selectedSpaceId.value;
  if (!rootId || rootId === HOME_SPACE_ID) {
    return false;
  }
  return canManageChildrenOnSpace(rootId);
});

const canAddSpaceChildren = computed(() => canReorderRootCategories.value);

function buildHomeSections(): RoomCategoryGroup[] {
  const personalRooms = visibleRoomsForSidebar.value.filter((room) =>
    isPersonalChatRoom(room),
  );
  const groupRooms = visibleRoomsForSidebar.value.filter((room) =>
    isGroupChatRoom(room),
  );

  const categories: RoomCategoryGroup[] = [];
  if (personalRooms.length > 0) {
    categories.push({
      id: "personal-chats",
      name: translateText("layout.personalChats"),
      kind: "root",
      rootChildAnchorIds: [],
      canReorderRooms: false,
      rooms: personalRooms.map((room) => toCategoryRoomItem(room)),
    });
  }
  if (groupRooms.length > 0) {
    categories.push({
      id: "group-chats",
      name: translateText("layout.groupChats"),
      kind: "root",
      rootChildAnchorIds: [],
      canReorderRooms: false,
      rooms: groupRooms.map((room) => toCategoryRoomItem(room)),
    });
  }
  return categories;
}

function buildSpaceSections(): RoomCategoryGroup[] {
  const selectedId = selectedSpaceId.value;
  if (!selectedId || selectedId === HOME_SPACE_ID) {
    return [];
  }
  const built = buildSpaceRoomCategories({
    rootSpaceId: selectedId,
    matrixRooms: matrixRooms.value,
    getRoomType,
    getRoomId: getMatrixRoomId,
    getRoomDisplayName: (room) =>
      String(
        (room as { name?: string }).name ||
          translateText("layout.roomFallback"),
      ),
    generalCategoryLabel: translateText("layout.spaceRoomsCategory"),
  });
  const matrixClient = client.value;
  const matrixUserId = userId.value;
  const visibleRoomIdSet = new Set(
    visibleRoomsForSidebar.value.map((room) => room.roomId),
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
        .map((room) => toCategoryRoomItem(room));
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
    .filter((category) => category.rooms.length > 0 || category.kind === "subspace");
}

const selectedRoom = computed(() => {
  if (!selectedRoomId.value) {
    return null;
  }
  return client.value?.getRoom(selectedRoomId.value) ?? null;
});

const memberItems = computed<MemberItem[]>(() => {
  const room = selectedRoom.value;
  if (!room) {
    return [];
  }

  return room
    .getMembers()
    .map((member) => toMemberItem(member))
    .sort((memberA, memberB) => {
      const rank = {
        online: 0,
        busy: 1,
        away: 2,
        offline: 3,
        unknown: 4,
      } as const;
      const statusRankDiff = rank[memberA.status] - rank[memberB.status];
      if (statusRankDiff !== 0) {
        return statusRankDiff;
      }
      return memberA.displayName.localeCompare(memberB.displayName);
    });
});

const threadNavByRoomId = computed<Record<string, ThreadNavEntry[]>>(() => {
  void threadNavVersion.value;
  const matrixClient = client.value;
  if (!matrixClient) {
    return {};
  }
  const out: Record<string, ThreadNavEntry[]> = {};
  for (const room of matrixRooms.value) {
    if (getRoomType(room) === "m.space") {
      continue;
    }
    const joinedRoom = matrixClient.getRoom(room.roomId);
    if (!joinedRoom) {
      continue;
    }
    const entries = buildRoomThreadNavEntries(joinedRoom);
    if (entries.length > 0) {
      out[room.roomId] = entries;
    }
  }
  return out;
});

const selectedRoomThreadEntries = computed<ThreadNavEntry[]>(() => {
  void threadNavVersion.value;
  const roomId = selectedRoomId.value;
  const matrixClient = client.value;
  if (!roomId || !matrixClient) {
    return [];
  }
  const room = matrixClient.getRoom(roomId);
  if (!room) {
    return [];
  }
  return buildRoomThreadNavEntries(room, { maxAgeDays: null });
});

const roomThreadsPanelActive = computed(() => {
  return rightSidebarView.value === "threads";
});

const membersPanelActive = computed(() => {
  return rightSidebarView.value === "members";
});

const pinnedPanelActive = computed(() => {
  return rightSidebarView.value === "pinned";
});

const activeRoomPinnedEventIds = computed(() => {
  pinnedListVersion.value;
  const matrixClient = client.value;
  const roomId = selectedRoomId.value;
  if (!matrixClient || !roomId) {
    return [];
  }
  return getPinnedEventIds(matrixClient, roomId);
});

const selectedRoomPinnedEntries = computed(() => {
  pinnedListVersion.value;
  const room = selectedRoom.value;
  if (!room) {
    return [];
  }
  return buildPinnedMessageEntries(
    room as never,
    activeRoomPinnedEventIds.value,
    {
      unavailableSnippet: translateText("chat.pinnedMessageUnavailable"),
      resolveSenderName: (_event, senderId) => {
        const member = room.getMember?.(senderId);
        return member?.name || senderId;
      },
    },
  );
});

const threadPanelTitle = computed(() => {
  const rootId = activeThread.value?.rootEventId;
  const rootMessage = rootId
    ? threadPanelAllMessages.value.find((message) => message.id === rootId)
    : undefined;
  if (!rootMessage || rootMessage.kind !== "message") {
    return translateText("chat.threadAction");
  }
  const line = rootMessage.body.split("\n")[0]?.trim() ?? "";
  const clipped =
    line.length > 100 ? `${line.slice(0, 97)}...` : line;
  return clipped || translateText("chat.threadAction");
});

const threadPanelStartedBy = computed(() => {
  const rootId = activeThread.value?.rootEventId;
  const rootMessage = rootId
    ? threadPanelAllMessages.value.find((message) => message.id === rootId)
    : undefined;
  return rootMessage?.senderName ?? "";
});

watch(
  spaceItems,
  (spaces) => {
    if (pendingRootSpaceId.value) {
      const pendingId = pendingRootSpaceId.value;
      const pendingInRail = spaces.some((space) => space.id === pendingId);
      const matrixClient = client.value;
      const pendingRoom = matrixClient?.getRoom(pendingId);
      if (
        pendingInRail ||
        (pendingRoom &&
          getRoomType(pendingRoom) === "m.space" &&
          pendingRoom.getMyMembership?.() === "join")
      ) {
        selectedSpaceId.value = pendingId;
        pendingRootSpaceId.value = null;
        return;
      }
    }
    if (spaces.length === 0) {
      selectedSpaceId.value = null;
      return;
    }
    const currentId = selectedSpaceId.value;
    if (!currentId || currentId === HOME_SPACE_ID) {
      return;
    }
    const selectedExists = spaces.some((space) => space.id === currentId);
    if (selectedExists) {
      return;
    }
    const matrixClient = client.value;
    const selectedRoom = matrixClient?.getRoom(currentId);
    if (
      selectedRoom &&
      getRoomType(selectedRoom) === "m.space" &&
      selectedRoom.getMyMembership?.() === "join"
    ) {
      return;
    }
    const firstRealSpace = spaces.find((space) => space.id !== HOME_SPACE_ID);
    selectedSpaceId.value = firstRealSpace?.id ?? spaces[0]?.id ?? null;
  },
  { immediate: true },
);

watch(
  visibleRooms,
  (rooms) => {
    if (rooms.length === 0) {
      selectedRoomId.value = null;
      allMessages.value = [];
      messages.value = [];
      return;
    }
    const selectedExists = rooms.some(
      (room) => room.roomId === selectedRoomId.value,
    );
    if (!selectedExists) {
      const firstRoom = rooms[0];
      if (firstRoom) {
        selectedRoomId.value = firstRoom.roomId;
      }
    }
  },
  { immediate: true },
);

watch(selectedRoomId, (roomId) => {
  rightSidebarView.value = "members";
  hasMoreOlderMessages.value = true;
  activeReplyTo.value = null;
  activeEditTo.value = null;
  if (
    activeThread.value &&
    roomId &&
    activeThread.value.roomId !== roomId
  ) {
    activeThread.value = null;
    threadPanelAllMessages.value = [];
    activeThreadReplyTo.value = null;
    activeThreadEditTo.value = null;
  }
  if (!roomId) {
    activeThread.value = null;
    threadPanelAllMessages.value = [];
    activeThreadReplyTo.value = null;
    activeThreadEditTo.value = null;
    allMessages.value = [];
    messages.value = [];
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

function setReplyTarget(replyTarget: ChatTimelineReply) {
  activeEditTo.value = null;
  activeReplyTo.value = replyTarget;
}

function clearReplyTarget() {
  activeReplyTo.value = null;
}

function setEditTarget(editTarget: { eventId: string; body: string }) {
  activeReplyTo.value = null;
  activeEditTo.value = editTarget;
}

function clearEditTarget() {
  activeEditTo.value = null;
}

function loadThreadPanelMessages() {
  const threadState = activeThread.value;
  const matrixClient = client.value;
  if (!threadState || !matrixClient) {
    threadPanelAllMessages.value = [];
    return;
  }
  const room = matrixClient.getRoom(threadState.roomId);
  if (!room) {
    threadPanelAllMessages.value = [];
    return;
  }
  threadPanelAllMessages.value = mapTimelineEventsToMessages({
    room,
    ownUserId: matrixClient.getUserId() ?? undefined,
    getMemberAvatarUrl: (member) => {
      return getMemberAvatarUrl(member as unknown as Record<string, any>);
    },
    getMediaUrl,
    buildNoticeText,
    buildDeletedMessageText,
    mode: {
      kind: "thread",
      rootEventId: threadState.rootEventId,
    },
  }) as ChatMessage[];
}

function syncThreadPanelIfActive(roomId: string) {
  if (activeThread.value && activeThread.value.roomId === roomId) {
    loadThreadPanelMessages();
  }
}

function openThreadInSidebar(target: {
  eventId: string;
  senderName: string;
  body: string;
}) {
  if (!selectedRoomId.value) {
    return;
  }
  activeReplyTo.value = null;
  activeEditTo.value = null;
  activeThreadReplyTo.value = null;
  activeThreadEditTo.value = null;
  activeThread.value = {
    roomId: selectedRoomId.value,
    rootEventId: target.eventId,
    presentation: "sidebar",
  };
  loadThreadPanelMessages();
}

function openThreadFromRoomNav(payload: {
  roomId: string;
  rootEventId: string;
}) {
  selectedRoomId.value = payload.roomId;
  activeReplyTo.value = null;
  activeEditTo.value = null;
  activeThreadReplyTo.value = null;
  activeThreadEditTo.value = null;
  activeThread.value = {
    roomId: payload.roomId,
    rootEventId: payload.rootEventId,
    presentation: "main",
  };
  nextTick(() => {
    loadThreadPanelMessages();
  });
}

function closeActiveThread() {
  activeThread.value = null;
  threadPanelAllMessages.value = [];
  activeThreadReplyTo.value = null;
  activeThreadEditTo.value = null;
}

function closeRoomThreadsPanel() {
  rightSidebarView.value = "members";
}

function closePinnedMessagesPanel() {
  rightSidebarView.value = "members";
}

function togglePinnedMessagesPanel() {
  if (!selectedRoomId.value) {
    return;
  }
  if (rightSidebarView.value === "pinned" && rightSidebarOpen.value) {
    rightSidebarView.value = "members";
    return;
  }
  rightSidebarOpen.value = true;
  rightSidebarView.value = "pinned";
  if (activeThread.value?.presentation === "sidebar") {
    closeActiveThread();
  }
}

function toggleRoomThreadsPanel() {
  if (!selectedRoomId.value) {
    return;
  }
  if (rightSidebarView.value === "threads" && rightSidebarOpen.value) {
    rightSidebarView.value = "members";
    return;
  }
  rightSidebarOpen.value = true;
  rightSidebarView.value = "threads";
  if (activeThread.value?.presentation === "sidebar") {
    closeActiveThread();
  }
}

function openMembersPanel() {
  if (!selectedRoomId.value) {
    return;
  }
  if (rightSidebarOpen.value && rightSidebarView.value === "members") {
    rightSidebarOpen.value = false;
    return;
  }
  rightSidebarOpen.value = true;
  rightSidebarView.value = "members";
  if (activeThread.value?.presentation === "sidebar") {
    closeActiveThread();
  }
}

function focusMessageInTimeline(eventId: string) {
  const messageIndex = allMessages.value.findIndex((message) => {
    return message.id === eventId;
  });
  if (messageIndex < 0) {
    return false;
  }
  const halfWindow = Math.floor(INITIAL_TIMELINE_WINDOW_SIZE / 2);
  windowStartIndex.value = Math.max(0, messageIndex - halfWindow);
  windowEndIndex.value = Math.min(
    allMessages.value.length,
    messageIndex + halfWindow + 1,
  );
  applyWindow();
  centerOnMessageId.value = eventId;
  stickToBottom.value = false;
  scrollIntentToken.value += 1;
  return true;
}

function jumpToMessageInThread(eventId: string) {
  const found = threadPanelAllMessages.value.some((message) => {
    return message.id === eventId;
  });
  if (!found) {
    return;
  }
  threadCenterOnMessageId.value = eventId;
  threadScrollIntentToken.value += 1;
}

async function jumpToMessageInRoom(eventId: string) {
  if (!selectedRoomId.value) {
    return;
  }
  if (
    activeThread.value?.presentation === "main" &&
    activeThread.value.roomId === selectedRoomId.value
  ) {
    closeActiveThread();
  }
  if (focusMessageInTimeline(eventId)) {
    if (isMobile.value) {
      rightSidebarOpen.value = false;
    }
    return;
  }
  let paginationAttempts = 0;
  while (
    hasMoreOlderMessages.value &&
    paginationAttempts < JUMP_TO_MESSAGE_MAX_PAGINATIONS
  ) {
    paginationAttempts += 1;
    const hasMoreMessages = await loadOlderMessages(selectedRoomId.value);
    hasMoreOlderMessages.value = hasMoreMessages;
    loadMessages(selectedRoomId.value, { resetWindow: false });
    if (focusMessageInTimeline(eventId)) {
      if (isMobile.value) {
        rightSidebarOpen.value = false;
      }
      return;
    }
  }
}

async function onPinMessage(eventId: string) {
  const roomId = selectedRoomId.value;
  if (!roomId || !canPinInActiveRoom.value) {
    return;
  }
  try {
    await pinRoomEvent(roomId, eventId);
    pinnedListVersion.value += 1;
  } catch (thrownError) {
    console.error("Failed to pin message", thrownError);
  }
}

async function onUnpinMessage(eventId: string) {
  const roomId = selectedRoomId.value;
  if (!roomId || !canPinInActiveRoom.value) {
    return;
  }
  try {
    await unpinRoomEvent(roomId, eventId);
    pinnedListVersion.value += 1;
  } catch (thrownError) {
    console.error("Failed to unpin message", thrownError);
  }
}

function openThreadFromRoomThreadList(rootEventId: string) {
  if (!selectedRoomId.value) {
    return;
  }
  activeReplyTo.value = null;
  activeEditTo.value = null;
  activeThreadReplyTo.value = null;
  activeThreadEditTo.value = null;
  activeThread.value = {
    roomId: selectedRoomId.value,
    rootEventId,
    presentation: "sidebar",
  };
  loadThreadPanelMessages();
}

function setActiveThreadReplyTarget(replyTarget: ChatTimelineReply) {
  activeThreadEditTo.value = null;
  activeThreadReplyTo.value = replyTarget;
}

function clearActiveThreadReply() {
  activeThreadReplyTo.value = null;
}

function setActiveThreadEditTarget(editTarget: { eventId: string; body: string }) {
  activeThreadReplyTo.value = null;
  activeThreadEditTo.value = editTarget;
}

function clearActiveThreadEditTarget() {
  activeThreadEditTo.value = null;
}

function toMemberItem(member: Record<string, any>): MemberItem {
  return {
    userId: String(member.userId || ""),
    displayName: String(member.name || member.userId || ""),
    avatarUrl: getMemberAvatarUrl(member),
    status: normalizePresence(
      typeof member.presence === "string" ? member.presence : undefined,
    ),
  };
}

function normalizePresence(rawPresence: string | undefined): PresenceStatus {
  if (rawPresence === "online") {
    return "online";
  }
  if (rawPresence === "org.matrix.msc3026.busy" || rawPresence === "busy") {
    return "busy";
  }
  if (rawPresence === "dnd") {
    return "busy";
  }
  if (rawPresence === "unavailable") {
    return "away";
  }
  if (rawPresence === "offline") {
    return "offline";
  }
  return "unknown";
}

function roomIsListedInDirectAccountData(roomId: string): boolean {
  const matrixClient = client.value;
  if (!matrixClient) {
    return false;
  }
  const directEvent = matrixClient.getAccountData(EventType.Direct);
  const content = directEvent?.getContent() as
    | Record<string, string[]>
    | undefined;
  if (!content) {
    return false;
  }
  return Object.values(content).some((ids) => ids?.includes(roomId));
}

function countJoinedMembersForRoom(
  matrixRoom: Record<string, unknown> | undefined,
): number {
  if (!matrixRoom) {
    return 0;
  }
  const members = (
    matrixRoom as { getMembers?: () => Array<{ membership?: string }> }
  ).getMembers?.();
  if (members && members.length > 0) {
    const joinedCount = members.filter(
      (member) => member.membership === "join",
    ).length;
    if (joinedCount > 0) {
      return joinedCount;
    }
  }
  const summaryCount = Number(
    (matrixRoom as { getJoinedMemberCount?: () => number })
      .getJoinedMemberCount?.() ?? 0,
  );
  if (summaryCount > 0) {
    return summaryCount;
  }
  const currentState = (matrixRoom as {
    currentState?: {
      getStateEvents?: (eventType: string) => unknown;
    };
  }).currentState;
  const memberEvents = currentState?.getStateEvents?.("m.room.member");
  const normalizedEvents = Array.isArray(memberEvents)
    ? memberEvents
    : memberEvents
      ? [memberEvents]
      : [];
  return normalizedEvents.filter((stateEvent) => {
    const content = (
      stateEvent as { getContent?: () => { membership?: string } }
    ).getContent?.();
    return content?.membership === "join";
  }).length;
}

function roomCreateIsDirect(matrixRoom: Record<string, unknown>): boolean {
  const currentState = (matrixRoom as {
    currentState?: {
      getStateEvents?: (
        eventType: string,
        stateKey: string,
      ) => unknown;
    };
  }).currentState;
  const createEvent = currentState?.getStateEvents?.(
    "m.room.create",
    "",
  ) as { getContent?: () => { is_direct?: boolean } } | undefined;
  return createEvent?.getContent?.()?.is_direct === true;
}

/** 1:1 DM: m.direct entry, is_direct on create, or Matrix DM inviter hint. */
function isDirectMessageRoom(
  roomId: string,
  matrixRoom: Record<string, unknown> | undefined,
): boolean {
  if (roomIsListedInDirectAccountData(roomId)) {
    return true;
  }
  if (matrixRoom && roomCreateIsDirect(matrixRoom)) {
    return true;
  }
  const dmInviter = (
    matrixRoom as { getDMInviter?: () => string | undefined }
  ).getDMInviter?.();
  return Boolean(dmInviter);
}

function homeRoomCategoryInput(room: RoomItem): {
  parentSpaceIds: string[]
  joinedMemberCount: number
  isDirectMessage: boolean
} {
  const matrixRoom = matrixRooms.value.find(
    (entry) => entry.roomId === room.roomId,
  );
  return {
    parentSpaceIds: room.parentSpaceIds,
    joinedMemberCount: countJoinedMembersForRoom(matrixRoom),
    isDirectMessage: isDirectMessageRoom(room.roomId, matrixRoom),
  };
}

function isPersonalChatRoom(room: RoomItem): boolean {
  return isPersonalChatFromCounts(homeRoomCategoryInput(room));
}

function isGroupChatRoom(room: RoomItem): boolean {
  return isHomeGroupChatFromCounts(homeRoomCategoryInput(room));
}

function isDirectRoom(room: RoomItem): boolean {
  return isPersonalChatRoom(room);
}

function getOwnReadAnchorEventId(room: Record<string, any>): string | undefined {
  const ownUserId = client.value?.getUserId();
  if (!ownUserId) {
    return undefined;
  }
  const liveTimelineEvents = room.getLiveTimeline().getEvents();
  for (let index = liveTimelineEvents.length - 1; index >= 0; index -= 1) {
    const timelineEvent = liveTimelineEvents[index];
    if (!timelineEvent) {
      continue;
    }
    const eventType = timelineEvent.getType?.() ?? "";
    if (eventType !== "m.room.message") {
      continue;
    }
    const eventId = timelineEvent.getId?.();
    if (!eventId) {
      continue;
    }
    if (room.hasUserReadEvent(ownUserId, eventId)) {
      return eventId;
    }
  }
  return undefined;
}

function clampWindowRange(totalMessages: number) {
  if (totalMessages <= 0) {
    windowStartIndex.value = 0;
    windowEndIndex.value = 0;
    return;
  }
  windowStartIndex.value = Math.max(0, windowStartIndex.value);
  windowEndIndex.value = Math.max(windowStartIndex.value, windowEndIndex.value);
  windowEndIndex.value = Math.min(totalMessages, windowEndIndex.value);
}

function applyWindow() {
  clampWindowRange(allMessages.value.length);
  messages.value = allMessages.value.slice(
    windowStartIndex.value,
    windowEndIndex.value,
  );
}

function loadMessages(
  roomId: string,
  options?: { resetWindow?: boolean },
) {
  const room = client.value?.getRoom(roomId);
  if (!room) {
    allMessages.value = [];
    messages.value = [];
    return;
  }
  const previousVisibleMessages = messages.value;
  const previousVisibleIds = new Set(
    previousVisibleMessages.map((message) => message.id),
  );
  const previousEventCount = allMessages.value.length;
  const previousWindowStartIndex = windowStartIndex.value;
  const previousWindowEndIndex = windowEndIndex.value;
  const mappedMessages = mapTimelineEventsToMessages({
    room,
    ownUserId: client.value?.getUserId() ?? undefined,
    getMemberAvatarUrl: (member) => {
      return getMemberAvatarUrl(member as unknown as Record<string, any>);
    },
    getMediaUrl,
    buildNoticeText,
    buildDeletedMessageText,
  });
  allMessages.value = mappedMessages;

  const shouldResetWindow = options?.resetWindow ?? false;
  if (shouldResetWindow) {
    const allMessageIds = mappedMessages.map((message) => message.id);
    const ownReadAnchorEventId = getOwnReadAnchorEventId(room);
    const selection = resolveTimelineWindowSelection(allMessageIds, {
      windowSize: INITIAL_TIMELINE_WINDOW_SIZE,
      anchorEventId: ownReadAnchorEventId,
    });
    windowStartIndex.value = selection.startIndex;
    windowEndIndex.value = selection.endIndex;
    const hasNewerMessagesThanAnchor =
      selection.anchorFound &&
      selection.anchorIndex !== null &&
      selection.anchorIndex < allMessageIds.length - 1;
    centerOnMessageId.value =
      hasNewerMessagesThanAnchor && ownReadAnchorEventId
        ? ownReadAnchorEventId
        : undefined;
    stickToBottom.value = !hasNewerMessagesThanAnchor;
    applyWindow();
    scrollIntentToken.value += 1;
    syncThreadPanelIfActive(roomId);
    scheduleThreadNavRefresh();
    return;
  }

  const mappedMessageIds = new Set(
    mappedMessages.map((message) => message.id),
  );
  const hasSupersededVisibleMessage = [...previousVisibleIds].some(
    (messageId) => !mappedMessageIds.has(messageId),
  );
  if (hasSupersededVisibleMessage) {
    const anchorMessage = previousVisibleMessages.find((message) => {
      return mappedMessageIds.has(message.id);
    });
    if (anchorMessage) {
      const anchorIndex = mappedMessages.findIndex((message) => {
        return message.id === anchorMessage.id;
      });
      if (anchorIndex >= 0) {
        windowStartIndex.value = anchorIndex;
        windowEndIndex.value = mappedMessages.length;
        applyWindow();
        syncThreadPanelIfActive(roomId);
        scheduleThreadNavRefresh();
        return;
      }
    }
  }

  const preservedWindow = resolvePreservedTimelineWindow({
    previousStartIndex: previousWindowStartIndex,
    previousEndIndex: previousWindowEndIndex,
    previousEventCount,
    previousFirstMessageId: previousVisibleMessages[0]?.id,
    previousLastMessageId:
      previousVisibleMessages[previousVisibleMessages.length - 1]?.id,
    nextEventIds: mappedMessages.map((message) => message.id),
    windowSize: INITIAL_TIMELINE_WINDOW_SIZE,
    stickToBottom: stickToBottom.value,
  });
  windowStartIndex.value = preservedWindow.startIndex;
  windowEndIndex.value = preservedWindow.endIndex;
  applyWindow();
  if (preservedWindow.shouldScrollToBottom) {
    centerOnMessageId.value = undefined;
    scrollIntentToken.value += 1;
  }
  syncThreadPanelIfActive(roomId);
  scheduleThreadNavRefresh();
}

function patchMessageReactions(roomId: string) {
  const room = client.value?.getRoom(roomId);
  if (!room) {
    return;
  }
  const reactionSummaryByEventId = buildReactionSummaryByEventId(
    room.getLiveTimeline().getEvents(),
    client.value?.getUserId() ?? undefined,
  );
  allMessages.value = allMessages.value.map((message) => {
    if (message.kind !== "message") {
      return message;
    }
    return {
      ...message,
      reactions: reactionSummaryByEventId.get(message.id) ?? [],
    };
  });
  applyWindow();
  syncThreadPanelIfActive(roomId);
}

function isReactionRelatedEvent(eventType: string): boolean {
  return eventType === "m.reaction" || eventType === "m.room.redaction";
}

function buildDeletedMessageText(): string {
  return translateText("chat.messageDeleted");
}

async function onToggleReaction(payload: {
  messageId: string;
  emoji: string;
  ownReactionEventIds: string[];
}) {
  const activeRoomId = selectedRoomId.value;
  if (!activeRoomId) {
    return;
  }
  await toggleReaction(
    activeRoomId,
    payload.messageId,
    payload.emoji,
    payload.ownReactionEventIds,
  );
}

function scheduleLoadMessages(roomId: string) {
  if (!import.meta.client) {
    loadMessages(roomId, { resetWindow: false });
    return;
  }
  if (loadMessagesTimerId.value !== null) {
    window.clearTimeout(loadMessagesTimerId.value);
  }
  loadMessagesTimerId.value = window.setTimeout(() => {
    loadMessagesTimerId.value = null;
    loadMessages(roomId, { resetWindow: false });
  }, 120);
}

function onComposerSend() {
  const roomId = selectedRoomId.value;
  if (!roomId) {
    return;
  }
  if (loadMessagesTimerId.value !== null) {
    window.clearTimeout(loadMessagesTimerId.value);
    loadMessagesTimerId.value = null;
  }
  if (windowEndIndex.value >= allMessages.value.length) {
    stickToBottom.value = true;
  }
  loadMessages(roomId, { resetWindow: false });
  syncThreadPanelIfActive(roomId);
}

function buildNoticeText(
  timelineEvent: Record<string, any>,
  room: Record<string, any>,
): string {
  const eventType = timelineEvent.getType?.() ?? "";
  const senderUserId = timelineEvent.getSender?.() ?? "";
  const senderName = room.getMember?.(senderUserId)?.name || senderUserId;
  const content = timelineEvent.getContent?.() ?? {};

  if (eventType === "m.room.member") {
    const membership = content.membership;
    const targetUserId = timelineEvent.getStateKey?.() ?? "";
    const targetName = room.getMember?.(targetUserId)?.name || targetUserId;
    const previousContent = timelineEvent.getPrevContent?.() ?? {};

    if (membership === "join" && previousContent.membership === "join") {
      if (content.avatar_url !== previousContent.avatar_url) {
        return `${targetName} changed avatar`;
      }
      if (content.displayname !== previousContent.displayname) {
        return `${targetName} changed display name`;
      }
      return `${targetName} profile updated`;
    }

    if (membership === "join") return `${targetName} joined the channel`;
    if (membership === "leave") return `${targetName} left the channel`;
    if (membership === "invite") return `${senderName} invited ${targetName}`;
    if (membership === "ban") return `${targetName} was banned`;
    return `${targetName} membership changed`;
  }

  if (eventType === "m.room.avatar") {
    return `${senderName} changed the room avatar`;
  }
  if (eventType === "m.room.name") {
    const nextName = content.name || "Unnamed room";
    return `${senderName} changed the room name to ${nextName}`;
  }
  if (eventType === "m.room.topic") {
    return `${senderName} updated the room topic`;
  }
  if (eventType === "m.room.pinned_events") {
    const previousContent = timelineEvent.getPrevContent?.() ?? {};
    const previousPinned = Array.isArray(previousContent.pinned)
      ? previousContent.pinned
      : [];
    const nextPinned = Array.isArray(content.pinned) ? content.pinned : [];
    const addedIds = nextPinned.filter((eventId) => {
      return !previousPinned.includes(eventId);
    });
    const removedIds = previousPinned.filter((eventId) => {
      return !nextPinned.includes(eventId);
    });
    if (addedIds.length === 1 && removedIds.length === 0) {
      return translateText("chat.noticePinnedMessage", { name: senderName });
    }
    if (removedIds.length === 1 && addedIds.length === 0) {
      return translateText("chat.noticeUnpinnedMessage", { name: senderName });
    }
    return translateText("chat.noticeUpdatedPinnedMessages", {
      name: senderName,
    });
  }
  return `${senderName} updated room settings`;
}

async function withPrependViewportPreservation(
  callback: () => Promise<void> | void,
) {
  preserveViewportOnPrepend.value = true;
  try {
    await callback();
  } finally {
    await nextTick();
    preserveViewportOnPrepend.value = false;
  }
}

async function onReachTop() {
  if (!selectedRoomId.value || loadingOlder.value) {
    return;
  }
  if (windowStartIndex.value > 0) {
    await withPrependViewportPreservation(() => {
      windowStartIndex.value = Math.max(
        0,
        windowStartIndex.value - SCROLL_WINDOW_EXPAND_STEP,
      );
      applyWindow();
    });
    return;
  }
  if (!hasMoreOlderMessages.value) {
    return;
  }
  loadingOlder.value = true;
  await withPrependViewportPreservation(async () => {
    try {
      const hasMoreMessages = await loadOlderMessages(selectedRoomId.value!);
      hasMoreOlderMessages.value = hasMoreMessages;
      loadMessages(selectedRoomId.value!, { resetWindow: false });
      windowStartIndex.value = Math.max(
        0,
        windowStartIndex.value - SCROLL_WINDOW_EXPAND_STEP,
      );
      applyWindow();
    } finally {
      loadingOlder.value = false;
    }
  });
}

async function onReachBottom() {
  if (loadingNewer.value) {
    return;
  }
  if (windowEndIndex.value >= allMessages.value.length) {
    stickToBottom.value = true;
    scheduleMarkActiveRoomRead();
    return;
  }
  loadingNewer.value = true;
  try {
    windowEndIndex.value = Math.min(
      allMessages.value.length,
      windowEndIndex.value + SCROLL_WINDOW_EXPAND_STEP,
    );
    applyWindow();
    if (windowEndIndex.value >= allMessages.value.length) {
      stickToBottom.value = true;
      scheduleMarkActiveRoomRead();
    }
  } finally {
    loadingNewer.value = false;
  }
}

function handleLogout() {
  logout();
  navigateTo("/");
}

function selectSpace(spaceId: string) {
  selectedSpaceId.value = spaceId;
  if (isMobile.value) {
    leftSidebarOpen.value = false;
  }
}

function selectRoom(roomId: string) {
  if (
    activeThread.value?.presentation === "main" &&
    activeThread.value.roomId === roomId
  ) {
    closeActiveThread();
  }
  selectedRoomId.value = roomId;
  if (isMobile.value) {
    leftSidebarOpen.value = false;
  }
}

async function onPersistRoomOrder(payload: {
  parentSpaceId: string;
  orderedRoomIds: string[];
}) {
  try {
    await reorderSpaceChildren(
      payload.parentSpaceId,
      payload.orderedRoomIds,
    );
    refreshRooms();
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
    await moveChannelBetweenSpaceParents({
      roomId: payload.roomId,
      previousParentSpaceId: payload.previousParentSpaceId,
      nextParentSpaceId: payload.nextParentSpaceId,
      insertIndex: payload.insertIndex,
    });
    refreshRooms();
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
  const rootId = selectedSpaceId.value;
  if (!rootId || rootId === HOME_SPACE_ID) {
    return;
  }
  try {
    await reorderSpaceChildren(rootId, orderedRootChildIds);
    refreshRooms();
  } catch (thrownError) {
    console.error("reorder root categories failed", thrownError);
  }
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

function toggleLeftSidebar() {
  leftSidebarOpen.value = !leftSidebarOpen.value;
}

function toggleSpaceRail() {
  spaceRailExpanded.value = !spaceRailExpanded.value;
}

function openCreateSpace() {
  navigateTo("/spaces/new");
}

function resolveRootSpaceIdForNavigation(spaceOrSubspaceId: string): string {
  const matrixClient = client.value;
  if (!matrixClient) {
    return spaceOrSubspaceId;
  }
  const rootId = selectedSpaceId.value;
  if (rootId && rootId !== HOME_SPACE_ID) {
    return rootId;
  }
  return resolveRootSpaceIdForHierarchy({
    spaceId: spaceOrSubspaceId,
    matrixRooms: matrixRooms.value,
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
  const parentSpaceId = selectedSpaceId.value;
  const matrixClient = client.value;
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

function onDirectMessageStarted(roomId: string) {
  onboardingSubView.value = null;
  selectedSpaceId.value = HOME_SPACE_ID;
  selectedRoomId.value = roomId;
  refreshRooms();
}

function onPublicRoomJoined(roomId: string) {
  onboardingSubView.value = null;
  selectedSpaceId.value = HOME_SPACE_ID;
  selectedRoomId.value = roomId;
  refreshRooms();
}

function resolveRootSpaceIdFromQuery(
  rawRoot: string | undefined,
  rawLegacySpace: string | undefined,
): string | null {
  const candidate = rawRoot || rawLegacySpace;
  if (!candidate) {
    return null;
  }
  refreshRooms();
  return resolveRootSpaceIdForHierarchy({
    spaceId: candidate,
    matrixRooms: matrixRooms.value,
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
    pendingRootSpaceId.value = rootSpaceId;
    selectedSpaceId.value = rootSpaceId;
  }
  if (typeof roomQuery === "string" && roomQuery.length > 0) {
    if (!rootSpaceId) {
      selectedSpaceId.value = HOME_SPACE_ID;
    }
    selectedRoomId.value = roomQuery;
    refreshRooms();
    void navigateTo({ path: "/chat", query: {} }, { replace: true });
    scheduleSpaceHierarchyRefresh();
  } else if (rootSpaceId) {
    refreshRooms();
    void navigateTo({ path: "/chat", query: {} }, { replace: true });
    scheduleSpaceHierarchyRefresh();
  }
}

let spaceHierarchyRefreshTimerId: number | null = null;

function scheduleSpaceHierarchyRefresh() {
  if (spaceHierarchyRefreshTimerId !== null) {
    window.clearTimeout(spaceHierarchyRefreshTimerId);
  }
  refreshRooms();
  spaceHierarchyRefreshTimerId = window.setTimeout(() => {
    refreshRooms();
    spaceHierarchyRefreshTimerId = null;
  }, 800);
}

function closeMobileOverlays() {
  if (!isMobile.value) {
    return;
  }
  leftSidebarOpen.value = false;
  rightSidebarOpen.value = false;
}

function syncViewport(force = false) {
  if (!import.meta.client) {
    return;
  }
  const wasMobile = isMobile.value;
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;

  const shouldReset =
    force || !viewportInitialized.value || wasMobile !== isMobile.value;

  if (shouldReset) {
    leftSidebarOpen.value = !isMobile.value;
    rightSidebarOpen.value = !isMobile.value;
    spaceRailExpanded.value = false;
  }

  viewportInitialized.value = true;
}

watch(
  () => route.query.room,
  () => {
    applyRoomIdFromRouteQuery();
  },
  { immediate: true },
);

onMounted(() => {
  syncViewport(true);
  window.addEventListener("resize", resizeHandler);
});

const resizeHandler = () => syncViewport();

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return;
  }
  if (loadMessagesTimerId.value !== null) {
    window.clearTimeout(loadMessagesTimerId.value);
    loadMessagesTimerId.value = null;
  }
  if (threadNavRefreshTimerId !== null) {
    window.clearTimeout(threadNavRefreshTimerId);
    threadNavRefreshTimerId = null;
  }
  if (spaceHierarchyRefreshTimerId !== null) {
    window.clearTimeout(spaceHierarchyRefreshTimerId);
    spaceHierarchyRefreshTimerId = null;
  }
  window.removeEventListener("resize", resizeHandler);
});

watch(
  [client, selectedSpaceId],
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
      refreshRooms();
    };
    spaceRoom.on(RoomEvent.CurrentStateUpdated, onSpaceStateUpdated);
    onCleanup(() => {
      spaceRoom.off(RoomEvent.CurrentStateUpdated, onSpaceStateUpdated);
    });
  },
  { immediate: true },
);

watch(
  () => client.value,
  (matrixClient, _previousClient, onCleanup) => {
    if (!matrixClient) {
      return;
    }
    refreshRooms();
    matrixClient.once(ClientEvent.Sync, (state) => {
      if (state === "PREPARED") {
        refreshRooms();
      }
    });
    const timelineHandler = (
      timelineEvent: Record<string, any> | undefined,
      room: Record<string, any> | undefined,
    ) => {
      if (room?.roomId) {
        const eventType = timelineEvent?.getType?.() ?? "";
        if (
          eventType === "m.room.message" ||
          isReactionRelatedEvent(eventType)
        ) {
          scheduleThreadNavRefresh();
        }
        if (
          room.roomId !== selectedRoomId.value &&
          eventType === "m.room.message"
        ) {
          refreshUnread();
        }
      }
      if (room?.roomId === selectedRoomId.value) {
        const eventType = timelineEvent?.getType?.() ?? "";
        if (eventType === "m.room.pinned_events") {
          pinnedListVersion.value += 1;
        }
        if (eventType === "m.reaction") {
          patchMessageReactions(room.roomId);
          return;
        }
        if (eventType === "m.room.redaction") {
          patchMessageReactions(room.roomId);
          scheduleLoadMessages(room.roomId);
          return;
        }
        scheduleLoadMessages(room.roomId);
      }
    };
    const membershipHandler = () => {
      refreshRooms();
    };
    const decryptedHandler = (event: Record<string, any>) => {
      if (
        event?.getRoomId?.() === selectedRoomId.value &&
        selectedRoomId.value
      ) {
        const eventType = event?.getType?.() ?? "";
        if (eventType === "m.reaction") {
          patchMessageReactions(selectedRoomId.value);
          return;
        }
        if (eventType === "m.room.redaction") {
          patchMessageReactions(selectedRoomId.value);
          scheduleLoadMessages(selectedRoomId.value);
          return;
        }
        scheduleLoadMessages(selectedRoomId.value);
      }
    };
    matrixClient.on(RoomEvent.Timeline, timelineHandler);
    matrixClient.on(RoomEvent.MyMembership, membershipHandler);
    matrixClient.on(MatrixEventEvent.Decrypted, decryptedHandler);
    onCleanup(() => {
      matrixClient.off(RoomEvent.Timeline, timelineHandler);
      matrixClient.off(RoomEvent.MyMembership, membershipHandler);
      matrixClient.off(MatrixEventEvent.Decrypted, decryptedHandler);
    });
  },
  { immediate: true },
);
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
          :spaces="spaceItems"
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
          :resolve-room-insert-index="resolveRoomInsertIndexForCategory"
          @invite-space="openInviteToSpace"
          @invite-room="openInviteToRoom"
          @open-room-settings="openRoomSettings"
          @open-home-start-dm="openHomeStartDm"
          @open-home-create-room="openHomeCreateRoom"
          @open-home-explore-public="openHomeExplorePublic"
          @persist-room-order="onPersistRoomOrder"
          @move-room-between-categories="onMoveRoomBetweenCategories"
          @reorder-root-categories="onReorderRootCategories"
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
  </div>
</template>
