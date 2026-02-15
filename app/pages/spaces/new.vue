<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

const { isLoggedIn } = useMatrixClient()
const { translateText } = useAppI18n()
const spaceName = ref('')
const infoMessage = ref('')

if (!isLoggedIn.value) {
  navigateTo('/login')
}

function handleCreateStub() {
  infoMessage.value = translateText('spaces.stubInfo')
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-2xl items-start p-4">
    <UCard class="w-full">
      <template #header>
        <h1 class="text-xl font-semibold">
          {{ translateText('spaces.newTitle') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ translateText('spaces.newDescription') }}
        </p>
      </template>

      <div class="space-y-3">
        <UFormField :label="translateText('spaces.name')">
          <UInput v-model="spaceName" />
        </UFormField>
        <UAlert v-if="infoMessage" color="info" :title="infoMessage" />
      </div>

      <template #footer>
        <div class="flex flex-wrap gap-2">
          <UButton color="primary" @click="handleCreateStub">
            {{ translateText('spaces.createStub') }}
          </UButton>
          <UButton color="neutral" variant="soft" to="/chat">
            {{ translateText('settings.backToChat') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
