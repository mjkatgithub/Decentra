<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import { useAppI18n } from '~/composables/useAppI18n'
import { useChatMedia } from '~/composables/useChatMedia'
import {
  createShortcodeMap,
  emojiCatalog,
  normalizeShortcodes,
  trackEmojiUsage,
  loadFrequentEmojiUsage,
  saveFrequentEmojiUsage,
} from '~/composables/useEmojiPickerData'
import type { ChatTimelineReply } from '~/utils/chatTimeline'
import ReplyQuotePreview from '~/components/Chat/ReplyQuotePreview.vue'
import {
  applyShortcodeCompletion,
  findTrailingShortcodeToken,
  insertTextAtSelection,
  matchShortcodeSuggestions,
  type ShortcodeSuggestion,
} from '~/utils/composerEmoji'
import { createComposerTypingNotifier } from '~/utils/composerTypingNotifier'
import { useVoiceRecorder } from '~/composables/useVoiceRecorder'

const message = ref('')
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const messageInputRef = ref<{ $el: HTMLElement } | null>(null)
const pickerRoot = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)
const suggestions = ref<ShortcodeSuggestion[]>([])
const activeSuggestionIndex = ref(0)

const shortcodeMap = createShortcodeMap(emojiCatalog)
let frequentUsage = loadFrequentEmojiUsage()

interface EditTarget {
  eventId: string
  body: string
}

const props = defineProps<{
  roomId: string | null
  disabled?: boolean
  replyTo?: ChatTimelineReply | null
  editTo?: EditTarget | null
  threadRootEventId?: string | null
  frequentScopeKey?: string
}>()

const emit = defineEmits<{
  send: [body: string]
  cancelReply: []
  cancelEdit: []
}>()

const {
  client,
  sendMessage,
  sendEditMessage,
  sendImageMessage,
  sendAudioMessage,
  sendRoomTyping,
} = useMatrixClient()

const voiceRecorder = useVoiceRecorder()

const typingNotifier = createComposerTypingNotifier({
  getRoomId: () => props.roomId,
  sendTyping: sendRoomTyping,
  isEnabled: () => Boolean(
    props.roomId && !props.disabled && client?.value,
  ),
})
const { translateText } = useAppI18n()
const { resolveMediaBlobUrl } = useChatMedia(client)
const composerReplyDisplayUrl = ref<string | undefined>()
const composerReplyMediaLoading = ref(false)

function replyMediaNeedsBlob(media: NonNullable<ChatTimelineReply['media']>) {
  return (
    !media.url ||
    media.isEncrypted === true ||
    media.mimetype === 'image/svg+xml' ||
    media.mimetype === 'image/gif'
  )
}

watch(
  () => props.replyTo,
  async (replyTarget) => {
    composerReplyDisplayUrl.value = undefined
    const media = replyTarget?.media
    if (!media) {
      return
    }
    if (media.url && !replyMediaNeedsBlob(media)) {
      composerReplyDisplayUrl.value = media.url
      return
    }
    if (!resolveMediaBlobUrl || !replyMediaNeedsBlob(media)) {
      return
    }
    composerReplyMediaLoading.value = true
    try {
      composerReplyDisplayUrl.value = await resolveMediaBlobUrl({
        mxcUrl: media.mxcUrl,
        mimetype: media.mimetype,
        isEncrypted: media.isEncrypted,
        encryptionInfo: media.encryptionInfo,
      })
    } catch (thrownError) {
      console.error('Failed to resolve composer reply media', thrownError)
    } finally {
      composerReplyMediaLoading.value = false
    }
  },
  { immediate: true },
)

const autocompleteOpen = computed(() => suggestions.value.length > 0)

const voiceComposerActive = computed(() => {
  return voiceRecorder.phase.value !== 'idle' &&
    voiceRecorder.phase.value !== 'error'
})

const composerHasText = computed(() => message.value.trim().length > 0)

const showVoiceAction = computed(() => {
  return (
    !composerHasText.value &&
    !props.editTo &&
    !voiceComposerActive.value
  )
})

const showSendAction = computed(() => {
  return composerHasText.value && !voiceComposerActive.value
})

