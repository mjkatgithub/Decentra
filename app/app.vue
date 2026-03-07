<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useThemePreference } from '~/composables/useThemePreference'

const MIN_STARTUP_OVERLAY_MS = 700

const { initializeThemePreference } = useThemePreference()
const {
  isSessionRestoreInProgress,
  ensureSessionRestoreCompleted
} = useMatrixClient()
const { translateText } = useAppI18n()
const isBootingApp = ref(true)

const showStartupOverlay = computed(() => {
  return isBootingApp.value || isSessionRestoreInProgress.value
})

function waitMilliseconds(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(), durationMs)
  })
}

onMounted(async () => {
  const bootStartTimestamp = Date.now()
  initializeThemePreference()
  if (typeof ensureSessionRestoreCompleted === 'function') {
    await ensureSessionRestoreCompleted()
  }
  const bootElapsedMs = Date.now() - bootStartTimestamp
  await waitMilliseconds(MIN_STARTUP_OVERLAY_MS - bootElapsedMs)
  isBootingApp.value = false
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <div
      v-if="showStartupOverlay"
      class="fixed inset-0 z-100 flex items-center justify-center bg-black/60"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <UCard class="w-full max-w-xs text-center">
        <div class="flex flex-col items-center gap-3 py-2">
          <UIcon
            name="i-lucide-loader-circle"
            class="h-6 w-6 animate-spin text-primary"
          />
          <p class="text-sm text-gray-700 dark:text-gray-200">
            {{ translateText('common.loading') }}
          </p>
        </div>
      </UCard>
    </div>
  </UApp>
</template>
