<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import ChatMessageItem from "~/components/Chat/MessageItem.vue";
import { useAppI18n } from "~/composables/useAppI18n";
import type { ChatThreadSummary } from "~/utils/chatTimeline";

interface MediaInfo {
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
}

interface MessageItem {
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
  media?: MediaInfo;
  reactions?: Array<{
    emoji: string;
    count: number;
    hasOwnReaction: boolean;
    ownReactionEventIds: string[];
  }>;
  readBy?: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string;
  }>;
  threadSummary?: ChatThreadSummary;
  editTargetEventId?: string;
}

type MediaResolver = (media: {
  mxcUrl: string;
  mimetype?: string;
  isEncrypted?: boolean;
  encryptionInfo?: Record<string, any>;
}) => Promise<string>;

const props = defineProps<{
  messages: MessageItem[];
  resolveMediaBlobUrl?: MediaResolver;
  currentUserId?: string;
  canSendMessages?: boolean;
  loadingOlder?: boolean;
  loadingNewer?: boolean;
  centerOnMessageId?: string;
  stickToBottom?: boolean;
  scrollIntentToken?: number;
  preserveViewportOnPrepend?: boolean;
  infiniteScrollOffsetPx?: number;
  /** Messages are rendered inside an active thread panel */
  isThreadView?: boolean;
}>();

const emit = defineEmits<{
  reachTop: [];
  reachBottom: [];
  reply: [target: { eventId: string; senderName: string; body: string }];
  edit: [target: { eventId: string; body: string }];
  openThread: [target: { eventId: string; senderName: string; body: string }];
  openThreadPreview: [
    target: { eventId: string; senderName: string; body: string },
  ];
  toggleReaction: [payload: {
    messageId: string;
    emoji: string;
    ownReactionEventIds: string[];
  }];
}>();

const { translateText } = useAppI18n();

const resolvedBlobUrls = ref<Record<string, string>>({});
const loadingMedia = ref<Record<string, boolean>>({});
const lightboxUrl = ref<string | null>(null);
const scrollContainer = ref<HTMLElement | null>(null);
const topSentinel = ref<HTMLElement | null>(null);
const bottomSentinel = ref<HTMLElement | null>(null);
const topObserver = ref<IntersectionObserver | null>(null);
const bottomObserver = ref<IntersectionObserver | null>(null);
const lastTopEmitAt = ref(0);
const lastBottomEmitAt = ref(0);
const observerCooldownMs = 200;
const selectedMessageId = ref<string | null>(null);

function selectMessage(messageId: string) {
  selectedMessageId.value = messageId;
}

function clearSelection() {
  selectedMessageId.value = null;
}

function isSelectionTarget(node: Node | null): boolean {
  if (!(node instanceof Element)) {
    return false;
  }
  return Boolean(
    node.closest("[data-message-id]") ||
      node.closest("[data-message-action-bar]"),
  );
}

function onDocumentPointerDown(pointerEvent: PointerEvent) {
  if (selectedMessageId.value === null) {
    return;
  }
  const target = pointerEvent.target;
  if (!(target instanceof Node)) {
    return;
  }
  if (isSelectionTarget(target)) {
    return;
  }
  clearSelection();
}

function onDocumentKeyDown(keyEvent: KeyboardEvent) {
  if (keyEvent.key !== "Escape" || selectedMessageId.value === null) {
    return;
  }
  clearSelection();
}

function onScrollContainerClick(clickEvent: MouseEvent) {
  if (clickEvent.target !== scrollContainer.value) {
    return;
  }
  clearSelection();
}

function needsBlobFetch(media: MediaInfo): boolean {
  return (
    !media.url ||
    media.isEncrypted === true ||
    media.mimetype === "image/svg+xml" ||
    media.mimetype === "image/gif"
  );
}

function getDisplayUrl(msg: MessageItem): string | undefined {
  if (!msg.media) return undefined;
  if (resolvedBlobUrls.value[msg.id]) return resolvedBlobUrls.value[msg.id];
  if (msg.media.url) return msg.media.url;
  return undefined;
}

