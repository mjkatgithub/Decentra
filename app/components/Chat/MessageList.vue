<script setup lang="ts">
import { ref, watch } from "vue";
import ChatMessageItem from "~/components/Chat/MessageItem.vue";
import { useAppI18n } from "~/composables/useAppI18n";

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
}

type MediaResolver = (media: {
  mxcUrl: string;
  mimetype?: string;
  isEncrypted?: boolean;
  encryptionInfo?: Record<string, any>;
}) => Promise<string>;

const props = defineProps<{
  messages: MessageItem[];
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  resolveMediaBlobUrl?: MediaResolver;
}>();

const emit = defineEmits<{
  loadOlder: [];
  reply: [target: { eventId: string; senderName: string; body: string }];
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
</script>

<template>
  <div class="flex flex-1 flex-col overflow-y-auto p-4">
    <div
      v-if="canLoadOlder && messages.length > 0"
      class="mb-4 flex justify-center"
    >
      <UButton
        size="sm"
        variant="outline"
        :loading="loadingOlder"
        @click="emit('loadOlder')"
      >
        {{ translateText("chat.loadOlder") }}
      </UButton>
    </div>
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
          @reply="emitReplyTarget(msg)"
          @toggle-reaction="emit('toggleReaction', $event)"
          @open-lightbox="openLightbox(msg)"
        />
      </div>
    </template>
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
