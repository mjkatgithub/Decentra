<script setup lang="ts">
import ChatMessageInput from "~/components/Chat/MessageInput.vue";
import ChatMessageList from "~/components/Chat/MessageList.vue";
import { useAppI18n } from "~/composables/useAppI18n";

interface ThreadMessage {
  id: string;
  kind: "message" | "notice";
  isDecryptionError?: boolean;
  isMessageDeleted?: boolean;
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
    encryptionInfo?: Record<string, unknown>;
    info?: { w?: number; h?: number; size?: number };
  };
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
  editTargetEventId?: string;
}

type MediaResolver = (media: {
  mxcUrl: string;
  mimetype?: string;
  isEncrypted?: boolean;
  encryptionInfo?: Record<string, unknown>;
}) => Promise<string>;

const props = defineProps<{
  roomId: string;
  rootEventId: string;
  title: string;
  startedByName: string;
  messages: ThreadMessage[];
  currentUserId?: string;
  canSendMessages?: boolean;
  pinnedEventIds?: string[];
  disabled?: boolean;
  replyTo?: ThreadMessage["replyTo"] | null;
  editTo?: { eventId: string; body: string } | null;
  resolveMediaBlobUrl?: MediaResolver;
}>();

const emit = defineEmits<{
  close: [];
  reply: [target: { eventId: string; senderName: string; body: string }];
  edit: [target: { eventId: string; body: string }];
  cancelReply: [];
  cancelEdit: [];
  send: [];
  toggleReaction: [
    payload: {
      messageId: string;
      emoji: string;
      ownReactionEventIds: string[];
    },
  ];
}>();

const { translateText } = useAppI18n();
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-white dark:bg-gray-900">
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b
             border-gray-200 px-3 py-2 dark:border-gray-800"
    >
      <div class="min-w-0 flex-1">
        <p
          class="truncate text-sm font-semibold text-gray-900
                 dark:text-gray-100"
        >
          {{ title }}
        </p>
        <p class="truncate text-xs text-gray-500 dark:text-gray-400">
          {{ translateText("chat.threadStartedBy") }} {{ startedByName }}
        </p>
      </div>
      <UButton
        type="button"
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="translateText('chat.threadClosePanel')"
        @click="emit('close')"
      />
    </header>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatMessageList
        class="min-h-0 flex-1"
        :messages="messages"
        :current-user-id="currentUserId"
        :can-send-messages="canSendMessages"
        :pinned-event-ids="pinnedEventIds"
        :resolve-media-blob-url="resolveMediaBlobUrl"
        is-thread-view
        :infinite-scroll-offset-px="80"
        @reply="emit('reply', $event)"
        @edit="emit('edit', $event)"
        @toggle-reaction="emit('toggleReaction', $event)"
      />
    </div>

    <ChatMessageInput
      :room-id="roomId"
      :disabled="disabled"
      :frequent-scope-key="currentUserId"
      :reply-to="replyTo ?? null"
      :edit-to="editTo ?? null"
      :thread-root-event-id="rootEventId"
      @cancel-reply="emit('cancelReply')"
      @cancel-edit="emit('cancelEdit')"
      @send="emit('send')"
    />
  </div>
</template>
