export type VoiceRecorderPhase =
  | 'idle'
  | 'requestingPermission'
  | 'recording'
  | 'paused'
  | 'preview'
  | 'sending'
  | 'error'

export type VoiceRecorderErrorCode =
  | 'permissionDenied'
  | 'recordingFailed'
  | 'uploadFailed'
  | 'unsupported'

export interface VoiceRecorderError {
  code: VoiceRecorderErrorCode
  message?: string
}

export interface VoiceRecorderSession {
  mediaStream: MediaStream
  mediaRecorder: MediaRecorder
  mimeType: string
  chunks: Blob[]
}

const PREFERRED_RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

export function isVoiceRecordingSupported(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return false
  }
  return typeof MediaRecorder !== 'undefined'
}

export function resolveVoiceRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined
  }
  for (const mimeType of PREFERRED_RECORDING_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }
  return undefined
}

export function mapGetUserMediaError(
  thrownError: unknown,
): VoiceRecorderError {
  const domError = thrownError as { name?: string }
  if (domError?.name === 'NotAllowedError' ||
      domError?.name === 'PermissionDeniedError') {
    return { code: 'permissionDenied' }
  }
  return { code: 'recordingFailed' }
}

export async function requestMicrophoneAccess(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true })
}

export function createVoiceRecorderSession(
  mediaStream: MediaStream,
  mimeType: string,
): VoiceRecorderSession {
  const mediaRecorder = new MediaRecorder(mediaStream, { mimeType })
  return {
    mediaStream,
    mediaRecorder,
    mimeType,
    chunks: [],
  }
}

export function stopMediaStreamTracks(mediaStream: MediaStream | null): void {
  if (!mediaStream) {
    return
  }
  for (const track of mediaStream.getTracks()) {
    track.stop()
  }
}

export function buildVoiceMessageBlob(
  chunks: Blob[],
  mimeType: string,
): Blob {
  return new Blob(chunks, { type: mimeType })
}

export function readAudioDurationMs(blob: Blob): Promise<number | undefined> {
  if (typeof Audio === 'undefined' || typeof URL === 'undefined') {
    return Promise.resolve(undefined)
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob)
    const audioElement = new Audio()
    audioElement.preload = 'metadata'
    audioElement.onloadedmetadata = () => {
      const durationSec = audioElement.duration
      URL.revokeObjectURL(objectUrl)
      if (typeof durationSec === 'number' && Number.isFinite(durationSec)) {
        resolve(Math.round(durationSec * 1000))
      } else {
        resolve(undefined)
      }
    }
    audioElement.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(undefined)
    }
    audioElement.src = objectUrl
  })
}

export function defaultVoiceFileName(mimeType: string): string {
  if (mimeType.includes('ogg')) {
    return 'voice-message.ogg'
  }
  return 'voice-message.webm'
}

export function supportsMediaRecorderPause(
  mediaRecorder: MediaRecorder,
): boolean {
  return typeof mediaRecorder.pause === 'function' &&
    typeof mediaRecorder.resume === 'function'
}
