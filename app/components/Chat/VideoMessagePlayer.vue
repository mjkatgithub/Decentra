<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

const props = defineProps<{
  src?: string
  poster?: string
  durationMs?: number
  label?: string
  loading?: boolean
}>()

const { translateText } = useAppI18n()
</script>

<template>
  <div
    data-testid="video-message-player"
    class="bg-gray-50 dark:bg-gray-950"
  >
    <p
      v-if="label"
      class="truncate px-3 pt-2 text-xs text-gray-500 dark:text-gray-400"
    >
      {{ label }}
    </p>
    <div
      v-if="loading"
      class="flex h-48 w-full items-center justify-center"
    >
      <span class="text-xs text-gray-400">
        {{ translateText('chat.videoLoading') }}
      </span>
    </div>
    <video
      v-else-if="src"
      :src="src"
      :poster="poster"
      controls
      playsinline
      preload="metadata"
      class="max-h-96 w-full bg-black object-contain"
      data-testid="video-message-element"
    />
    <div
      v-else
      class="flex h-48 w-full items-center justify-center"
    >
      <span class="text-xs text-gray-400">
        {{ translateText('chat.videoUnavailable') }}
      </span>
    </div>
  </div>
</template>
