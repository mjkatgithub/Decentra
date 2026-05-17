<script setup lang="ts">
import { computed } from "vue";
import { useAppI18n } from "~/composables/useAppI18n";
import type { ChatThreadSummary } from "~/utils/chatTimeline";

const props = defineProps<{
  summary: ChatThreadSummary;
}>();

const emit = defineEmits<{
  open: [];
}>();

const { translateText } = useAppI18n();

const replyCountLabel = computed(() => {
  const count = props.summary.replyCount;
  if (count === 1) {
    return translateText("chat.threadOneReply");
  }
  return translateText("chat.threadManyReplies", {
    count: String(count),
  });
});

const lastReplySnippet = computed(() => {
  const body = props.summary.lastReply?.body?.split("\n")[0]?.trim() ?? "";
  if (!body) {
    return "";
  }
  return body.length > 72 ? `${body.slice(0, 69)}...` : body;
});

const lastReplySender = computed(() => {
  return props.summary.lastReply?.senderName ?? "";
});

const lastReplyAvatarUrl = computed(() => {
  return props.summary.lastReply?.avatarUrl;
});
</script>

<template>
  <button
    type="button"
    data-thread-preview
    class="mt-1 flex w-full max-w-xl items-center gap-2 rounded-md border
           border-gray-200 bg-gray-50/90 px-2 py-1 text-left text-xs
           transition hover:bg-gray-100 dark:border-gray-700
           dark:bg-gray-900/70 dark:hover:bg-gray-800"
    @click="emit('open')"
  >
    <UIcon
      name="i-lucide-messages-square"
      class="size-4 shrink-0 text-gray-500 dark:text-gray-400"
    />
    <span class="shrink-0 font-medium text-gray-600 dark:text-gray-300">
      {{ replyCountLabel }}
    </span>
    <template v-if="lastReplySender && lastReplySnippet">
      <img
        v-if="lastReplyAvatarUrl"
        :src="lastReplyAvatarUrl"
        :alt="lastReplySender"
        class="size-4 shrink-0 rounded-full object-cover"
      />
      <span
        v-else
        class="flex size-4 shrink-0 items-center justify-center rounded-full
               bg-gray-200 text-[9px] font-semibold text-gray-700
               dark:bg-gray-700 dark:text-gray-200"
      >
        {{ lastReplySender.trim().charAt(0).toUpperCase() || "?" }}
      </span>
      <span class="min-w-0 truncate text-gray-600 dark:text-gray-300">
        <span class="font-medium text-gray-700 dark:text-gray-200">
          {{ lastReplySender }}
        </span>
        {{ lastReplySnippet }}
      </span>
    </template>
  </button>
</template>
