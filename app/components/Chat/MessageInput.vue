<script setup lang="ts">
import { ref } from 'vue'
import { useAppI18n } from '~/composables/useAppI18n'

const message = ref('')
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const props = defineProps<{
  roomId: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [body: string]
}>()

const { sendMessage, sendImageMessage } = useMatrixClient()
const { translateText } = useAppI18n()

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

function openFilePicker() {
  if (!props.roomId || props.disabled || loading.value) return
  fileInput.value?.click()
}

async function handleImageSend(imageFile: File | Blob, fileName: string) {
  if (!props.roomId || props.disabled || loading.value) return
  loading.value = true
  try {
    await sendImageMessage(props.roomId, imageFile, fileName)
  } finally {
    loading.value = false
  }
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const selectedFile = target.files?.[0]
  if (!selectedFile) return
  await handleImageSend(selectedFile, selectedFile.name || 'image')
  target.value = ''
}

async function onPaste(event: ClipboardEvent) {
  if (!props.roomId || props.disabled || loading.value) return
  const clipboardItems = event.clipboardData?.items
  if (!clipboardItems) return
  for (const clipboardItem of clipboardItems) {
    if (!clipboardItem.type.startsWith('image/')) {
      continue
    }
    const imageFile = clipboardItem.getAsFile()
    if (!imageFile) {
      continue
    }
    event.preventDefault()
    await handleImageSend(imageFile, imageFile.name || 'pasted-image')
    return
  }
}
</script>

<template>
  <div class="border-t border-gray-200 p-4 dark:border-gray-700">
    <form class="flex gap-2" @submit.prevent="handleSend">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        :disabled="disabled || !roomId || loading"
        @change="onFileChange"
      >
      <UButton
        type="button"
        icon="i-lucide-image-up"
        color="neutral"
        variant="soft"
        :disabled="disabled || !roomId || loading"
        :aria-label="translateText('chat.sendImage')"
        @click="openFilePicker"
      />
      <UInput
        v-model="message"
        :placeholder="translateText('chat.messagePlaceholder')"
        class="flex-1"
        :disabled="disabled || !roomId || loading"
        @keydown.enter.exact.prevent="handleSend"
        @paste="onPaste"
      />
      <UButton
        type="submit"
        :loading="loading"
        :disabled="!message.trim() || !roomId || disabled"
      >
        {{ translateText('chat.sendMessage') }}
      </UButton>
    </form>
  </div>
</template>
