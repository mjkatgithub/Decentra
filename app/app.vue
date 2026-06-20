<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useThemePreference } from '~/composables/useThemePreference'

const { initializeThemePreference } = useThemePreference()
const { isSessionRestoreInProgress } = useMatrixClient()
const { translateText } = useAppI18n()

onMounted(() => {
  initializeThemePreference()
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <div
      v-if="isSessionRestoreInProgress"
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
            {{ translateText('auth.restoringSession') }}
          </p>
        </div>
      </UCard>
    </div>
  </UApp>
</template>
