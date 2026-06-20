import {
  buildReactionSummaryByEventId,
  mapTimelineEventsToMessages,
  resolvePreservedTimelineWindow,
  resolveTimelineWindowSelection,
} from "~/utils/chatTimeline";
import type { ChatMessage } from "~/composables/chat/chatPageTypes";
import {
  INITIAL_TIMELINE_WINDOW_SIZE,
  SCROLL_WINDOW_EXPAND_STEP,
} from "~/composables/chat/chatPageTypes";

export function useChatTimelineWindow(options: {
  client: Ref<Record<string, any> | null>;
  selectedRoomId: Ref<string | null>;
  loadOlderMessages: (roomId: string) => Promise<boolean>;
  toggleReaction: (
    roomId: string,
    messageId: string,
    emoji: string,
    ownReactionEventIds: string[],
  ) => Promise<void>;
  translateText: (key: string, params?: Record<string, string>) => string;
  getMemberAvatarUrl: (member: Record<string, any>) => string | undefined;
  getMediaUrl: (mxcUrl: string) => string;
  scheduleMarkActiveRoomRead: () => void;
  onRoomMessagesUpdated: (roomId: string) => void;
}) {
  const allMessages = ref<ChatMessage[]>([]);
  const messages = ref<ChatMessage[]>([]);
  const loadingOlder = ref(false);
  const loadingNewer = ref(false);
  const hasMoreOlderMessages = ref(true);
  const windowStartIndex = ref(0);
  const windowEndIndex = ref(0);
  const centerOnMessageId = ref<string | undefined>(undefined);
  const stickToBottom = ref(false);
  const scrollIntentToken = ref(0);
  const preserveViewportOnPrepend = ref(false);
  const loadMessagesTimerId = ref<number | null>(null);

  function getOwnReadAnchorEventId(
    room: Record<string, any>,
  ): string | undefined {
    const ownUserId = options.client.value?.getUserId();
    if (!ownUserId) {
      return undefined;
    }
    const liveTimelineEvents = room.getLiveTimeline().getEvents();
    for (
      let index = liveTimelineEvents.length - 1;
      index >= 0;
      index -= 1
    ) {
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
    windowEndIndex.value = Math.max(
      windowStartIndex.value,
      windowEndIndex.value,
    );
    windowEndIndex.value = Math.min(totalMessages, windowEndIndex.value);
  }

  function applyWindow() {
    clampWindowRange(allMessages.value.length);
    messages.value = allMessages.value.slice(
      windowStartIndex.value,
      windowEndIndex.value,
    );
  }

  function buildDeletedMessageText(): string {
    return options.translateText("chat.messageDeleted");
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

      if (membership === "join") {
        return `${targetName} joined the channel`;
      }
      if (membership === "leave") {
        return `${targetName} left the channel`;
      }
      if (membership === "invite") {
        return `${senderName} invited ${targetName}`;
      }
      if (membership === "ban") {
        return `${targetName} was banned`;
      }
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
      const nextPinned = Array.isArray(content.pinned)
        ? content.pinned
        : [];
      const addedIds = nextPinned.filter((eventId) => {
        return !previousPinned.includes(eventId);
      });
      const removedIds = previousPinned.filter((eventId) => {
        return !nextPinned.includes(eventId);
      });
      if (addedIds.length === 1 && removedIds.length === 0) {
        return options.translateText("chat.noticePinnedMessage", {
          name: senderName,
        });
      }
      if (removedIds.length === 1 && addedIds.length === 0) {
        return options.translateText("chat.noticeUnpinnedMessage", {
          name: senderName,
        });
      }
      return options.translateText("chat.noticeUpdatedPinnedMessages", {
        name: senderName,
      });
    }
    return `${senderName} updated room settings`;
  }

  function loadMessages(
    roomId: string,
    loadOptions?: { resetWindow?: boolean },
  ) {
    const room = options.client.value?.getRoom(roomId);
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
      ownUserId: options.client.value?.getUserId() ?? undefined,
      getMemberAvatarUrl: (member) => {
        return options.getMemberAvatarUrl(
          member as unknown as Record<string, any>,
        );
      },
      getMediaUrl: options.getMediaUrl,
      buildNoticeText,
      buildDeletedMessageText,
    });
    allMessages.value = mappedMessages as ChatMessage[];

    const shouldResetWindow = loadOptions?.resetWindow ?? false;
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
      options.onRoomMessagesUpdated(roomId);
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
          options.onRoomMessagesUpdated(roomId);
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
    options.onRoomMessagesUpdated(roomId);
  }

  function patchMessageReactions(roomId: string) {
    const room = options.client.value?.getRoom(roomId);
    if (!room) {
      return;
    }
    const reactionSummaryByEventId = buildReactionSummaryByEventId(
      room.getLiveTimeline().getEvents(),
      options.client.value?.getUserId() ?? undefined,
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
    options.onRoomMessagesUpdated(roomId);
  }

  function isReactionRelatedEvent(eventType: string): boolean {
    return eventType === "m.reaction" || eventType === "m.room.redaction";
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
    const roomId = options.selectedRoomId.value;
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
    options.onRoomMessagesUpdated(roomId);
  }

  async function onToggleReaction(payload: {
    messageId: string;
    emoji: string;
    ownReactionEventIds: string[];
  }) {
    const activeRoomId = options.selectedRoomId.value;
    if (!activeRoomId) {
      return;
    }
    await options.toggleReaction(
      activeRoomId,
      payload.messageId,
      payload.emoji,
      payload.ownReactionEventIds,
    );
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
    if (!options.selectedRoomId.value || loadingOlder.value) {
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
        const hasMoreMessages = await options.loadOlderMessages(
          options.selectedRoomId.value!,
        );
        hasMoreOlderMessages.value = hasMoreMessages;
        loadMessages(options.selectedRoomId.value!, { resetWindow: false });
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
      options.scheduleMarkActiveRoomRead();
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
        options.scheduleMarkActiveRoomRead();
      }
    } finally {
      loadingNewer.value = false;
    }
  }

  function focusMessageInTimeline(eventId: string): boolean {
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

  function clearLoadMessagesTimer() {
    if (loadMessagesTimerId.value !== null) {
      window.clearTimeout(loadMessagesTimerId.value);
      loadMessagesTimerId.value = null;
    }
  }

  function resetTimelineState() {
    allMessages.value = [];
    messages.value = [];
  }

  return {
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
    loadMessagesTimerId,
    loadMessages,
    applyWindow,
    clampWindowRange,
    patchMessageReactions,
    getOwnReadAnchorEventId,
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
  };
}
