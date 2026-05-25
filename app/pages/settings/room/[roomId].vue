<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useRoomSettings } from '~/composables/useRoomSettings'

const route = useRoute()
const { translateText } = useAppI18n()

const roomId = computed(() => String(route.params.roomId || ''))

const {
  displayName,
  displayTopic,
  editableName,
  editableTopic,
  isEditing,
  permissions,
  canEdit,
  feedbackMessage,
  feedbackTone,
  isSaving,
  startEdit,
  cancelEdit,
  saveProfile,
} = useRoomSettings(roomId)

const feedbackTitle = computed(() => {
  if (!feedbackMessage.value) {
    return ''
  }
  if (feedbackMessage.value === 'saved') {
    return translateText('settings.saved')
  }
  return feedbackMessage.value
})

const backToChatLocation = computed(() => {
  const rawRoot = route.query.root
  const root = Array.isArray(rawRoot) ? rawRoot[0] : rawRoot
  const query: Record<string, string> = { room: roomId.value }
  if (typeof root === 'string' && root.length > 0) {
    query.root = root
  }
  return { path: '/chat', query }
})
</script>

<template>
  <div class="mx-auto min-h-screen w-full max-w-2xl p-4">
    <UCard>
      <template #header>
        <h1 class="text-xl font-semibold">
          {{ translateText('settings.roomTitle') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ translateText('settings.roomDescription') }}
        </p>
      </template>

      <UAlert
        v-if="feedbackTitle"
        class="mb-4"
        :color="feedbackTone === 'success' ? 'success' : 'error'"
        :title="feedbackTitle"
      />

      <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
        {{ translateText('settings.roomId') }}: {{ roomId }}
      </p>

      <div
        v-if="!isEditing"
        class="flex flex-wrap items-center justify-between gap-4 rounded-lg
               border border-gray-200 p-4 dark:border-gray-800"
      >
        <div class="min-w-0">
          <p class="truncate font-medium">
            {{ displayName || '—' }}
          </p>
          <p class="truncate text-sm text-gray-500 dark:text-gray-400">
            {{ displayTopic || '—' }}
          </p>
        </div>
        <UButton
          v-if="canEdit"
          size="sm"
          variant="soft"
          @click="startEdit"
        >
          {{ translateText('settings.spaceGeneralProfileEdit') }}
        </UButton>
      </div>

      <div
        v-else
        class="space-y-4 rounded-lg border border-gray-200 p-4
               dark:border-gray-800"
      >
        <UFormField :label="translateText('settings.roomName')">
          <UInput
            v-model="editableName"
            :disabled="!permissions.name || isSaving"
          />
        </UFormField>
        <UFormField :label="translateText('settings.roomTopic')">
          <UTextarea
            v-model="editableTopic"
            :rows="3"
            :disabled="!permissions.topic || isSaving"
          />
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="primary"
            :loading="isSaving"
            :disabled="!canEdit"
            @click="saveProfile"
          >
            {{ translateText('settings.save') }}
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            :disabled="isSaving"
            @click="cancelEdit"
          >
            {{ translateText('settings.cancel') }}
          </UButton>
        </div>
      </div>

      <p
        v-if="!canEdit && !isEditing"
        class="mt-4 text-sm text-gray-500 dark:text-gray-400"
      >
        {{ translateText('settings.roomReadOnlyHint') }}
      </p>

      <template #footer>
        <UButton color="neutral" variant="soft" :to="backToChatLocation">
          {{ translateText('settings.backToChat') }}
        </UButton>
      </template>
    </UCard>
  </div>
</template>
