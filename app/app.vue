<script setup lang="ts">
import { useThemePreference } from '~/composables/useThemePreference'

const { initializeThemePreference } = useThemePreference()

onMounted(() => {
  initializeThemePreference()
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </UApp>
</template>
