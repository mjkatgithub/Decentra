<script setup lang="ts">
import { computed } from "vue";
import { useAppI18n } from "~/composables/useAppI18n";
import type { ThreadNavEntry } from "~/utils/chatTimeline";

const props = defineProps<{
  threads: ThreadNavEntry[];
}>();

const emit = defineEmits<{
  close: [];
  openThread: [rootEventId: string];
}>();

const { locale, translateText } = useAppI18n();

const relativeTimeFormatter = computed(() => {
  return new Intl.RelativeTimeFormat(locale.value, { numeric: "auto" });
});

function formatRelativeActivity(originServerTs: number): string {
  const deltaMs = originServerTs - Date.now();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const absDeltaMs = Math.abs(deltaMs);

  if (absDeltaMs < hourMs) {
    const minutes = Math.round(deltaMs / minuteMs);
    return relativeTimeFormatter.value.format(minutes, "minute");
  }
  if (absDeltaMs < dayMs) {
    const hours = Math.round(deltaMs / hourMs);
    return relativeTimeFormatter.value.format(hours, "hour");
  }
  const days = Math.round(deltaMs / dayMs);
  return relativeTimeFormatter.value.format(days, "day");
}

function replyCountLabel(replyCount: number): string {
  if (replyCount === 1) {
    return translateText("chat.threadOneReply");
  }
  return translateText("chat.threadManyReplies", {
    count: String(replyCount),
  });
}

function lastReplySnippet(body: string | undefined): string {
  const firstLine = body?.split("\n")[0]?.trim() ?? "";
  if (!firstLine) {
    return "";
  }
  return firstLine.length > 96 ? `${firstLine.slice(0, 93)}...` : firstLine;
}
</script>

<template>
  <aside
    class="flex h-full w-full flex-col border-l border-gray-200 bg-gray-50
           dark:border-gray-800 dark:bg-gray-950"
  >
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b
             border-gray-200 px-3 py-2 dark:border-gray-800"
    >
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {{ translateText("chat.roomThreads") }}
        </p>
      </div>
      <UButton
        type="button"
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="translateText('chat.closeRoomThreads')"
        @click="emit('close')"
      />
    </header>

    <p
      v-if="threads.length === 0"
      class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
    >
      {{ translateText("chat.roomThreadsEmpty") }}
    </p>

    <ul
      v-else
      class="min-h-0 flex-1 overflow-y-auto"
    >
      <li
        v-for="thread in threads"
        :key="thread.rootEventId"
      >
        <button
          type="button"
          class="flex w-full gap-3 border-b border-gray-200 px-3 py-3
                 text-left transition hover:bg-gray-100
                 dark:border-gray-800 dark:hover:bg-gray-900"
          @click="emit('openThread', thread.rootEventId)"
        >
          <div class="min-w-0 flex-1">
            <p
              class="truncate text-sm font-medium text-gray-900
                     dark:text-gray-100"
            >
              {{ thread.title }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ replyCountLabel(thread.replyCount) }}
              <span aria-hidden="true"> · </span>
              {{ formatRelativeActivity(thread.lastActivityTs) }}
            </p>
            <p
              v-if="thread.lastReplyBody"
              class="mt-2 truncate text-xs text-gray-600 dark:text-gray-300"
            >
              <span
                v-if="thread.lastReplySenderName"
                class="font-medium"
              >
                {{ thread.lastReplySenderName }}:
              </span>
              {{ lastReplySnippet(thread.lastReplyBody) }}
            </p>
          </div>
          <img
            v-if="thread.lastReplyAvatarUrl"
            :src="thread.lastReplyAvatarUrl"
            alt=""
            class="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover"
          />
        </button>
      </li>
    </ul>
  </aside>
</template>
