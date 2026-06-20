import { ref, type ComputedRef, type Ref } from 'vue'
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  validateAudioFile,
  validateVideoFile,
  type AudioValidationErrorCode,
  type VideoValidationErrorCode,
} from '~/utils/mediaUploadValidation'
import type {
  SendAudioMessageOptions,
  SendImageMessageOptions,
  SendTextMessageOptions,
  SendVideoMessageOptions,
} from '~/composables/matrix/matrixClientTypes'

type MediaKind = 'image' | 'video' | 'audio'

type UploadErrorCode =
  | VideoValidationErrorCode
  | AudioValidationErrorCode
  | 'uploadFailed'

interface ComposerMediaUploadOptions {
  roomId: ComputedRef<string | null> | Ref<string | null>
  disabled: ComputedRef<boolean | undefined> | Ref<boolean | undefined>
  loading: Ref<boolean>
  hasEditTarget: ComputedRef<boolean> | Ref<boolean>
  hasReplyTarget: ComputedRef<boolean> | Ref<boolean>
  buildMessageRelationOptions: (
    durationMs?: number,
  ) => SendTextMessageOptions
  translateText: (key: string, placeholders?: Record<string, string>) => string
  sendImageMessage: (
    roomId: string,
    imageFile: File | Blob,
    fileName: string,
    options?: SendImageMessageOptions,
  ) => Promise<void>
  sendVideoMessage: (
    roomId: string,
    videoFile: File | Blob,
    fileName: string,
    options?: SendVideoMessageOptions,
  ) => Promise<void>
  sendAudioMessage: (
    roomId: string,
    audioFile: File | Blob,
    fileName: string,
    options?: SendAudioMessageOptions,
  ) => Promise<void>
  onCancelReply: () => void
}

