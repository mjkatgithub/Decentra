<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

const { translateText } = useAppI18n()
const { isLoggedIn } = useMatrixClient()

onMounted(() => {
  if (isLoggedIn.value) {
    navigateTo('/chat')
  } else {
    navigateTo('/login')
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <span class="text-gray-500">{{ translateText('common.loading') }}</span>
  </div>
</template>
