<script setup lang="ts">
import type {
  ChatThreadSummary,
  ChatTimelineReply,
} from "~/utils/chatTimeline";
import ChatThreadPreview from "~/components/Chat/ChatThreadPreview.vue";
import ReplyQuotePreview from "~/components/Chat/ReplyQuotePreview.vue";
import VoiceMessagePlayer from "~/components/Chat/VoiceMessagePlayer.vue";
import { useHoverCapable } from "~/composables/useHoverCapable";
import {
  isInteractiveMessageRowTarget,
  isWithinMessageRowTapThreshold,
} from "~/utils/messageRowPointer";
import { computed, ref } from "vue";
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
    duration?: number;
  };
}

interface MessageItem {
  id: string;
  kind: "message" | "notice";
  isDecryptionError?: boolean;
  isMessageDeleted?: boolean;
  senderId: string;
  senderName: string;
  avatarUrl?: string;
  body: string;
  replyTo?: ChatTimelineReply;
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
  isEdited?: boolean;
  editTargetEventId?: string;
}

const props = defineProps<{
  message: MessageItem;
  displayUrl?: string;
  replyDisplayUrl?: string;
  loadingMedia?: boolean;
  loadingReplyMedia?: boolean;
  isHighlighted?: boolean;
  currentUserId?: string;
  canSendMessages?: boolean;
  canPin?: boolean;
  isPinned?: boolean;
  /** Hide thread affordances (when rendering inside thread panel) */
  isThreadView?: boolean;
  isSelected?: boolean;
}>();

const { translateText } = useAppI18n();
const { canUseHover } = useHoverCapable();

const emit = defineEmits<{
  activate: [];
  reply: [];
  edit: [];
  pin: [];
  unpin: [];
  openLightbox: [];
  openThread: [];
  openThreadPreview: [];
  openReplyTarget: [eventId: string];
  toggleReaction: [payload: {
    messageId: string;
    emoji: string;
    ownReactionEventIds: string[];
  }];
}>();

const isAudioMedia = computed(() => {
  return props.message.media?.mimetype?.startsWith("audio/") === true;
});

const showEditButton = computed(() => {
  if (!props.canSendMessages || !props.currentUserId) {
    return false;
  }
  if (props.message.senderId !== props.currentUserId) {
    return false;
  }
  if (props.message.kind !== "message" || props.message.isDecryptionError) {
    return false;
  }
  if (props.message.media) {
    return false;
  }
  return true;
});

const showPinButton = computed(() => {
  if (!props.canPin || props.isPinned) {
    return false;
  }
  if (props.message.kind !== "message" || props.message.isDecryptionError) {
    return false;
  }
  if (props.message.isMessageDeleted || props.message.media) {
    return false;
  }
  return true;
});

const showUnpinButton = computed(() => {
  if (!props.canPin || !props.isPinned) {
    return false;
  }
  if (props.message.kind !== "message" || props.message.isDecryptionError) {
    return false;
  }
  if (props.message.isMessageDeleted) {
    return false;
  }
  return true;
});

function emitToggleReaction(emoji: string, ownReactionEventIds: string[] = []) {
  emit("toggleReaction", {
    messageId: props.message.id,
    emoji,
    ownReactionEventIds,
  });
}

function handlePickerReaction(emoji: string) {
  const existingReaction = props.message.reactions?.find((reaction) => {
    return reaction.emoji === emoji;
  });
  emitToggleReaction(emoji, existingReaction?.ownReactionEventIds ?? []);
}

const pointerStartX = ref(0);
const pointerStartY = ref(0);

function onMessageRowPointerDown(pointerEvent: PointerEvent) {
  if (canUseHover.value) {
    return;
  }
  pointerStartX.value = pointerEvent.clientX;
  pointerStartY.value = pointerEvent.clientY;
}

