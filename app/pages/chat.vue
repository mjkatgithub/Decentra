<script setup lang="ts">
import {
  ClientEvent,
  EventType,
  MatrixEventEvent,
  RoomEvent,
} from "matrix-js-sdk";
import { useAppI18n } from "~/composables/useAppI18n";
import { useChatMedia } from "~/composables/useChatMedia";
import ChatOnboardingPanel from "~/components/Chat/Onboarding/ChatOnboardingPanel.vue";
import ChatDmStartPanel from "~/components/Chat/Onboarding/ChatDmStartPanel.vue";
import ChatPublicRoomsPanel from "~/components/Chat/Onboarding/ChatPublicRoomsPanel.vue";
import {
  buildReactionSummaryByEventId,
  buildRoomThreadNavEntries,
  mapTimelineEventsToMessages,
  resolveTimelineWindowSelection,
  type ThreadNavEntry,
} from "~/utils/chatTimeline";
import {
  buildSpaceRoomCategories,
  getJoinedSpaceRoomIds,
  isRootSpaceRoom,
  isRoomUnderAncestorSpace,
} from "~/utils/spaceRoomCategories";
import { canUserSendSpaceChildState } from "~/utils/matrixSpaceHierarchyPermissions";

type PresenceStatus = "online" | "away" | "busy" | "offline" | "unknown";

interface ChatMessage {
  id: string;
  kind: "message" | "notice";
  isDecryptionError?: boolean;
  senderId: string;
  senderName: string;
  avatarUrl?: string;
  body: string;
  replyTo?: {
    eventId: string;
    senderName: string;
    body: string;
  };
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
}

type ThreadPresentation = "sidebar" | "main";
type RightSidebarView = "members" | "threads";

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
  rootChildAnchorIds: string[];
  /** Power-level: may send m.space.child on the parent of these rooms */
  canReorderRooms: boolean;
  rooms: Array<{ roomId: string; name: string }>;
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

