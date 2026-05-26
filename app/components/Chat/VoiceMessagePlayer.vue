<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAppI18n } from '~/composables/useAppI18n'

const props = defineProps<{
  src?: string
  durationMs?: number
  label?: string
  loading?: boolean
}>()

const { translateText } = useAppI18n()
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTimeSec = ref(0)

const durationSec = computed(() => {
  if (typeof props.durationMs === 'number' && props.durationMs > 0) {
    return props.durationMs / 1000
  }
  return 0
})

function formatTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainder = totalSeconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

const displayCurrent = computed(() => formatTime(currentTimeSec.value))
const displayDuration = computed(() => {
  const audioDuration = audioRef.value?.duration
  if (typeof audioDuration === 'number' && Number.isFinite(audioDuration)) {
    return formatTime(audioDuration)
  }
  return formatTime(durationSec.value)
})

function onTimeUpdate() {
  currentTimeSec.value = audioRef.value?.currentTime ?? 0
}

function onEnded() {
  isPlaying.value = false
  currentTimeSec.value = 0
}

async function togglePlayback() {
  const audioElement = audioRef.value
  if (!audioElement || !props.src) {
    return
  }
  if (isPlaying.value) {
    audioElement.pause()
    isPlaying.value = false
    return
  }
  try {
    await audioElement.play()
    isPlaying.value = true
  } catch (thrownError) {
    console.error('Voice playback failed', thrownError)
    isPlaying.value = false
  }
}

watch(
  () => props.src,
  () => {
    isPlaying.value = false
    currentTimeSec.value = 0
    audioRef.value?.pause()
  },
)

onBeforeUnmount(() => {
  audioRef.value?.pause()
})
</script>

<template>
  <div
    data-testid="voice-message-player"
    class="flex min-w-[12rem] items-center gap-2 bg-gray-50 px-3 py-2
           dark:bg-gray-950"
  >
    <UButton
      type="button"
      size="sm"
      color="neutral"
      variant="soft"
      :disabled="loading || !src"
      :aria-label="translateText('chat.voicePlay')"
      data-testid="voice-play-button"
      @click="togglePlayback"
    >
      <UIcon
        :name="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
        class="size-4"
      />
    </UButton>
    <div class="min-w-0 flex-1">
      <p
        v-if="label"
        class="truncate text-xs text-gray-500 dark:text-gray-400"
      >
        {{ label }}
      </p>
      <p class="text-xs text-gray-600 dark:text-gray-300">
        <span v-if="loading">{{ translateText('chat.voiceLoading') }}</span>
        <span v-else>{{ displayCurrent }} / {{ displayDuration }}</span>
      </p>
    </div>
    <audio
      v-if="src"
      ref="audioRef"
      :src="src"
      class="hidden"
      preload="metadata"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @pause="isPlaying = false"
    />
  </div>
</template>
