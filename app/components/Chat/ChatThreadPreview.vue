<script setup lang="ts">
import { computed } from "vue";
import { useAppI18n } from "~/composables/useAppI18n";
import type { ChatThreadSummary } from "~/utils/chatTimeline";

const props = defineProps<{
  summary: ChatThreadSummary;
  threadTitle: string;
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

const relativeLabel = computed(() => {
  const ts = props.summary.lastReply?.originServerTs;
  if (!ts) {
    return "";
  }
  const diffSec = Math.round((Date.now() - ts) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (diffSec < 60) {
    return rtf.format(-Math.max(1, diffSec), "second");
  }
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return rtf.format(-diffMin, "minute");
  }
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) {
    return rtf.format(-diffHr, "hour");
  }
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(-diffDay, "day");
});

const replyLine = computed(() => {
  const line = props.summary.lastReply?.body?.split("\n")[0]?.trim() ?? "";
  return line.length > 160 ? `${line.slice(0, 157)}...` : line;
});
</script>

<template>
  <button
    type="button"
    class="mt-2 w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 p-3
           text-left transition hover:bg-gray-100 dark:border-gray-700
           dark:bg-gray-900/80 dark:hover:bg-gray-800"
    @click="emit('open')"
  >
    <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
      {{ threadTitle }}
    </p>
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {{ replyCountLabel }}
      <span v-if="relativeLabel"> · {{ relativeLabel }}</span>
    </p>
    <p
      v-if="replyLine"
      class="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-300"
    >
      {{ replyLine }}
    </p>
  </button>
</template>
