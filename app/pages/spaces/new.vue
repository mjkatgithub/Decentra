<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'

const { translateText } = useAppI18n()
const { createMatrixSpace } = useMatrixClient()

const spaceName = ref('')
const topic = ref('')
const visibility = ref<'private' | 'public'>('private')
const submitting = ref(false)
const errorMessage = ref('')

async function handleCreate() {
  errorMessage.value = ''
  submitting.value = true
  try {
    const spaceId = await createMatrixSpace({
      name: spaceName.value,
      topic: topic.value,
      visibility: visibility.value,
    })
    await navigateTo({ path: '/chat', query: { space: spaceId } })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : String(error)
  } finally {
    submitting.value = false
  }
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

      <div class="space-y-4">
        <UFormField :label="translateText('spaces.name')">
          <UInput v-model="spaceName" />
        </UFormField>
        <UFormField :label="translateText('rooms.createTopic')">
          <UInput v-model="topic" />
        </UFormField>
        <UFormField :label="translateText('rooms.createVisibility')">
          <div class="flex flex-col gap-2 sm:flex-row">
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="visibility"
                type="radio"
                value="private"
                class="accent-primary"
              >
              {{ translateText('rooms.visibilityPrivate') }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="visibility"
                type="radio"
                value="public"
                class="accent-primary"
              >
              {{ translateText('rooms.visibilityPublic') }}
            </label>
          </div>
        </UFormField>
        <UAlert
          v-if="errorMessage"
          color="error"
          :title="errorMessage"
        />
      </div>

      <template #footer>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="primary"
            :loading="submitting"
            :disabled="!spaceName.trim()"
            @click="handleCreate"
          >
            {{ translateText('spaces.createSubmit') }}
          </UButton>
          <UButton color="neutral" variant="soft" to="/chat">
            {{ translateText('settings.backToChat') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
