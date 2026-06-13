<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'

const props = defineProps<{
  targetRoomId: string
  targetLabel: string
}>()

const emit = defineEmits<{
  close: []
  confirming: [roomId: string]
  left: [roomId: string]
}>()

const { translateText } = useAppI18n()
const { leaveRoom } = useMatrixClient()

const submitting = ref(false)
const errorMessage = ref('')

async function handleConfirm() {
  submitting.value = true
  errorMessage.value = ''
  emit('confirming', props.targetRoomId)
  try {
    await leaveRoom(props.targetRoomId)
    emit('left', props.targetRoomId)
  } catch (thrownError) {
    errorMessage.value =
      thrownError instanceof Error
        ? thrownError.message
        : translateText('layout.leaveRoomFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-xl border
           border-gray-200 bg-white p-5 shadow-lg dark:border-gray-800
           dark:bg-gray-900"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {{ translateText('layout.leaveRoomConfirmTitle') }}
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {{
            translateText('layout.leaveRoomConfirmBody', {
              name: targetLabel,
            })
          }}
        </p>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="translateText('layout.leaveRoomCancel')"
        @click="emit('close')"
      />
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :title="errorMessage"
    />

    <div class="flex flex-wrap justify-end gap-2">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        :disabled="submitting"
        @click="emit('close')"
      >
        {{ translateText('layout.leaveRoomCancel') }}
      </UButton>
      <UButton
        type="button"
        color="error"
        variant="soft"
        icon="i-lucide-log-out"
        :loading="submitting"
        @click="handleConfirm"
      >
        {{ translateText('layout.leaveRoomConfirmAction') }}
      </UButton>
    </div>
  </div>
</template>
