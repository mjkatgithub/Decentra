<script setup lang="ts">
import { ref, watch } from "vue";
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
  media?: MediaInfo;
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
        <template v-if="msg.kind === 'notice'">
          <p
            class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
            :class="
              msg.isDecryptionError
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200'
                : ''
            "
          >
            {{ msg.body }}
          </p>
        </template>
        <template v-else>
          <div class="flex items-start gap-3">
            <img
              v-if="msg.avatarUrl"
              :src="msg.avatarUrl"
              :alt="msg.senderName"
              class="mt-0.5 h-10 w-10 rounded-full object-cover"
            />
            <div
              v-else
              class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            >
              {{ msg.senderName.trim().charAt(0).toUpperCase() || "?" }}
            </div>

            <div class="min-w-0 flex-1">
              <span
                class="text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {{ msg.senderName }}
              </span>
              <div
                v-if="msg.media"
                class="mt-1 max-w-sm overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <div
                  v-if="loadingMedia[msg.id]"
                  class="flex h-48 w-full items-center justify-center bg-gray-50 dark:bg-gray-950"
                >
                  <span class="text-xs text-gray-400">Loading…</span>
                </div>
                <img
                  v-else-if="getDisplayUrl(msg)"
                  :src="getDisplayUrl(msg)"
                  :alt="msg.body"
                  class="max-h-96 w-full cursor-pointer object-contain bg-gray-50 dark:bg-gray-950"
                  loading="lazy"
                  @click="openLightbox(msg)"
                />
                <div
                  v-else
                  class="flex h-48 w-full items-center justify-center bg-gray-50 dark:bg-gray-950"
                >
                  <span class="text-xs text-gray-400">{{ msg.body }}</span>
                </div>
              </div>
              <p v-else class="text-sm wrap-break-word">
                {{ msg.body }}
              </p>

              <div
                v-if="msg.readBy && msg.readBy.length > 0"
                class="mt-1 flex items-center justify-end"
              >
                <div class="flex -space-x-2">
                  <div
                    v-for="reader in msg.readBy.slice(0, 5)"
                    :key="`${msg.id}-${reader.userId}`"
                    class="h-4 w-4 overflow-hidden rounded-full border border-white bg-gray-200 dark:border-gray-900 dark:bg-gray-700"
                    :title="reader.displayName"
                  >
                    <img
                      v-if="reader.avatarUrl"
                      :src="reader.avatarUrl"
                      :alt="reader.displayName"
                      class="h-full w-full object-cover"
                    />
                    <span
                      v-else
                      class="flex h-full w-full items-center justify-center text-[8px] font-semibold text-gray-700 dark:text-gray-200"
                    >
                      {{
                        reader.displayName.trim().charAt(0).toUpperCase() || "?"
                      }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
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
