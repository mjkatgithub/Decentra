<script setup lang="ts">
import { useAppI18n } from "~/composables/useAppI18n";
import { onBeforeUnmount, ref } from "vue";

const emit = defineEmits<{
  reply: [];
  reactionPick: [emoji: string];
}>();

const { translateText } = useAppI18n();
const pickerOpen = ref(false);
const customEmoji = ref("");
const pickerRoot = ref<HTMLElement | null>(null);

const quickReactions = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🙏", "🔥"];

function emitReaction(emoji: string) {
  const trimmedEmoji = emoji.trim();
  if (!trimmedEmoji) {
    return;
  }
  emit("reactionPick", trimmedEmoji);
  customEmoji.value = "";
  pickerOpen.value = false;
}

function submitCustomEmoji() {
  emitReaction(customEmoji.value);
}

function togglePicker() {
  pickerOpen.value = !pickerOpen.value;
}

function onDocumentClick(clickEvent: MouseEvent) {
  if (!pickerOpen.value || !pickerRoot.value) {
    return;
  }
  const clickTarget = clickEvent.target;
  if (!(clickTarget instanceof Node)) {
    return;
  }
  if (!pickerRoot.value.contains(clickTarget)) {
    pickerOpen.value = false;
  }
}

if (import.meta.client) {
  document.addEventListener("click", onDocumentClick);
}

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return;
  }
  document.removeEventListener("click", onDocumentClick);
});
</script>

<template>
  <div
    ref="pickerRoot"
    :class="[
      'pointer-events-none absolute -top-3 right-0 z-10 opacity-0',
      'transition-opacity duration-150',
      'group-hover:pointer-events-auto group-hover:opacity-100',
      'group-focus-within:pointer-events-auto group-focus-within:opacity-100'
    ]"
  >
    <div
      class="
        flex items-center gap-1 rounded-md border border-gray-200 bg-white
        px-1 py-1 shadow-sm dark:border-gray-700 dark:bg-gray-800
      "
    >
      <UButton
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-smile-plus"
        aria-label="Add reaction"
        title="Reaktion hinzufügen"
        class="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
        @click.stop="togglePicker"
      />
      <UButton
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-reply"
        :aria-label="translateText('chat.replyAction')"
        :title="translateText('chat.replyAction')"
        class="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
        @click="emit('reply')"
      />
    </div>
    <div
      v-if="pickerOpen"
      class="mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      @click.stop
    >
      <div class="grid grid-cols-4 gap-1">
        <button
          v-for="emoji in quickReactions"
          :key="emoji"
          type="button"
          class="rounded px-2 py-1 text-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          :data-emoji-option="emoji"
          @click="emitReaction(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
      <div class="mt-2 flex items-center gap-1">
        <input
          v-model="customEmoji"
          type="text"
          placeholder="Any emoji"
          class="
            w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs
            dark:border-gray-600 dark:bg-gray-900
          "
          @keydown.enter.prevent="submitCustomEmoji"
        />
        <UButton
          type="button"
          size="xs"
          color="neutral"
          variant="soft"
          @click="submitCustomEmoji"
        >
          Add
        </UButton>
      </div>
    </div>
  </div>
</template>
