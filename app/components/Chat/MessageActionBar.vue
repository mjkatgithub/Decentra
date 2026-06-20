<script setup lang="ts">
import { useAppI18n } from "~/composables/useAppI18n";
import { useHoverCapable } from "~/composables/useHoverCapable";
import { computed, onBeforeUnmount, ref } from "vue";

const emit = defineEmits<{
  reply: [];
  edit: [];
  pin: [];
  unpin: [];
  reactionPick: [emoji: string];
  openThread: [];
}>();
const props = defineProps<{
  frequentScopeKey?: string;
  /** When false, hides the “thread” control (e.g. inside thread view). */
  showThreadButton?: boolean;
  showEditButton?: boolean;
  showPinButton?: boolean;
  showUnpinButton?: boolean;
  /** Pin bar visible (touch selection) regardless of hover. */
  visible?: boolean;
}>();

const { canUseHover } = useHoverCapable();

const { translateText } = useAppI18n();
const pickerOpen = ref(false);
const pickerRoot = ref<HTMLElement | null>(null);

const touchTargetClass = computed(() => {
  return canUseHover.value
    ? ""
    : "min-h-11 min-w-11 justify-center";
});

const barVisibleClass = computed(() => {
  if (props.visible) {
    return "pointer-events-auto opacity-100";
  }
  return [
    "pointer-events-none opacity-0",
    "hover-capable:group-hover:pointer-events-auto",
    "hover-capable:group-hover:opacity-100",
    "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
  ];
});

function emitReaction(emoji: string) {
  const trimmedEmoji = emoji.trim();
  if (!trimmedEmoji) {
    return;
  }
  emit("reactionPick", trimmedEmoji);
  pickerOpen.value = false;
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
    data-message-action-bar
    :class="[
      'absolute -top-3 right-0 z-10 transition-opacity duration-150',
      barVisibleClass,
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
        icon="i-lucide-smile"
        aria-label="Add reaction"
        :aria-expanded="pickerOpen"
        title="Reaktion hinzufügen"
        :class="[
          'text-gray-500 hover:text-gray-700 dark:text-gray-300',
          'dark:hover:text-gray-100',
          touchTargetClass,
        ]"
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
        :class="[
          'text-gray-500 hover:text-gray-700 dark:text-gray-300',
          'dark:hover:text-gray-100',
          touchTargetClass,
        ]"
        @click="emit('reply')"
      />
      <UButton
        v-if="props.showEditButton"
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-pencil"
        :aria-label="translateText('chat.editAction')"
        :title="translateText('chat.editAction')"
        :class="[
          'text-gray-500 hover:text-gray-700 dark:text-gray-300',
          'dark:hover:text-gray-100',
          touchTargetClass,
        ]"
        @click="emit('edit')"
      />
      <UButton
        v-if="props.showPinButton"
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-pin"
        :aria-label="translateText('chat.pinAction')"
        :title="translateText('chat.pinAction')"
        :class="[
          'text-gray-500 hover:text-gray-700 dark:text-gray-300',
          'dark:hover:text-gray-100',
          touchTargetClass,
        ]"
        @click="emit('pin')"
      />
      <UButton
        v-if="props.showUnpinButton"
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-pin-off"
        :aria-label="translateText('chat.unpinAction')"
        :title="translateText('chat.unpinAction')"
        :class="[
          'text-gray-500 hover:text-gray-700 dark:text-gray-300',
          'dark:hover:text-gray-100',
          touchTargetClass,
        ]"
        @click="emit('unpin')"
      />
      <UButton
        v-if="props.showThreadButton !== false"
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-messages-square"
        :aria-label="translateText('chat.threadAction')"
        :title="translateText('chat.threadAction')"
        :class="[
          'text-gray-500 hover:text-gray-700 dark:text-gray-300',
          'dark:hover:text-gray-100',
          touchTargetClass,
        ]"
        @click="emit('openThread')"
      />
    </div>
    <div
      v-if="pickerOpen"
      class="mt-1"
      @click.stop
    >
      <ChatReactionEmojiPicker
        :frequent-scope-key="props.frequentScopeKey"
        @select="emitReaction"
      />
    </div>
  </div>
</template>