const composerInlineIconButtonClass =
  'inline-flex shrink-0 items-center justify-center rounded-md ' +
  'border-0 bg-transparent p-1.5 shadow-none text-dimmed ' +
  'hover:bg-transparent hover:text-default ' +
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-primary/40 disabled:cursor-not-allowed ' +
  'disabled:opacity-50'

const composerActionButtonClass =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-md ' +
  'border-0 bg-transparent text-dimmed transition ' +
  'hover:bg-gray-100 hover:text-default dark:hover:bg-gray-800 ' +
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-primary/40 disabled:cursor-not-allowed ' +
  'disabled:opacity-50'

const voiceErrorMessage = computed(() => {
  const voiceError = voiceRecorder.error.value
  if (!voiceError) {
    return ''
  }
  switch (voiceError.code) {
    case 'permissionDenied':
      return translateText('chat.microphonePermissionDenied')
    case 'recordingFailed':
      return translateText('chat.recordingFailed')
    case 'uploadFailed':
      return translateText('chat.voiceUploadFailed')
    case 'unsupported':
      return translateText('chat.voiceRecordingUnsupported')
    default:
      return translateText('chat.recordingFailed')
  }
})

function formatVoiceElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function buildVoiceSendOptions(durationMs?: number) {
  const options: {
    durationMs?: number
    replyTo?: { eventId: string }
    threadRootEventId?: string
  } = { durationMs }
  if (props.threadRootEventId) {
    options.threadRootEventId = props.threadRootEventId
    if (props.replyTo?.eventId) {
      options.replyTo = { eventId: props.replyTo.eventId }
    }
  } else if (props.replyTo?.eventId) {
    options.replyTo = { eventId: props.replyTo.eventId }
  }
  return options
}

watch(
  () => props.editTo,
  (editTarget) => {
    if (editTarget) {
      message.value = editTarget.body
    }
  },
  { immediate: true },
)

watch(
  () => props.frequentScopeKey,
  (scopeKey) => {
    frequentUsage = loadFrequentEmojiUsage(scopeKey)
  },
  { immediate: true },
)

function getNativeMessageInput(): HTMLInputElement | null {
  const rootElement = messageInputRef.value?.$el
  if (!rootElement) {
    return null
  }
  return rootElement.querySelector('input')
}

function setInputSelection(cursor: number) {
  const input = getNativeMessageInput()
  if (!input) {
    return
  }
  input.selectionStart = cursor
  input.selectionEnd = cursor
  input.focus()
}

function insertEmojiAtCursor(emoji: string) {
  const input = getNativeMessageInput()
  const start = input?.selectionStart ?? message.value.length
  const end = input?.selectionEnd ?? start
  const { nextText, selectionStart } = insertTextAtSelection(
    message.value,
    start,
    end,
    emoji,
  )
  message.value = nextText
  clearAutocomplete()
  nextTick(() => setInputSelection(selectionStart))
  if (nextText.trim()) {
    typingNotifier.notifyInput()
  }
}

function onPickerSelect(emoji: string) {
  frequentUsage = trackEmojiUsage(frequentUsage, emoji)
  saveFrequentEmojiUsage(frequentUsage, props.frequentScopeKey)
  insertEmojiAtCursor(emoji)
  pickerOpen.value = false
}

function togglePicker(event?: Event) {
  event?.stopPropagation?.()
  if (props.disabled || !props.roomId || loading.value) {
    return
  }
  pickerOpen.value = !pickerOpen.value
  if (pickerOpen.value) {
    clearAutocomplete()
  }
}

function clearAutocomplete() {
  suggestions.value = []
  activeSuggestionIndex.value = 0
}

function refreshAutocomplete() {
  const input = getNativeMessageInput()
  const cursor = input?.selectionStart ?? message.value.length
  const token = findTrailingShortcodeToken(message.value, cursor)
  if (!token) {
    clearAutocomplete()
    return
  }
  suggestions.value = matchShortcodeSuggestions(token.prefix, emojiCatalog)
  activeSuggestionIndex.value = 0
}

function applyActiveSuggestion() {
  const input = getNativeMessageInput()
  const cursor = input?.selectionStart ?? message.value.length
  const token = findTrailingShortcodeToken(message.value, cursor)
  const activeSuggestion = suggestions.value[activeSuggestionIndex.value]
  if (!token || !activeSuggestion) {
    return
  }
  const { nextText, selectionStart } = applyShortcodeCompletion(
    message.value,
    token,
    activeSuggestion.emoji,
  )
  message.value = nextText
  clearAutocomplete()
  nextTick(() => setInputSelection(selectionStart))
  if (nextText.trim()) {
    typingNotifier.notifyInput()
  }
}

