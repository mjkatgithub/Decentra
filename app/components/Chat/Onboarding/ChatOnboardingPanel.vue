<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

const { translateText } = useAppI18n()

withDefaults(
  defineProps<{
    /** Show “Get started” title and subtitle (first-time empty home). */
    showHeader?: boolean
  }>(),
  { showHeader: true },
)

const emit = defineEmits<{
  'open-dm': []
  'open-create-room': []
  'open-public-rooms': []
}>()
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <div v-if="showHeader">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-50">
        {{ translateText('onboarding.title') }}
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ translateText('onboarding.subtitle') }}
      </p>
    </div>
    <div class="flex flex-col gap-2">
      <UButton color="primary" block @click="emit('open-dm')">
        {{ translateText('onboarding.startDm') }}
      </UButton>
      <UButton color="neutral" variant="soft" block @click="emit('open-create-room')">
        {{ translateText('onboarding.createRoom') }}
      </UButton>
      <UButton color="neutral" variant="soft" block @click="emit('open-public-rooms')">
        {{ translateText('onboarding.explorePublic') }}
      </UButton>
    </div>
  </div>
</template>
