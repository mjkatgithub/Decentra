import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { ChatTimelineMessage } from "~/utils/chatTimeline";

const MOBILE_BREAKPOINT = 1024;
const INITIAL_TIMELINE_WINDOW_SIZE = 80;
const SCROLL_WINDOW_EXPAND_STEP = 40;

type ReplyTarget = ChatTimelineMessage["replyTo"] | null;

export const useChatStore = defineStore("chat", () => {
  const selectedRoomId = ref<string | null>(null);
  const selectedSpaceId = ref<string | null>(null);
  const matrixRooms = ref<Array<Record<string, any>>>([]);

  const allMessages = ref<ChatTimelineMessage[]>([]);
  const messages = ref<ChatTimelineMessage[]>([]);
  const loadingOlder = ref(false);
  const loadingNewer = ref(false);
  const hasMoreOlderMessages = ref(true);
  const windowStartIndex = ref(0);
  const windowEndIndex = ref(0);
  const centerOnMessageId = ref<string | undefined>(undefined);
  const stickToBottom = ref(false);
  const scrollIntentToken = ref(0);
  const preserveViewportOnPrepend = ref(false);
  const activeReplyTo = ref<ReplyTarget>(null);
  const loadMessagesTimerId = ref<number | null>(null);

  const leftSidebarOpen = ref(true);
  const rightSidebarOpen = ref(true);
  const isMobile = ref(false);
  const viewportInitialized = ref(false);
  const spaceRailExpanded = ref(false);

  const timelineWindowSize = computed(() => INITIAL_TIMELINE_WINDOW_SIZE);
  const scrollWindowExpandStep = computed(() => SCROLL_WINDOW_EXPAND_STEP);

  function setRooms(rooms: Array<Record<string, any>>) {
    matrixRooms.value = rooms;
  }

  function setSelectedSpaceId(spaceId: string | null) {
    selectedSpaceId.value = spaceId;
  }

  function setSelectedRoomId(roomId: string | null) {
    selectedRoomId.value = roomId;
  }

  function resetMessages() {
    allMessages.value = [];
    messages.value = [];
    windowStartIndex.value = 0;
    windowEndIndex.value = 0;
  }

  function setReplyTarget(replyTarget: ReplyTarget) {
    activeReplyTo.value = replyTarget;
  }

  function clearReplyTarget() {
    activeReplyTo.value = null;
  }

  function toggleLeftSidebar() {
    leftSidebarOpen.value = !leftSidebarOpen.value;
  }

  function toggleRightSidebar() {
    rightSidebarOpen.value = !rightSidebarOpen.value;
  }

  function toggleSpaceRail() {
    spaceRailExpanded.value = !spaceRailExpanded.value;
  }

  function closeMobileOverlays() {
    if (!isMobile.value) {
      return;
    }
    leftSidebarOpen.value = false;
    rightSidebarOpen.value = false;
  }

  function syncViewport(viewportWidth: number, force = false) {
    const wasMobile = isMobile.value;
    isMobile.value = viewportWidth < MOBILE_BREAKPOINT;
    const shouldReset =
      force || !viewportInitialized.value || wasMobile !== isMobile.value;
    if (shouldReset) {
      leftSidebarOpen.value = !isMobile.value;
      rightSidebarOpen.value = !isMobile.value;
      spaceRailExpanded.value = false;
    }
    viewportInitialized.value = true;
  }

  return {
    selectedRoomId,
    selectedSpaceId,
    matrixRooms,
    allMessages,
    messages,
    loadingOlder,
    loadingNewer,
    hasMoreOlderMessages,
    windowStartIndex,
    windowEndIndex,
    centerOnMessageId,
    stickToBottom,
    scrollIntentToken,
    preserveViewportOnPrepend,
    activeReplyTo,
    loadMessagesTimerId,
    leftSidebarOpen,
    rightSidebarOpen,
    isMobile,
    viewportInitialized,
    spaceRailExpanded,
    timelineWindowSize,
    scrollWindowExpandStep,
    setRooms,
    setSelectedSpaceId,
    setSelectedRoomId,
    resetMessages,
    setReplyTarget,
    clearReplyTarget,
    toggleLeftSidebar,
    toggleRightSidebar,
    toggleSpaceRail,
    closeMobileOverlays,
    syncViewport,
  };
});
