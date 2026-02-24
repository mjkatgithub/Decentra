<script setup lang="ts">
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
  readBy?: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string;
  }>;
}

const props = defineProps<{
  message: MessageItem;
  displayUrl?: string;
  loadingMedia?: boolean;
}>();

const emit = defineEmits<{
  reply: [];
  openLightbox: [];
}>();
</script>

<template>
  <p
    v-if="message.kind === 'notice'"
    class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
    :class="
      message.isDecryptionError
        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200'
        : ''
    "
  >
    {{ message.body }}
  </p>
  <div
    v-else
    :data-message-id="message.id"
    :class="[
      'group relative -mx-2 rounded-lg px-2 py-1',
      'transition-colors duration-150',
      'hover:bg-gray-50 dark:hover:bg-gray-900/60'
    ]"
  >
    <ChatMessageActionBar @reply="emit('reply')" />
    <div class="flex items-start gap-3">
      <img
        v-if="message.avatarUrl"
        :src="message.avatarUrl"
        :alt="message.senderName"
        class="mt-0.5 h-10 w-10 rounded-full object-cover"
      />
      <div
        v-else
        class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
      >
        {{ message.senderName.trim().charAt(0).toUpperCase() || "?" }}
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ message.senderName }}
          </span>
        </div>

        <div
          v-if="message.replyTo"
          class="reply-preview mt-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300"
        >
          <p class="truncate font-medium">
            {{ message.replyTo.senderName }}
          </p>
          <p class="truncate">
            {{ message.replyTo.body }}
          </p>
        </div>

        <div
          v-if="message.media"
          class="mt-1 max-w-sm overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <div
            v-if="loadingMedia"
            class="flex h-48 w-full items-center justify-center bg-gray-50 dark:bg-gray-950"
          >
            <span class="text-xs text-gray-400">Loading…</span>
          </div>
          <img
            v-else-if="displayUrl"
            :src="displayUrl"
            :alt="message.body"
            class="max-h-96 w-full cursor-pointer object-contain bg-gray-50 dark:bg-gray-950"
            loading="lazy"
            @click="emit('openLightbox')"
          />
          <div
            v-else
            class="flex h-48 w-full items-center justify-center bg-gray-50 dark:bg-gray-950"
          >
            <span class="text-xs text-gray-400">{{ message.body }}</span>
          </div>
        </div>
        <p v-else class="text-sm wrap-break-word">
          {{ message.body }}
        </p>

        <div
          v-if="message.readBy && message.readBy.length > 0"
          class="mt-1 flex items-center justify-end"
        >
          <div class="flex -space-x-2">
            <div
              v-for="reader in message.readBy.slice(0, 5)"
              :key="`${message.id}-${reader.userId}`"
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
                {{ reader.displayName.trim().charAt(0).toUpperCase() || "?" }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
