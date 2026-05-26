import { computed, onBeforeUnmount, ref } from 'vue'
import {
  buildVoiceMessageBlob,
  createVoiceRecorderSession,
  defaultVoiceFileName,
  isVoiceRecordingSupported,
  mapGetUserMediaError,
  readAudioDurationMs,
  requestMicrophoneAccess,
  resolveVoiceRecordingMimeType,
  stopMediaStreamTracks,
  supportsMediaRecorderPause,
  type VoiceRecorderError,
  type VoiceRecorderPhase,
  type VoiceRecorderSession,
} from '~/utils/voiceRecorder'

export function useVoiceRecorder() {
  const phase = ref<VoiceRecorderPhase>('idle')
  const error = ref<VoiceRecorderError | null>(null)
  const elapsedMs = ref(0)
  const previewBlob = ref<Blob | null>(null)
  const previewUrl = ref<string | null>(null)
  const previewDurationMs = ref<number | undefined>(undefined)
  const canPause = ref(false)

  let session: VoiceRecorderSession | null = null
  let elapsedTimer: ReturnType<typeof setInterval> | null = null
  let recordingStartedAt = 0
  let pausedAccumulatedMs = 0
  let pauseStartedAt = 0

  const isRecordingActive = computed(() => {
    return phase.value === 'recording' || phase.value === 'paused'
  })

  function clearElapsedTimer() {
    if (elapsedTimer) {
      clearInterval(elapsedTimer)
      elapsedTimer = null
    }
  }

  function revokePreviewUrl() {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = null
    }
  }

  function resetPreview() {
    revokePreviewUrl()
    previewBlob.value = null
    previewDurationMs.value = undefined
  }

  function cleanupSession() {
    clearElapsedTimer()
    if (session) {
      if (session.mediaRecorder.state !== 'inactive') {
        try {
          session.mediaRecorder.stop()
        } catch {
          // ignore stop errors during cleanup
        }
      }
      stopMediaStreamTracks(session.mediaStream)
      session = null
    }
    elapsedMs.value = 0
    recordingStartedAt = 0
    pausedAccumulatedMs = 0
    pauseStartedAt = 0
    canPause.value = false
  }

  function setError(voiceError: VoiceRecorderError) {
    error.value = voiceError
    phase.value = 'error'
    cleanupSession()
    resetPreview()
  }

  function updateElapsed() {
    if (phase.value === 'paused') {
      elapsedMs.value = pausedAccumulatedMs
      return
    }
    elapsedMs.value = pausedAccumulatedMs +
      (Date.now() - recordingStartedAt)
  }

  function startElapsedTimer() {
    clearElapsedTimer()
    elapsedTimer = setInterval(updateElapsed, 200)
  }

  async function beginRecording(): Promise<void> {
    if (!isVoiceRecordingSupported()) {
      setError({ code: 'unsupported' })
      return
    }
    const mimeType = resolveVoiceRecordingMimeType()
    if (!mimeType) {
      setError({ code: 'unsupported' })
      return
    }

    error.value = null
    resetPreview()
    cleanupSession()
    phase.value = 'requestingPermission'

    try {
      const mediaStream = await requestMicrophoneAccess()
      session = createVoiceRecorderSession(mediaStream, mimeType)
      canPause.value = supportsMediaRecorderPause(session.mediaRecorder)

      session.mediaRecorder.ondataavailable = (dataEvent) => {
        if (dataEvent.data.size > 0) {
          session?.chunks.push(dataEvent.data)
        }
      }
      session.mediaRecorder.onerror = () => {
        setError({ code: 'recordingFailed' })
      }
      session.mediaRecorder.onstop = async () => {
        clearElapsedTimer()
        stopMediaStreamTracks(session?.mediaStream ?? null)
        const activeSession = session
        session = null
        if (!activeSession || phase.value === 'error') {
          return
        }
        const blob = buildVoiceMessageBlob(
          activeSession.chunks,
          activeSession.mimeType,
        )
        if (blob.size === 0) {
          setError({ code: 'recordingFailed' })
          return
        }
        previewBlob.value = blob
        previewDurationMs.value = await readAudioDurationMs(blob)
        revokePreviewUrl()
        previewUrl.value = URL.createObjectURL(blob)
        phase.value = 'preview'
      }

      session.mediaRecorder.start()
      recordingStartedAt = Date.now()
      pausedAccumulatedMs = 0
      phase.value = 'recording'
      startElapsedTimer()
    } catch (thrownError) {
      cleanupSession()
      setError(mapGetUserMediaError(thrownError))
    }
  }

  function pauseRecording() {
    if (!session || phase.value !== 'recording' || !canPause.value) {
      return
    }
    session.mediaRecorder.pause()
    pauseStartedAt = Date.now()
    phase.value = 'paused'
    updateElapsed()
  }

  function resumeRecording() {
    if (!session || phase.value !== 'paused' || !canPause.value) {
      return
    }
    pausedAccumulatedMs += Date.now() - pauseStartedAt
    recordingStartedAt = Date.now()
    session.mediaRecorder.resume()
    phase.value = 'recording'
  }

  function stopRecording() {
    if (!session || !isRecordingActive.value) {
      return
    }
    if (session.mediaRecorder.state !== 'inactive') {
      session.mediaRecorder.stop()
    }
  }

  function cancelRecording() {
    cleanupSession()
    resetPreview()
    error.value = null
    phase.value = 'idle'
  }

  function discardPreview() {
    resetPreview()
    error.value = null
    phase.value = 'idle'
  }

  function markSending() {
    phase.value = 'sending'
  }

  function markUploadFailed() {
    setError({ code: 'uploadFailed' })
  }

  function finishSending() {
    resetPreview()
    cleanupSession()
    error.value = null
    phase.value = 'idle'
  }

  function getPreviewFileName(): string {
    const mimeType = previewBlob.value?.type || 'audio/webm'
    return defaultVoiceFileName(mimeType)
  }

  onBeforeUnmount(() => {
    cleanupSession()
    resetPreview()
  })

  return {
    phase,
    error,
    elapsedMs,
    previewBlob,
    previewUrl,
    previewDurationMs,
    canPause,
    isRecordingActive,
    beginRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    discardPreview,
    markSending,
    markUploadFailed,
    finishSending,
    getPreviewFileName,
  }
}