function onMessageInput() {
  refreshAutocomplete()
  if (message.value.trim()) {
    typingNotifier.notifyInput()
  } else {
    typingNotifier.notifyStopped()
  }
}

function onMessageKeydown(event: KeyboardEvent) {
  if (autocompleteOpen.value) {
    if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault()
      applyActiveSuggestion()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      clearAutocomplete()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const lastIndex = suggestions.value.length - 1
      activeSuggestionIndex.value = Math.min(
        activeSuggestionIndex.value + 1,
        lastIndex,
      )
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      activeSuggestionIndex.value = Math.max(
        activeSuggestionIndex.value - 1,
        0,
      )
      return
    }
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void handleSend()
  }
}

function onDocumentClick(clickEvent: MouseEvent) {
  if (!pickerOpen.value || !pickerRoot.value) {
    return
  }
  const clickTarget = clickEvent.target
  if (!(clickTarget instanceof Node)) {
    return
  }
  if (!pickerRoot.value.contains(clickTarget)) {
    pickerOpen.value = false
  }
}

if (import.meta.client) {
  document.addEventListener('click', onDocumentClick)
}

onBeforeUnmount(() => {
  typingNotifier.notifyStopped()
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('click', onDocumentClick)
})

watch(
  () => props.roomId,
  (_nextRoomId, previousRoomId) => {
    if (previousRoomId) {
      typingNotifier.notifyStopped()
    }
  },
)

watch(
  () => props.disabled,
  (isDisabled) => {
    if (isDisabled) {
      typingNotifier.notifyStopped()
    }
  },
)