export function useComposerMediaUpload(options: ComposerMediaUploadOptions) {
  const fileInput = ref<HTMLInputElement | null>(null)
  const videoFileInput = ref<HTMLInputElement | null>(null)
  const audioFileInput = ref<HTMLInputElement | null>(null)
  const uploadError = ref<UploadErrorCode | null>(null)
  const uploadingMediaKind = ref<MediaKind | null>(null)
  const uploadErrorMediaKind = ref<MediaKind | null>(null)
  const isMediaDragOver = ref(false)

  const maxVideoUploadMb = Math.round(MAX_VIDEO_UPLOAD_BYTES / (1024 * 1024))
  const maxAudioUploadMb = Math.round(MAX_AUDIO_UPLOAD_BYTES / (1024 * 1024))

  function isBlocked(): boolean {
    return (
      !options.roomId.value ||
      Boolean(options.disabled.value) ||
      options.loading.value ||
      Boolean(options.hasEditTarget.value)
    )
  }

  function clearUploadError() {
    uploadError.value = null
    uploadErrorMediaKind.value = null
  }

  function setUploadError(code: UploadErrorCode, mediaKind?: MediaKind) {
    uploadError.value = code
    uploadErrorMediaKind.value = mediaKind ?? null
  }

  function uploadErrorMessage(): string {
    const mediaKind = uploadErrorMediaKind.value
    if (uploadError.value === 'invalidType') {
      if (mediaKind === 'audio') {
        return options.translateText('chat.audioInvalidType')
      }
      return options.translateText('chat.videoInvalidType')
    }
    if (uploadError.value === 'tooLarge') {
      if (mediaKind === 'audio') {
        return options.translateText('chat.audioTooLarge', {
          maxMb: String(maxAudioUploadMb),
        })
      }
      return options.translateText('chat.videoTooLarge', {
        maxMb: String(maxVideoUploadMb),
      })
    }
    if (uploadError.value === 'uploadFailed') {
      if (mediaKind === 'image') {
        return options.translateText('chat.imageUploadFailed')
      }
      if (mediaKind === 'audio') {
        return options.translateText('chat.audioUploadFailed')
      }
      return options.translateText('chat.videoUploadFailed')
    }
    return ''
  }

  function openFilePicker() {
    if (isBlocked()) {
      return
    }
    clearUploadError()
    fileInput.value?.click()
  }

  function openVideoFilePicker() {
    if (isBlocked()) {
      return
    }
    clearUploadError()
    videoFileInput.value?.click()
  }

  function openAudioFilePicker() {
    if (isBlocked()) {
      return
    }
    clearUploadError()
    audioFileInput.value?.click()
  }

  async function handleImageSend(imageFile: File | Blob, fileName: string) {
    const roomId = options.roomId.value
    if (!roomId || isBlocked()) {
      return
    }
    clearUploadError()
    uploadingMediaKind.value = 'image'
    options.loading.value = true
    try {
      await options.sendImageMessage(
        roomId,
        imageFile,
        fileName,
        options.buildMessageRelationOptions(),
      )
      if (options.hasReplyTarget.value) {
        options.onCancelReply()
      }
    } catch (thrownError) {
      console.error('Failed to send image message', thrownError)
      setUploadError('uploadFailed', 'image')
    } finally {
      uploadingMediaKind.value = null
      options.loading.value = false
    }
  }

  async function handleVideoSend(videoFile: File | Blob, fileName: string) {
    const roomId = options.roomId.value
    if (!roomId || isBlocked()) {
      return
    }
    const validation = validateVideoFile(
      videoFile,
      videoFile instanceof File ? videoFile.name : fileName,
    )
    if (!validation.ok) {
      setUploadError(validation.code, 'video')
      return
    }
    clearUploadError()
    uploadingMediaKind.value = 'video'
    options.loading.value = true
    try {
      await options.sendVideoMessage(
        roomId,
        videoFile,
        fileName,
        options.buildMessageRelationOptions(),
      )
      if (options.hasReplyTarget.value) {
        options.onCancelReply()
      }
    } catch (thrownError) {
      console.error('Failed to send video message', thrownError)
      setUploadError('uploadFailed', 'video')
    } finally {
      uploadingMediaKind.value = null
      options.loading.value = false
    }
  }

  async function handleAudioSend(audioFile: File | Blob, fileName: string) {
    const roomId = options.roomId.value
    if (!roomId || isBlocked()) {
      return
    }
    const validation = validateAudioFile(
      audioFile,
      audioFile instanceof File ? audioFile.name : fileName,
    )
    if (!validation.ok) {
      setUploadError(validation.code, 'audio')
      return
    }
    clearUploadError()
    uploadingMediaKind.value = 'audio'
    options.loading.value = true
    try {
      await options.sendAudioMessage(
        roomId,
        audioFile,
        fileName,
        {
          ...options.buildMessageRelationOptions(),
          isVoiceMessage: false,
        },
      )
      if (options.hasReplyTarget.value) {
        options.onCancelReply()
      }
    } catch (thrownError) {
      console.error('Failed to send audio message', thrownError)
      setUploadError('uploadFailed', 'audio')
    } finally {
      uploadingMediaKind.value = null
      options.loading.value = false
    }
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

  async function onVideoFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const selectedFile = target.files?.[0]
    if (!selectedFile) {
      return
    }
    await handleVideoSend(selectedFile, selectedFile.name || 'video')
    target.value = ''
  }

  async function onAudioFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const selectedFile = target.files?.[0]
    if (!selectedFile) {
      return
    }
    await handleAudioSend(selectedFile, selectedFile.name || 'audio')
    target.value = ''
  }

  function readDroppedFile(
    dataTransfer: DataTransfer | null,
  ): File | undefined {
    const droppedFile = dataTransfer?.files?.[0]
    return droppedFile ?? undefined
  }

  async function onComposerDrop(event: DragEvent) {
    isMediaDragOver.value = false
    if (isBlocked()) {
      return
    }
    const droppedFile = readDroppedFile(event.dataTransfer)
    if (!droppedFile) {
      return
    }
    event.preventDefault()
    if (droppedFile.type.startsWith('video/')) {
      await handleVideoSend(droppedFile, droppedFile.name || 'video')
      return
    }
    if (droppedFile.type.startsWith('image/')) {
      await handleImageSend(droppedFile, droppedFile.name || 'image')
    }
  }

  function onComposerDragOver(event: DragEvent) {
    if (isBlocked()) {
      return
    }
    const draggedFile = readDroppedFile(event.dataTransfer)
    if (
      !draggedFile ||
      (
        !draggedFile.type.startsWith('video/') &&
        !draggedFile.type.startsWith('image/')
      )
    ) {
      return
    }
    event.preventDefault()
    isMediaDragOver.value = true
  }

  function onComposerDragLeave() {
    isMediaDragOver.value = false
  }

  async function onPaste(event: ClipboardEvent) {
    if (isBlocked()) {
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

  return {
    fileInput,
    videoFileInput,
    audioFileInput,
    uploadError,
    uploadingMediaKind,
    uploadErrorMediaKind,
    isMediaDragOver,
    clearUploadError,
    uploadErrorMessage,
    openFilePicker,
    openVideoFilePicker,
    openAudioFilePicker,
    onFileChange,
    onVideoFileChange,
    onAudioFileChange,
    onComposerDrop,
    onComposerDragOver,
    onComposerDragLeave,
    onPaste,
  }
}
