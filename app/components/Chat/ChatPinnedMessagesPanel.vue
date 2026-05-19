<script setup lang="ts">
import { computed } from "vue";
import { useAppI18n } from "~/composables/useAppI18n";
import type { PinnedMessageEntry } from "~/utils/matrixPinnedMessageEntries";

const props = defineProps<{
  entries: PinnedMessageEntry[];
}>();

const emit = defineEmits<{
  close: [];
  openMessage: [eventId: string];
}>();

const { locale, translateText } = useAppI18n();

const relativeTimeFormatter = computed(() => {
  return new Intl.RelativeTimeFormat(locale.value, { numeric: "auto" });
});

function formatRelativePinnedTime(originServerTs: number): string {
  if (!originServerTs) {
    return "";
  }
  const deltaMs = originServerTs - Date.now();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const absDeltaMs = Math.abs(deltaMs);

  let relative = "";
  if (absDeltaMs < hourMs) {
    const minutes = Math.round(deltaMs / minuteMs);
    relative = relativeTimeFormatter.value.format(minutes, "minute");
  } else if (absDeltaMs < dayMs) {
    const hours = Math.round(deltaMs / hourMs);
    relative = relativeTimeFormatter.value.format(hours, "hour");
  } else {
    const days = Math.round(deltaMs / dayMs);
    relative = relativeTimeFormatter.value.format(days, "day");
  }
  return translateText("chat.pinnedAt", { time: relative });
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
        <p
          class="truncate text-sm font-semibold text-gray-900
                 dark:text-gray-100"
        >
          {{ translateText("chat.pinnedMessages") }}
        </p>
      </div>
      <UButton
        type="button"
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="translateText('chat.closePinnedMessages')"
        @click="emit('close')"
      />
    </header>

    <p
      v-if="entries.length === 0"
      class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
    >
      {{ translateText("chat.pinnedMessagesEmpty") }}
    </p>

    <ul
      v-else
      class="min-h-0 flex-1 overflow-y-auto"
    >
      <li
        v-for="entry in entries"
        :key="entry.eventId"
      >
        <button
          type="button"
          class="flex w-full flex-col gap-1 border-b border-gray-200 px-3
                 py-3 text-left transition hover:bg-gray-100
                 dark:border-gray-800 dark:hover:bg-gray-900"
          :class="{
            'opacity-70': entry.isUnavailable,
          }"
          @click="emit('openMessage', entry.eventId)"
        >
          <p
            class="truncate text-sm font-medium text-gray-900
                   dark:text-gray-100"
          >
            {{ entry.senderName || translateText("chat.pinnedMessageUnavailable") }}
          </p>
          <p
            v-if="entry.snippet"
            class="truncate text-xs text-gray-600 dark:text-gray-300"
          >
            {{ entry.snippet }}
          </p>
          <p
            v-if="entry.pinnedAtTs && !entry.isUnavailable"
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            {{ formatRelativePinnedTime(entry.pinnedAtTs) }}
          </p>
        </button>
      </li>
    </ul>
  </aside>
</template>
