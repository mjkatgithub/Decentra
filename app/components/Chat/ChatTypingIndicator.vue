<script setup lang="ts">
defineProps<{
  label: string | null
}>()
</script>

<template>
  <p
    v-if="label"
    data-testid="typing-indicator"
    aria-live="polite"
    class="truncate px-4 pb-1 text-xs text-gray-500 dark:text-gray-400"
  >
    {{ label }}
  </p>
</template>
