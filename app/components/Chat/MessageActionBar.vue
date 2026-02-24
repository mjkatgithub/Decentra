<script setup lang="ts">
import { useAppI18n } from "~/composables/useAppI18n";

const emit = defineEmits<{
  reply: [];
}>();

const { translateText } = useAppI18n();
</script>

<template>
  <div
    :class="[
      'pointer-events-none absolute -top-3 right-0 z-10 opacity-0',
      'transition-opacity duration-150',
      'group-hover:pointer-events-auto group-hover:opacity-100',
      'group-focus-within:pointer-events-auto group-focus-within:opacity-100'
    ]"
  >
    <div
      class="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1 py-1 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <UButton
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        :aria-label="translateText('chat.replyAction')"
        @click="emit('reply')"
      >
        {{ translateText("chat.replyAction") }}
      </UButton>
    </div>
  </div>
</template>