function onMessageRowPointerUp(pointerEvent: PointerEvent) {
  if (canUseHover.value) {
    return;
  }
  if (isInteractiveMessageRowTarget(pointerEvent.target)) {
    return;
  }
  if (
    !isWithinMessageRowTapThreshold(
      pointerStartX.value,
      pointerStartY.value,
      pointerEvent.clientX,
      pointerEvent.clientY,
    )
  ) {
    return;
  }
  emit("activate");
}
</script>

<template>
  <p
    v-if="message.kind === 'notice'"
    class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
    :class="
      message.isDecryptionError && !message.isMessageDeleted
        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200'
        : ''
    "
  >
    {{ message.body }}
  </p>
  <div
    v-else
    :data-message-id="message.id"
    :data-message-selected="isSelected ? 'true' : undefined"
    :aria-selected="isSelected ? 'true' : 'false'"
    :class="[
      'group relative -mx-2 rounded-lg px-2 py-1',
      'transition-colors duration-150',
      'hover-capable:hover:bg-gray-50',
      'hover-capable:dark:hover:bg-gray-900/60',
      isSelected
        ? 'bg-gray-100 dark:bg-gray-800/80'
        : '',
      isHighlighted
        ? 'ring-2 ring-primary-400/70 dark:ring-primary-500/60'
        : '',
    ]"
    @pointerdown="onMessageRowPointerDown"
    @pointerup="onMessageRowPointerUp"
  >
    <ChatMessageActionBar
      :visible="isSelected"
      :frequent-scope-key="props.currentUserId"
      :show-thread-button="!isThreadView"
      :show-edit-button="showEditButton"
      :show-pin-button="showPinButton"
      :show-unpin-button="showUnpinButton"
      @reply="emit('reply')"
      @edit="emit('edit')"
      @pin="emit('pin')"
      @unpin="emit('unpin')"
      @reaction-pick="handlePickerReaction"
      @open-thread="emit('openThread')"
    />
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
          <span
            v-if="message.isEdited"
            class="text-xs text-gray-400 dark:text-gray-500"
          >
            ({{ translateText("chat.messageEdited") }})
          </span>
        </div>

        <ReplyQuotePreview
          v-if="message.replyTo"
          :reply-to="message.replyTo"
          :display-url="replyDisplayUrl"
          :loading="loadingReplyMedia"
          clickable
          @activate="emit('openReplyTarget', message.replyTo!.eventId)"
        />

        <div
          v-if="message.media"
          class="mt-1 max-w-sm overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <VoiceMessagePlayer
            v-if="isAudioMedia"
            :src="displayUrl"
            :duration-ms="message.media.info?.duration"
            :label="message.body"
            :loading="loadingMedia"
          />
          <template v-else>
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
          </template>
        </div>
        <p v-else class="text-sm wrap-break-word">
          {{ message.body }}
        </p>
        <div
          v-if="props.isPinned"
          class="mt-1.5 inline-flex items-center gap-1 rounded-md
                 bg-gray-100 px-2 py-0.5 text-xs font-medium
                 text-gray-600 dark:bg-gray-800/80 dark:text-gray-400"
          data-pinned-badge
        >
          <UIcon
            name="i-lucide-pin"
            class="size-3.5 shrink-0"
          />
          <span>{{ translateText("chat.messagePinnedLabel") }}</span>
        </div>
        <ChatThreadPreview
          v-if="message.threadSummary && !isThreadView"
          :summary="message.threadSummary"
          @open="emit('openThreadPreview')"
        />
        <div
          v-if="message.reactions && message.reactions.length > 0"
          class="mt-2 flex flex-wrap gap-1"
        >
          <button
            v-for="reaction in message.reactions"
            :key="`${message.id}-${reaction.emoji}`"
            type="button"
            :data-reaction-chip="reaction.emoji"
            class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors"
            :class="
              reaction.hasOwnReaction
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/70 dark:bg-blue-950/60 dark:text-blue-200'
                : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            "
            @click="emitToggleReaction(reaction.emoji, reaction.ownReactionEventIds)"
          >
            <span>{{ reaction.emoji }}</span>
            <span>{{ reaction.count }}</span>
          </button>
        </div>

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