async function handleSend() {
  const body = normalizeShortcodes(
    message.value.trim(),
    shortcodeMap,
  )
  if (!body || !props.roomId || props.disabled) {
    return
  }

  typingNotifier.notifyStopped()
  loading.value = true
  clearAutocomplete()
  pickerOpen.value = false
  try {
    if (props.editTo?.eventId) {
      await sendEditMessage(props.roomId, body, props.editTo.eventId)
      message.value = ''
      emit('send', body)
      emit('cancelEdit')
      return
    }

    const threadRoot = props.threadRootEventId
    if (threadRoot) {
      await sendMessage(props.roomId, body, {
        threadRootEventId: threadRoot,
        replyTo: props.replyTo?.eventId
          ? { eventId: props.replyTo.eventId }
          : undefined,
      })
    } else if (props.replyTo?.eventId) {
      await sendMessage(props.roomId, body, {
        eventId: props.replyTo.eventId,
      })
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
  if (!props.roomId || props.disabled || loading.value || props.editTo) {
    return
  }
  fileInput.value?.click()
}

async function handleImageSend(imageFile: File | Blob, fileName: string) {
  if (!props.roomId || props.disabled || loading.value) {
    return
  }
  loading.value = true
  try {
    await sendImageMessage(props.roomId, imageFile, fileName)
  } finally {
    loading.value = false
  }
}

async function handleVoiceSend() {
  if (!props.roomId || props.disabled || loading.value) {
    return
  }
  const recordedBlob = voiceRecorder.previewBlob.value
  if (!recordedBlob) {
    return
  }
  typingNotifier.notifyStopped()
  voiceRecorder.markSending()
  loading.value = true
  try {
    await sendAudioMessage(
      props.roomId,
      recordedBlob,
      voiceRecorder.getPreviewFileName(),
      buildVoiceSendOptions(voiceRecorder.previewDurationMs.value),
    )
    voiceRecorder.finishSending()
    emit('send', '')
    if (props.replyTo) {
      emit('cancelReply')
    }
  } catch (thrownError) {
    console.error('Failed to send voice message', thrownError)
    voiceRecorder.markUploadFailed()
  } finally {
    loading.value = false
  }
}

async function startVoiceRecording() {
  if (!props.roomId || props.disabled || loading.value || props.editTo) {
    return
  }
  typingNotifier.notifyStopped()
  await voiceRecorder.beginRecording()
}

function cancelVoiceRecording() {
  voiceRecorder.cancelRecording()
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const selectedFile = target.files?.[0]
  if (!selectedFile) {
    return
  }
  await handleImageSend(selectedFile, selectedFile.name || 'image')
  target.value = ''
}

async function onPaste(event: ClipboardEvent) {
  if (!props.roomId || props.disabled || loading.value || props.editTo) {
    return
  }
  const clipboardItems = event.clipboardData?.items
  if (!clipboardItems) {
    return
  }
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
      v-if="editTo"
      class="mb-3 rounded-md border border-gray-200 bg-gray-50 p-2
             dark:border-gray-700 dark:bg-gray-900"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ translateText('chat.editingMessage') }}
        </p>
        <UButton
          type="button"
          size="xs"
          color="neutral"
          variant="ghost"
          :disabled="loading"
          :aria-label="translateText('chat.cancelEdit')"
          @click="emit('cancelEdit')"
        >
          {{ translateText('chat.cancelEdit') }}
        </UButton>
      </div>
    </div>
    <div
      v-else-if="replyTo"
      class="mb-3 rounded-md border border-gray-200 bg-gray-50 p-2
             dark:border-gray-700 dark:bg-gray-900"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <p
            class="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300"
          >
            {{ translateText('chat.replyingTo') }} {{ replyTo.senderName }}
          </p>
          <ReplyQuotePreview
            :reply-to="replyTo"
            :display-url="composerReplyDisplayUrl"
            :loading="composerReplyMediaLoading"
            :clickable="false"
          />
        </div>
        <UButton
          type="button"
          size="xs"
          color="neutral"
          variant="ghost"
          :disabled="loading"
          :aria-label="translateText('chat.cancelReply')"
          @click="emit('cancelReply')"
        >
          {{ translateText('chat.cancelReply') }}
        </UButton>
      </div>
    </div>
    <div
      v-if="voiceErrorMessage"
      class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2
             text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40
             dark:text-red-200"
      data-testid="voice-recorder-error"
    >
      {{ voiceErrorMessage }}
      <UButton
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        class="ml-2"
        @click="voiceRecorder.cancelRecording()"
      >
        {{ translateText('chat.dismissVoiceError') }}
      </UButton>
    </div>
    <div
      v-if="voiceRecorder.isRecordingActive.value"
      class="mb-3 flex flex-wrap items-center gap-2 rounded-md border
             border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700
             dark:bg-gray-900"
      data-testid="voice-recording-bar"
    >
      <span class="text-xs font-medium text-red-600 dark:text-red-400">
        {{ translateText('chat.recording') }}
        {{ formatVoiceElapsed(voiceRecorder.elapsedMs.value) }}
      </span>
      <UButton
        v-if="voiceRecorder.canPause.value"
        type="button"
        size="xs"
        color="neutral"
        variant="soft"
        data-testid="voice-pause-button"
        @click="voiceRecorder.phase.value === 'paused'
          ? voiceRecorder.resumeRecording()
          : voiceRecorder.pauseRecording()"
      >
        {{
          voiceRecorder.phase.value === 'paused'
            ? translateText('chat.resumeRecording')
            : translateText('chat.pauseRecording')
        }}
      </UButton>
      <UButton
        type="button"
        size="xs"
        color="primary"
        data-testid="voice-stop-button"
        @click="voiceRecorder.stopRecording()"
      >
        {{ translateText('chat.stopRecording') }}
      </UButton>
      <UButton
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        data-testid="voice-cancel-button"
        @click="cancelVoiceRecording()"
      >
        {{ translateText('chat.cancelRecording') }}
      </UButton>
    </div>
    <div
      v-else-if="voiceRecorder.phase.value === 'preview'"
      class="mb-3 space-y-2 rounded-md border border-gray-200 bg-gray-50 px-3
             py-2 dark:border-gray-700 dark:bg-gray-900"
      data-testid="voice-preview-bar"
    >
      <p class="text-xs font-medium text-gray-600 dark:text-gray-300">
        {{ translateText('chat.voicePreview') }}
      </p>
      <audio
        v-if="voiceRecorder.previewUrl.value"
        :src="voiceRecorder.previewUrl.value"
        controls
        class="w-full"
        data-testid="voice-preview-audio"
      />
      <div class="flex flex-wrap gap-2">
        <UButton
          type="button"
          size="xs"
          color="neutral"
          variant="ghost"
          data-testid="voice-discard-button"
          @click="voiceRecorder.discardPreview()"
        >
          {{ translateText('chat.discardVoice') }}
        </UButton>
        <UButton
          type="button"
          size="xs"
          color="primary"
          :loading="loading"
          data-testid="voice-send-button"
          @click="handleVoiceSend()"
        >
          {{ translateText('chat.sendVoice') }}
        </UButton>
      </div>
    </div>
    <form
      ref="pickerRoot"
      class="relative flex gap-2"
      @submit.prevent="handleSend"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        :disabled="disabled || !roomId || loading || Boolean(editTo)"
        @change="onFileChange"
      >
      <UButton
        type="button"
        icon="i-lucide-image-up"
        color="neutral"
        variant="soft"
        :disabled="disabled || !roomId || loading || Boolean(editTo)"
        :aria-label="translateText('chat.sendImage')"
        @click="openFilePicker"
      />
      <div class="relative min-w-0 flex-1">
        <ul
          v-if="autocompleteOpen"
          role="listbox"
          :aria-label="translateText('chat.emojiAutocompleteHint')"
          class="
            absolute bottom-full left-0 z-30 mb-1 max-h-48 w-full
            overflow-y-auto rounded-md border border-gray-200 bg-white py-1
            shadow-lg dark:border-gray-700 dark:bg-gray-900
          "
        >
          <li
            v-for="(suggestion, suggestionIndex) in suggestions"
            :key="`${suggestion.shortcode}-${suggestion.emoji}`"
            role="option"
            :aria-selected="suggestionIndex === activeSuggestionIndex"
          >
            <button
              type="button"
              class="
                flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm
                hover:bg-gray-100 dark:hover:bg-gray-800
              "
              :class="
                suggestionIndex === activeSuggestionIndex
                  ? 'bg-gray-100 dark:bg-gray-800'
                  : ''
              "
              @mousedown.prevent="activeSuggestionIndex = suggestionIndex;
                                  applyActiveSuggestion()"
            >
              <span class="text-lg">{{ suggestion.emoji }}</span>
              <span class="text-gray-600 dark:text-gray-300">
                :{{ suggestion.shortcode }}:
              </span>
            </button>
          </li>
        </ul>
        <UInput
          ref="messageInputRef"
          v-model="message"
          :placeholder="translateText('chat.messagePlaceholder')"
          class="w-full"
          :disabled="disabled || !roomId || loading || voiceComposerActive"
          @input="onMessageInput"
          @keydown="onMessageKeydown"
          @paste="onPaste"
        >
          <template #trailing>
            <button
              type="button"
              :class="composerInlineIconButtonClass"
              :disabled="disabled || !roomId || loading"
              :aria-label="translateText('chat.insertEmoji')"
              :aria-expanded="pickerOpen"
              data-testid="composer-emoji-button"
              @click.stop="togglePicker"
            >
              <UIcon name="i-lucide-smile" class="size-5 shrink-0" />
            </button>
          </template>
        </UInput>
        <div
          v-if="pickerOpen"
          data-testid="composer-emoji-picker"
          class="absolute bottom-full right-0 z-20 mb-1"
          @click.stop
        >
          <ChatReactionEmojiPicker
            :frequent-scope-key="frequentScopeKey"
            @select="onPickerSelect"
          />
        </div>
      </div>
      <button
        v-if="showVoiceAction"
        type="button"
        :class="composerActionButtonClass"
        :disabled="disabled || !roomId || loading"
        :aria-label="translateText('chat.recordVoice')"
        data-testid="composer-voice-button"
        @click="startVoiceRecording()"
      >
        <UIcon name="i-lucide-mic" class="size-5 shrink-0" />
      </button>
      <button
        v-else-if="showSendAction"
        type="submit"
        :class="[
          composerActionButtonClass,
          'text-primary-500 hover:text-primary-600 dark:text-primary-400',
        ]"
        :disabled="!roomId || disabled || loading"
        :aria-label="translateText('chat.sendMessage')"
        data-testid="composer-send-button"
      >
        <UIcon
          name="i-lucide-send"
          class="size-5 shrink-0"
          :class="loading ? 'opacity-50' : ''"
        />
      </button>
    </form>
  </div>
</template>
