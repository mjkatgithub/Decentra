<script setup lang="ts">
const message = ref('')
const loading = ref(false)

const props = defineProps<{
  roomId: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [body: string]
}>()

const { sendMessage } = useMatrixClient()

async function handleSend() {
  const body = message.value.trim()
  if (!body || !props.roomId || props.disabled) return

  loading.value = true
  try {
    await sendMessage(props.roomId, body)
    message.value = ''
    emit('send', body)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="border-t border-gray-200 p-4 dark:border-gray-700">
    <form class="flex gap-2" @submit.prevent="handleSend">
      <UInput
        v-model="message"
        placeholder="Nachricht eingeben..."
        class="flex-1"
        :disabled="disabled || !roomId"
        @keydown.enter.exact.prevent="handleSend"
      />
      <UButton
        type="submit"
        :loading="loading"
        :disabled="!message.trim() || !roomId || disabled"
      >
        Senden
      </UButton>
    </form>
  </div>
</template>