async function resolveMedia(msg: MessageItem) {
  if (!msg.media || !props.resolveMediaBlobUrl) return;
  if (resolvedBlobUrls.value[msg.id] || loadingMedia.value[msg.id]) return;
  if (!needsBlobFetch(msg.media)) return;

  loadingMedia.value[msg.id] = true;
  try {
    const blobUrl = await props.resolveMediaBlobUrl({
      mxcUrl: msg.media.mxcUrl,
      mimetype: msg.media.mimetype,
      isEncrypted: msg.media.isEncrypted,
      encryptionInfo: msg.media.encryptionInfo,
    });
    resolvedBlobUrls.value[msg.id] = blobUrl;
  } catch (error) {
    console.error("Failed to resolve media for", msg.id, error);
  } finally {
    loadingMedia.value[msg.id] = false;
  }
}

function openLightbox(msg: MessageItem) {
  const url = getDisplayUrl(msg);
  if (url) {
    lightboxUrl.value = url;
  }
}

function closeLightbox() {
  lightboxUrl.value = null;
}

function emitReplyTarget(msg: MessageItem) {
  emit("reply", {
    eventId: msg.id,
    senderName: msg.senderName,
    body: msg.body,
  });
}

function emitEditTarget(msg: MessageItem) {
  emit("edit", {
    eventId: msg.editTargetEventId ?? msg.id,
    body: msg.body,
  });
}

function emitThreadTarget(msg: MessageItem) {
  emit("openThread", {
    eventId: msg.id,
    senderName: msg.senderName,
    body: msg.body,
  });
}

function emitThreadPreviewTarget(msg: MessageItem) {
  emit("openThreadPreview", {
    eventId: msg.id,
    senderName: msg.senderName,
    body: msg.body,
  });
}

function disconnectObservers() {
  topObserver.value?.disconnect();
  bottomObserver.value?.disconnect();
  topObserver.value = null;
  bottomObserver.value = null;
}

function maybeEmitReachTop() {
  if (props.loadingOlder) {
    return;
  }
  const now = Date.now();
  if (now - lastTopEmitAt.value < observerCooldownMs) {
    return;
  }
  lastTopEmitAt.value = now;
  emit("reachTop");
}

function maybeEmitReachBottom() {
  if (props.loadingNewer) {
    return;
  }
  const now = Date.now();
  if (now - lastBottomEmitAt.value < observerCooldownMs) {
    return;
  }
  lastBottomEmitAt.value = now;
  emit("reachBottom");
}

function setupObservers() {
  disconnectObservers();
  if (
    !scrollContainer.value ||
    !topSentinel.value ||
    !bottomSentinel.value ||
    typeof IntersectionObserver === "undefined"
  ) {
    return;
  }

  const offsetPx = Math.max(0, props.infiniteScrollOffsetPx ?? 180);
  const margin = `${offsetPx}px 0px ${offsetPx}px 0px`;
  topObserver.value = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          maybeEmitReachTop();
        }
      }
    },
    {
      root: scrollContainer.value,
      rootMargin: margin,
      threshold: 0.01,
    },
  );
  bottomObserver.value = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          maybeEmitReachBottom();
        }
      }
    },
    {
      root: scrollContainer.value,
      rootMargin: margin,
      threshold: 0.01,
    },
  );
  topObserver.value.observe(topSentinel.value);
  bottomObserver.value.observe(bottomSentinel.value);
}

function scrollToBottom() {
  const container = scrollContainer.value;
  if (!container) {
    return;
  }
  container.scrollTop = container.scrollHeight;
}

function centerMessage(messageId: string) {
  const container = scrollContainer.value;
  if (!container) {
    return;
  }
  const messageElements = Array.from(
    container.querySelectorAll<HTMLElement>("[data-message-id]"),
  );
  const targetElement = messageElements.find((messageElement) => {
    return messageElement.dataset.messageId === messageId;
  });
  if (!targetElement) {
    return;
  }
  const targetCenterY = targetElement.offsetTop + targetElement.offsetHeight / 2;
  const nextScrollTop = targetCenterY - container.clientHeight / 2;
  container.scrollTop = Math.max(0, nextScrollTop);
}

