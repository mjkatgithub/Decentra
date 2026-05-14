<script setup lang="ts">
import { ref } from 'vue'
import { useAppI18n } from '~/composables/useAppI18n'

const message = ref('')
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

interface ReplyTarget {
  eventId: string
  senderName: string
  body: string
}

const props = defineProps<{
  roomId: string | null
  disabled?: boolean
  replyTo?: ReplyTarget | null
  /** MSC3440 thread root; when set, sends as thread reply */
  threadRootEventId?: string | null
}>()

const emit = defineEmits<{
  send: [body: string]
  cancelReply: []
}>()

const { sendMessage, sendImageMessage } = useMatrixClient()
const { translateText } = useAppI18n()

async function handleSend() {
  const body = message.value.trim()
  if (!body || !props.roomId || props.disabled) return

  loading.value = true
  try {
    const threadRoot = props.threadRootEventId
    if (threadRoot) {
      await sendMessage(props.roomId, body, {
        threadRootEventId: threadRoot,
        replyTo: props.replyTo?.eventId
          ? { eventId: props.replyTo.eventId }
          : undefined,
      })
    } else if (props.replyTo?.eventId) {
      await sendMessage(props.roomId, body, { eventId: props.replyTo.eventId })
    } else {
      await sendMessage(props.roomId, body)
    }
    message.value = ''
    emit('send', body)
    if (props.replyTo) {
      emit('cancelReply')
    }
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
    <div
      v-if="replyTo"
      class="mb-3 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs font-medium text-gray-600 dark:text-gray-300">
            {{ translateText('chat.replyingTo') }} {{ replyTo.senderName }}
          </p>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ replyTo.body }}
          </p>
        </div>
        <UButton
          type="button"
          size="xs"
          color="neutral"
          variant="ghost"
          :disabled="loading"
          @click="emit('cancelReply')"
        >
          {{ translateText('chat.cancelReply') }}
        </UButton>
      </div>
    </div>
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