const {
  client,
  userId,
  getRooms,
  logout,
  loadOlderMessages,
  toggleReaction,
  reorderSpaceChildren,
  moveChannelBetweenSpaceParents,
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
const allMessages = ref<ChatMessage[]>([]);
const messages = ref<ChatMessage[]>([]);
const matrixRooms = ref<Array<Record<string, any>>>([]);
const loadingOlder = ref(false);
const loadingNewer = ref(false);
const hasMoreOlderMessages = ref(true);
const windowStartIndex = ref(0);
const windowEndIndex = ref(0);
const centerOnMessageId = ref<string | undefined>(undefined);
const stickToBottom = ref(false);
const scrollIntentToken = ref(0);
const preserveViewportOnPrepend = ref(false);
const activeReplyTo = ref<ChatMessage["replyTo"] | null>(null);
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
const threadNavVersion = ref(0);
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

const spaceItems = computed<SpaceItem[]>(() => {
  const spaces = matrixRooms.value
    .filter((room) => getRoomType(room) === "m.space")
    .filter((room) =>
      isRootSpaceRoom(room, joinedSpaceIds.value, getParentSpaceIds),
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

const roomItems = computed<RoomItem[]>(() => {
  return matrixRooms.value
    .filter((room) => getRoomType(room) !== "m.space")
    .map((room) => ({
      roomId: room.roomId,
      name: room.name || translateText("layout.roomFallback"),
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
  return roomItems.value.filter((room) => {
    if (room.parentSpaceIds.length === 0) {
      return activeSpaceId === HOME_SPACE_ID;
    }
    return isRoomUnderAncestorSpace({
      roomParentIds: room.parentSpaceIds,
      ancestorSpaceId: activeSpaceId,
      roomsById,
      getRoomType,
      getParentSpaceIds,
    });
  });
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
  if (selectedSpaceId.value === HOME_SPACE_ID) {
    return buildHomeSections();
  }
  return buildSpaceSections();
});

const canReorderRootCategories = computed(() => {
  const rootId = selectedSpaceId.value;
  const matrixClient = client.value;
  const matrixUserId = userId.value;
  if (!rootId || rootId === HOME_SPACE_ID || !matrixClient) {
    return false;
  }
  return canUserSendSpaceChildState(matrixClient, rootId, matrixUserId);
});

function buildHomeSections(): RoomCategoryGroup[] {
  const directRooms = visibleRooms.value.filter((room) => isDirectRoom(room));
  const unassignedRooms = visibleRooms.value.filter((room) => {
    return room.parentSpaceIds.length === 0 && !isDirectRoom(room);
  });

  const categories: RoomCategoryGroup[] = [];
  if (directRooms.length > 0) {
    categories.push({
      id: "personal-chats",
      name: translateText("layout.personalChats"),
      kind: "root",
      rootChildAnchorIds: [],
      canReorderRooms: false,
      rooms: directRooms.map((room) => ({
        roomId: room.roomId,
        name: room.name,
      })),
    });
  }
  if (unassignedRooms.length > 0) {
    categories.push({
      id: "unassigned-rooms",
      name: translateText("layout.unassignedRooms"),
      kind: "root",
      rootChildAnchorIds: [],
      canReorderRooms: false,
      rooms: unassignedRooms.map((room) => ({
        roomId: room.roomId,
        name: room.name,
      })),
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
    generalCategoryLabel: translateText("layout.generalCategory"),
  });
  const matrixClient = client.value;
  const matrixUserId = userId.value;
  return built.map((category) => {
    const parentForRooms =
      category.kind === "subspace" && category.subspaceRoomId
        ? category.subspaceRoomId
        : selectedId;
    const canReorderRooms =
      matrixClient && parentForRooms
        ? canUserSendSpaceChildState(
            matrixClient,
            parentForRooms,
            matrixUserId,
          )
        : false;
    return {
      id: category.id,
      name: category.name,
      kind: category.kind,
      subspaceRoomId: category.subspaceRoomId,
      rootChildAnchorIds: category.rootChildAnchorIds,
      canReorderRooms,
      rooms: category.rooms,
    };
  });
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
    if (spaces.length === 0) {
      selectedSpaceId.value = null;
      return;
    }
    const selectedExists = spaces.some(
      (space) => space.id === selectedSpaceId.value,
    );
    if (!selectedExists) {
      const firstSpace = spaces[0];
      if (firstSpace) {
        selectedSpaceId.value = firstSpace.id;
      }
    }
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
  if (
    activeThread.value &&
    roomId &&
    activeThread.value.roomId !== roomId
  ) {
    activeThread.value = null;
    threadPanelAllMessages.value = [];
    activeThreadReplyTo.value = null;
  }
  if (!roomId) {
    activeThread.value = null;
    threadPanelAllMessages.value = [];
    activeThreadReplyTo.value = null;
    allMessages.value = [];
    messages.value = [];
    return;
  }
  loadMessages(roomId, { resetWindow: true });
});

function setReplyTarget(replyTarget: {
  eventId: string;
  senderName: string;
  body: string;
}) {
  activeReplyTo.value = replyTarget;
}

function clearReplyTarget() {
  activeReplyTo.value = null;
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
  activeThreadReplyTo.value = null;
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
  activeThreadReplyTo.value = null;
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
}

function closeRoomThreadsPanel() {
  rightSidebarView.value = "members";
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

function openThreadFromRoomThreadList(rootEventId: string) {
  if (!selectedRoomId.value) {
    return;
  }
  activeReplyTo.value = null;
  activeThreadReplyTo.value = null;
  activeThread.value = {
    roomId: selectedRoomId.value,
    rootEventId,
    presentation: "sidebar",
  };
  loadThreadPanelMessages();
}

function setActiveThreadReplyTarget(
  replyTarget: NonNullable<ChatMessage["replyTo"]>,
) {
  activeThreadReplyTo.value = replyTarget;
}

function clearActiveThreadReply() {
  activeThreadReplyTo.value = null;
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

function isDirectRoom(room: RoomItem): boolean {
  const matrixRoom = matrixRooms.value.find(
    (entry) => entry.roomId === room.roomId,
  );
  if (!matrixRoom) {
    return false;
  }
  if (room.parentSpaceIds.length !== 0) {
    return false;
  }
  if (roomIsListedInDirectAccountData(room.roomId)) {
    return true;
  }
  const joinedMemberCount = Number(matrixRoom.getJoinedMemberCount?.() ?? 0);
  return joinedMemberCount === 2;
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
  const mappedMessages = mapTimelineEventsToMessages({
    room,
    ownUserId: client.value?.getUserId() ?? undefined,
    getMemberAvatarUrl: (member) => {
      return getMemberAvatarUrl(member as unknown as Record<string, any>);
    },
    getMediaUrl,
    buildNoticeText,
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

  const previousFirstMessageId = previousVisibleMessages[0]?.id;
  const previousLastMessageId =
    previousVisibleMessages[previousVisibleMessages.length - 1]?.id;
  const nextStartIndex = previousFirstMessageId
    ? mappedMessages.findIndex((message) => message.id === previousFirstMessageId)
    : -1;
  const nextLastIndex = previousLastMessageId
    ? mappedMessages.findIndex((message) => message.id === previousLastMessageId)
    : -1;
  if (nextStartIndex >= 0 && nextLastIndex >= nextStartIndex) {
    windowStartIndex.value = nextStartIndex;
    windowEndIndex.value = nextLastIndex + 1;
  } else {
    const fallbackSelection = resolveTimelineWindowSelection(
      mappedMessages.map((message) => message.id),
      { windowSize: INITIAL_TIMELINE_WINDOW_SIZE },
    );
    windowStartIndex.value = fallbackSelection.startIndex;
    windowEndIndex.value = fallbackSelection.endIndex;
  }
  applyWindow();
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
    return;
  }
  loadingNewer.value = true;
  try {
    windowEndIndex.value = Math.min(
      allMessages.value.length,
      windowEndIndex.value + SCROLL_WINDOW_EXPAND_STEP,
    );
    applyWindow();
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

function openCreateSpaceStub() {
  navigateTo("/spaces/new");
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

function applyRoomIdFromRouteQuery() {
  const raw = route.query.room;
  const roomQuery = Array.isArray(raw) ? raw[0] : raw;
  if (typeof roomQuery === "string" && roomQuery.length > 0) {
    selectedSpaceId.value = HOME_SPACE_ID;
    selectedRoomId.value = roomQuery;
    void navigateTo({ path: "/chat", query: {} }, { replace: true });
  }
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
  window.removeEventListener("resize", resizeHandler);
});

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
      }
      if (room?.roomId === selectedRoomId.value) {
        const eventType = timelineEvent?.getType?.() ?? "";
        if (isReactionRelatedEvent(eventType)) {
          patchMessageReactions(room.roomId);
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
        if (isReactionRelatedEvent(eventType)) {
          patchMessageReactions(selectedRoomId.value);
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
          @create-space="openCreateSpaceStub"
        />
        <ChatRoomCategoryList
          :selected-space-name="selectedSpaceName"
          :categories="roomCategories"
          :selected-room-id="selectedRoomId"
          :can-reorder-categories="canReorderRootCategories"
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
          :members-active="membersPanelActive && rightSidebarOpen"
          @open-threads="toggleRoomThreadsPanel"
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
        <template v-if="!hasJoinedNonSpaceRooms">
          <ChatOnboardingPanel
            v-if="!onboardingSubView"
            @open-dm="onboardingSubView = 'dm'"
            @open-create-room="navigateTo('/rooms/new')"
            @open-public-rooms="onboardingSubView = 'public'"
          />
          <ChatDmStartPanel
            v-else-if="onboardingSubView === 'dm'"
            @back="onboardingSubView = null"
            @started="onDirectMessageStarted"
          />
          <ChatPublicRoomsPanel
            v-else-if="onboardingSubView === 'public'"
            @back="onboardingSubView = null"
            @joined="onPublicRoomJoined"
          />
        </template>
        <p
          v-else
          class="text-sm text-gray-500 dark:text-gray-400"
        >
          {{ translateText("chat.selectRoom") }}
        </p>
      </div>
      <template v-else>
        <template v-if="activeThread?.presentation === 'main'">
          <ChatMessageList
            :messages="threadPanelAllMessages"
            :current-user-id="userId ?? undefined"
            :resolve-media-blob-url="resolveMediaBlobUrl"
            is-thread-view
            @reply="setActiveThreadReplyTarget"
            @toggle-reaction="onToggleReaction"
          />
          <ChatMessageInput
            :room-id="selectedRoomId"
            :disabled="!client"
            :reply-to="activeThreadReplyTo"
            :thread-root-event-id="activeThread.rootEventId"
            @cancel-reply="clearActiveThreadReply"
          />
        </template>
        <template v-else>
          <ChatMessageList
            :messages="messages"
            :current-user-id="userId ?? undefined"
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
            @open-thread="openThreadInSidebar"
            @open-thread-preview="openThreadInSidebar"
            @toggle-reaction="onToggleReaction"
          />
          <ChatMessageInput
            v-if="
              !activeThread || activeThread.presentation !== 'sidebar'
            "
            :room-id="selectedRoomId"
            :disabled="!client"
            :reply-to="activeReplyTo"
            @cancel-reply="clearReplyTarget"
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
        :disabled="!client"
        :reply-to="activeThreadReplyTo"
        :resolve-media-blob-url="resolveMediaBlobUrl"
        @close="closeActiveThread"
        @reply="setActiveThreadReplyTarget"
        @cancel-reply="clearActiveThreadReply"
        @toggle-reaction="onToggleReaction"
      />
      <ChatRoomThreadListPanel
        v-else-if="roomThreadsPanelActive && selectedRoomId"
        :threads="selectedRoomThreadEntries"
        @close="closeRoomThreadsPanel"
        @open-thread="openThreadFromRoomThreadList"
      />
      <ChatMemberList v-else :members="memberItems" />
    </aside>
  </div>
</template>