watch(
  () => props.messages,
  (msgs) => {
    for (const msg of msgs) {
      if (msg.media && needsBlobFetch(msg.media)) {
        resolveMedia(msg);
      }
    }
  },
  { immediate: true, deep: false },
);

watch(
  () => props.scrollIntentToken,
  async () => {
    await nextTick();
    if (props.centerOnMessageId) {
      centerMessage(props.centerOnMessageId);
      return;
    }
    if (props.stickToBottom) {
      scrollToBottom();
    }
  },
  { immediate: true },
);

watch(
  () => props.messages,
  async (nextMessages, previousMessages) => {
    if (!props.preserveViewportOnPrepend) {
      return;
    }
    const container = scrollContainer.value;
    if (!container) {
      return;
    }
    if (previousMessages.length === 0 || nextMessages.length <= previousMessages.length) {
      return;
    }
    const previousFirstMessage = previousMessages[0];
    const nextFirstMessage = nextMessages[0];
    if (!previousFirstMessage || !nextFirstMessage) {
      return;
    }
    if (previousFirstMessage.id === nextFirstMessage.id) {
      return;
    }
    const previousScrollHeight = container.scrollHeight;
    await nextTick();
    const scrollHeightDelta = container.scrollHeight - previousScrollHeight;
    container.scrollTop += scrollHeightDelta;
  },
  { deep: false },
);

onMounted(async () => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeyDown);
  await nextTick();
  setupObservers();
});

onBeforeUnmount(() => {
  disconnectObservers();
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeyDown);
});

watch(
  () => props.messages,
  (messages) => {
    if (selectedMessageId.value === null) {
      return;
    }
    const stillPresent = messages.some((message) => {
      return message.id === selectedMessageId.value;
    });
    if (!stillPresent) {
      clearSelection();
    }
  },
  { deep: false },
);

watch(
  [topSentinel, bottomSentinel, scrollContainer],
  async () => {
    await nextTick();
    setupObservers();
  },
  { deep: false },
);
</script>

<template>
  <div
    ref="scrollContainer"
    class="flex flex-1 flex-col overflow-y-auto p-4"
    @click="onScrollContainerClick"
  >
    <div ref="topSentinel" class="h-px w-full" />
    <template v-if="messages.length === 0">
      <p class="py-8 text-center text-gray-500 dark:text-gray-400">
        {{ translateText("chat.noMessages") }}
      </p>
    </template>
    <template v-else>
      <div v-for="msg in messages" :key="msg.id" class="mb-4">
        <ChatMessageItem
          :message="msg"
          :display-url="getDisplayUrl(msg)"
          :loading-media="Boolean(loadingMedia[msg.id])"
          :current-user-id="props.currentUserId"
          :can-send-messages="props.canSendMessages"
          :is-thread-view="props.isThreadView"
          :is-selected="selectedMessageId === msg.id"
          @activate="selectMessage(msg.id)"
          @reply="emitReplyTarget(msg)"
          @edit="emitEditTarget(msg)"
          @open-thread="emitThreadTarget(msg)"
          @open-thread-preview="emitThreadPreviewTarget(msg)"
          @toggle-reaction="emit('toggleReaction', $event)"
          @open-lightbox="openLightbox(msg)"
        />
      </div>
    </template>
    <div ref="bottomSentinel" class="h-px w-full" />
  </div>

  <!-- Lightbox overlay -->
  <Teleport to="body">
    <div
      v-if="lightboxUrl"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click.self="closeLightbox"
    >
      <button
        class="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        @click="closeLightbox"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-6 w-6"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img
        :src="lightboxUrl"
        alt="Full size"
        class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
      />
    </div>
  </Teleport>
</template>
