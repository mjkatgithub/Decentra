<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

const { translateText } = useAppI18n()
const {
  isLoggedIn,
  isSessionRestoreFinished
} = useMatrixClient()

watchEffect(() => {
  if (!isSessionRestoreFinished.value) {
    return
  }
  if (isLoggedIn.value) {
    void navigateTo('/chat')
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <span
      v-if="!isSessionRestoreFinished"
      class="text-gray-500"
    >
      {{ translateText('common.loading') }}
    </span>
    <UCard v-else class="w-full max-w-sm">
      <div class="space-y-4 text-center">
        <p class="text-sm text-gray-600 dark:text-gray-300">
          Decentra
        </p>
        <UButton to="/login" block>
          {{ translateText('auth.signIn') }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>
