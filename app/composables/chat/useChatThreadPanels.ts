import { buildSidebarThreadNavByRoomId } from "~/utils/sidebarThreadNav";
import { getThreadUnreadState } from "~/utils/roomUnread";
import {
  buildRoomThreadNavEntries,
  mapTimelineEventsToMessages,
  type ChatTimelineReply,
  type ThreadNavEntry,
} from "~/utils/chatTimeline";
import { getPinnedEventIds } from "~/utils/matrixRoomPinnedEvents";
import { buildPinnedMessageEntries } from "~/utils/matrixPinnedMessageEntries";
import type {
  ActiveThreadState,
  ChatMessage,
  RightSidebarView,
} from "~/composables/chat/chatPageTypes";
import { JUMP_TO_MESSAGE_MAX_PAGINATIONS } from "~/composables/chat/chatPageTypes";

const THREAD_NAV_REFRESH_MS = 250;

export function useChatThreadPanels(options: {
  client: Ref<Record<string, any> | null>;
  userId: Ref<string | null>;
  selectedRoomId: Ref<string | null>;
  matrixSyncPrepared: Ref<boolean>;
  unreadByRoomId: ComputedRef<Record<string, unknown>>;
  visibleRoomsForSidebar: ComputedRef<Array<{ roomId: string }>>;
  selectedRoom: ComputedRef<Record<string, any> | null>;
  translateText: (key: string, params?: Record<string, string>) => string;
  getMemberAvatarUrl: (member: Record<string, any>) => string | undefined;
  getMediaUrl: (mxcUrl: string) => string;
  markThreadAsRead: (roomId: string, rootEventId: string) => Promise<void>;
  refreshUnread: () => void;
  pinRoomEvent: (roomId: string, eventId: string) => Promise<void>;
  unpinRoomEvent: (roomId: string, eventId: string) => Promise<void>;
  canPinInActiveRoom: ComputedRef<boolean>;
  isMobile: Ref<boolean>;
  rightSidebarOpen: Ref<boolean>;
  buildNoticeText: (
    timelineEvent: Record<string, any>,
    room: Record<string, any>,
  ) => string;
  buildDeletedMessageText: () => string;
  focusMessageInTimeline: (eventId: string) => boolean;
  hasMoreOlderMessages: Ref<boolean>;
  loadOlderMessages: (roomId: string) => Promise<boolean>;
  loadMessages: (roomId: string, loadOptions?: { resetWindow?: boolean }) => void;
}) {
  const rightSidebarView = ref<RightSidebarView>("members");
  const activeThread = ref<ActiveThreadState | null>(null);
  const threadPanelAllMessages = ref<ChatMessage[]>([]);
  const activeThreadReplyTo = ref<ChatMessage["replyTo"] | null>(null);
  const activeThreadEditTo = ref<{ eventId: string; body: string } | null>(
    null,
  );
  const threadCenterOnMessageId = ref<string | undefined>(undefined);
  const threadScrollIntentToken = ref(0);
  const threadNavVersion = ref(0);
  const pinnedListVersion = ref(0);
  const activeReplyTo = ref<ChatTimelineReply | null>(null);
  const activeEditTo = ref<{ eventId: string; body: string } | null>(null);
  let threadNavRefreshTimerId: number | null = null;

  function enrichThreadNavEntry(
    room: Record<string, unknown>,
    entry: ThreadNavEntry,
  ): ThreadNavEntry {
    const threadUnread = getThreadUnreadState(room, entry.rootEventId, {
      activeRoomId: options.selectedRoomId.value,
      activeThreadRootId: activeThread.value?.rootEventId ?? null,
    });
    return {
      ...entry,
      hasUnread: threadUnread.hasUnread,
      hasMentionUnread: threadUnread.hasMentionUnread,
    };
  }

  async function markActiveThreadRead(): Promise<void> {
    const threadState = activeThread.value;
    if (!threadState) {
      return;
    }
    await options.markThreadAsRead(
      threadState.roomId,
      threadState.rootEventId,
    );
    options.refreshUnread();
    scheduleThreadNavRefresh();
  }

  function scheduleMarkActiveThreadRead(): void {
    if (!import.meta.client) {
      void markActiveThreadRead();
      return;
    }
    void markActiveThreadRead();
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

  const threadNavByRoomId = computed<Record<string, ThreadNavEntry[]>>(() => {
    void threadNavVersion.value;
    if (!options.matrixSyncPrepared.value) {
      return {};
    }
    options.unreadByRoomId.value;
    const matrixClient = options.client.value;
    if (!matrixClient) {
      return {};
    }
    const visibleRoomIds = options.visibleRoomsForSidebar.value.map(
      (room) => room.roomId,
    );
    return buildSidebarThreadNavByRoomId({
      visibleRoomIds,
      getJoinedRoom: (roomId) => matrixClient.getRoom(roomId) ?? null,
      enrichEntry: (joinedRoom, entry) =>
        enrichThreadNavEntry(joinedRoom, entry),
    });
  });

  const selectedRoomThreadEntries = computed<ThreadNavEntry[]>(() => {
    void threadNavVersion.value;
    if (options.matrixSyncPrepared.value) {
      options.unreadByRoomId.value;
    }
    const roomId = options.selectedRoomId.value;
    const matrixClient = options.client.value;
    if (!roomId || !matrixClient) {
      return [];
    }
    const room = matrixClient.getRoom(roomId);
    if (!room) {
      return [];
    }
    let entries = buildRoomThreadNavEntries(room, { maxAgeDays: null });
    if (options.matrixSyncPrepared.value) {
      entries = entries.map((entry) => enrichThreadNavEntry(room, entry));
    }
    return entries;
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
    const matrixClient = options.client.value;
    const roomId = options.selectedRoomId.value;
    if (!matrixClient || !roomId) {
      return [];
    }
    return getPinnedEventIds(matrixClient, roomId);
  });

  const selectedRoomPinnedEntries = computed(() => {
    pinnedListVersion.value;
    const room = options.selectedRoom.value;
    if (!room) {
      return [];
    }
    return buildPinnedMessageEntries(
      room as never,
      activeRoomPinnedEventIds.value,
      {
        unavailableSnippet: options.translateText(
          "chat.pinnedMessageUnavailable",
        ),
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
      ? threadPanelAllMessages.value.find(
          (message) => message.id === rootId,
        )
      : undefined;
    if (!rootMessage || rootMessage.kind !== "message") {
      return options.translateText("chat.threadAction");
    }
    const line = rootMessage.body.split("\n")[0]?.trim() ?? "";
    const clipped =
      line.length > 100 ? `${line.slice(0, 97)}...` : line;
    return clipped || options.translateText("chat.threadAction");
  });

  const threadPanelStartedBy = computed(() => {
    const rootId = activeThread.value?.rootEventId;
    const rootMessage = rootId
      ? threadPanelAllMessages.value.find(
          (message) => message.id === rootId,
        )
      : undefined;
    return rootMessage?.senderName ?? "";
  });

  function loadThreadPanelMessages() {
    const threadState = activeThread.value;
    const matrixClient = options.client.value;
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
        return options.getMemberAvatarUrl(
          member as unknown as Record<string, any>,
        );
      },
      getMediaUrl: options.getMediaUrl,
      buildNoticeText: options.buildNoticeText,
      buildDeletedMessageText: options.buildDeletedMessageText,
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

  function openThreadInSidebar(target: {
    eventId: string;
    senderName: string;
    body: string;
  }) {
    if (!options.selectedRoomId.value) {
      return;
    }
    activeReplyTo.value = null;
    activeEditTo.value = null;
    activeThreadReplyTo.value = null;
    activeThreadEditTo.value = null;
    activeThread.value = {
      roomId: options.selectedRoomId.value,
      rootEventId: target.eventId,
      presentation: "sidebar",
    };
    loadThreadPanelMessages();
    scheduleMarkActiveThreadRead();
  }

  function openThreadFromRoomNav(payload: {
    roomId: string;
    rootEventId: string;
  }) {
    options.selectedRoomId.value = payload.roomId;
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
      scheduleMarkActiveThreadRead();
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
    if (!options.selectedRoomId.value) {
      return;
    }
    if (
      rightSidebarView.value === "pinned" &&
      options.rightSidebarOpen.value
    ) {
      rightSidebarView.value = "members";
      return;
    }
    options.rightSidebarOpen.value = true;
    rightSidebarView.value = "pinned";
    if (activeThread.value?.presentation === "sidebar") {
      closeActiveThread();
    }
  }

  function toggleRoomThreadsPanel() {
    if (!options.selectedRoomId.value) {
      return;
    }
    if (
      rightSidebarView.value === "threads" &&
      options.rightSidebarOpen.value
    ) {
      rightSidebarView.value = "members";
      return;
    }
    options.rightSidebarOpen.value = true;
    rightSidebarView.value = "threads";
    if (activeThread.value?.presentation === "sidebar") {
      closeActiveThread();
    }
  }

  function openMembersPanel() {
    if (!options.selectedRoomId.value) {
      return;
    }
    if (
      options.rightSidebarOpen.value &&
      rightSidebarView.value === "members"
    ) {
      options.rightSidebarOpen.value = false;
      return;
    }
    options.rightSidebarOpen.value = true;
    rightSidebarView.value = "members";
    if (activeThread.value?.presentation === "sidebar") {
      closeActiveThread();
    }
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
    if (!options.selectedRoomId.value) {
      return;
    }
    if (
      activeThread.value?.presentation === "main" &&
      activeThread.value.roomId === options.selectedRoomId.value
    ) {
      closeActiveThread();
    }
    if (options.focusMessageInTimeline(eventId)) {
      if (options.isMobile.value) {
        options.rightSidebarOpen.value = false;
      }
      return;
    }
    let paginationAttempts = 0;
    while (
      options.hasMoreOlderMessages.value &&
      paginationAttempts < JUMP_TO_MESSAGE_MAX_PAGINATIONS
    ) {
      paginationAttempts += 1;
      const hasMoreMessages = await options.loadOlderMessages(
        options.selectedRoomId.value,
      );
      options.hasMoreOlderMessages.value = hasMoreMessages;
      options.loadMessages(options.selectedRoomId.value, {
        resetWindow: false,
      });
      if (options.focusMessageInTimeline(eventId)) {
        if (options.isMobile.value) {
          options.rightSidebarOpen.value = false;
        }
        return;
      }
    }
  }

  async function onPinMessage(eventId: string) {
    const roomId = options.selectedRoomId.value;
    if (!roomId || !options.canPinInActiveRoom.value) {
      return;
    }
    try {
      await options.pinRoomEvent(roomId, eventId);
      pinnedListVersion.value += 1;
    } catch (thrownError) {
      console.error("Failed to pin message", thrownError);
    }
  }

  async function onUnpinMessage(eventId: string) {
    const roomId = options.selectedRoomId.value;
    if (!roomId || !options.canPinInActiveRoom.value) {
      return;
    }
    try {
      await options.unpinRoomEvent(roomId, eventId);
      pinnedListVersion.value += 1;
    } catch (thrownError) {
      console.error("Failed to unpin message", thrownError);
    }
  }

  function openThreadFromRoomThreadList(rootEventId: string) {
    if (!options.selectedRoomId.value) {
      return;
    }
    activeReplyTo.value = null;
    activeEditTo.value = null;
    activeThreadReplyTo.value = null;
    activeThreadEditTo.value = null;
    activeThread.value = {
      roomId: options.selectedRoomId.value,
      rootEventId,
      presentation: "sidebar",
    };
    loadThreadPanelMessages();
    scheduleMarkActiveThreadRead();
  }

  function setActiveThreadReplyTarget(replyTarget: ChatTimelineReply) {
    activeThreadEditTo.value = null;
    activeThreadReplyTo.value = replyTarget;
  }

  function clearActiveThreadReply() {
    activeThreadReplyTo.value = null;
  }

  function setActiveThreadEditTarget(editTarget: {
    eventId: string;
    body: string;
  }) {
    activeThreadReplyTo.value = null;
    activeThreadEditTo.value = editTarget;
  }

  function clearActiveThreadEditTarget() {
    activeThreadEditTo.value = null;
  }

  function resetThreadStateForRoomChange() {
    rightSidebarView.value = "members";
    activeReplyTo.value = null;
    activeEditTo.value = null;
    activeThread.value = null;
    threadPanelAllMessages.value = [];
    activeThreadReplyTo.value = null;
    activeThreadEditTo.value = null;
  }

  function resetThreadStateIfRoomChanged(roomId: string | null) {
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
      resetThreadStateForRoomChange();
    }
  }

  function clearThreadNavRefreshTimer() {
    if (threadNavRefreshTimerId !== null) {
      window.clearTimeout(threadNavRefreshTimerId);
      threadNavRefreshTimerId = null;
    }
  }

  return {
    rightSidebarView,
    activeThread,
    threadPanelAllMessages,
    activeThreadReplyTo,
    activeThreadEditTo,
    threadCenterOnMessageId,
    threadScrollIntentToken,
    threadNavVersion,
    pinnedListVersion,
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
    scheduleThreadNavRefresh,
    syncThreadPanelIfActive,
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
    resetThreadStateForRoomChange,
    resetThreadStateIfRoomChanged,
    clearThreadNavRefreshTimer,
  };
}
