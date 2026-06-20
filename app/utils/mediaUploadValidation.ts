export const ALLOWED_VIDEO_MIMETYPES = [
  'video/mp4',
  'video/webm',
] as const

export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024

const VIDEO_EXTENSION_MIMETYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

export type VideoValidationErrorCode = 'invalidType' | 'tooLarge'

export type VideoValidationResult =
  | { ok: true; mimetype: string }
  | { ok: false; code: VideoValidationErrorCode }

function resolveVideoMimetype(
  file: File | Blob,
  fileName?: string,
): string | undefined {
  const declaredType = file.type?.trim().toLowerCase()
  if (declaredType) {
    return declaredType
  }
  const name = fileName?.trim().toLowerCase()
  if (!name) {
    return undefined
  }
  for (const [extension, mimetype] of Object.entries(VIDEO_EXTENSION_MIMETYPES)) {
    if (name.endsWith(extension)) {
      return mimetype
    }
  }
  return undefined
}

export function validateVideoFile(
  file: File | Blob,
  fileName?: string,
): VideoValidationResult {
  const mimetype = resolveVideoMimetype(
    file,
    fileName ?? (file instanceof File ? file.name : undefined),
  )
  if (
    !mimetype ||
    !ALLOWED_VIDEO_MIMETYPES.includes(
      mimetype as (typeof ALLOWED_VIDEO_MIMETYPES)[number],
    )
  ) {
    return { ok: false, code: 'invalidType' }
  }
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
    return { ok: false, code: 'tooLarge' }
  }
  return { ok: true, mimetype }
}

export const ALLOWED_AUDIO_MIMETYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
] as const

export const MAX_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024

const AUDIO_EXTENSION_MIMETYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
}

export type AudioValidationErrorCode = 'invalidType' | 'tooLarge'

export type AudioValidationResult =
  | { ok: true; mimetype: string }
  | { ok: false; code: AudioValidationErrorCode }

function normalizeAudioMimetype(mimetype: string): string {
  return mimetype.split(';')[0]?.trim().toLowerCase() ?? mimetype
}

function isAllowedAudioMimetype(mimetype: string): boolean {
  const baseType = normalizeAudioMimetype(mimetype)
  return ALLOWED_AUDIO_MIMETYPES.includes(
    baseType as (typeof ALLOWED_AUDIO_MIMETYPES)[number],
  )
}

function resolveAudioMimetype(
  file: File | Blob,
  fileName?: string,
): string | undefined {
  const declaredType = file.type?.trim().toLowerCase()
  if (declaredType) {
    return normalizeAudioMimetype(declaredType)
  }
  const name = fileName?.trim().toLowerCase()
  if (!name) {
    return undefined
  }
  for (const [extension, mimetype] of Object.entries(AUDIO_EXTENSION_MIMETYPES)) {
    if (name.endsWith(extension)) {
      return mimetype
    }
  }
  return undefined
}

export function validateAudioFile(
  file: File | Blob,
  fileName?: string,
): AudioValidationResult {
  const mimetype = resolveAudioMimetype(
    file,
    fileName ?? (file instanceof File ? file.name : undefined),
  )
  if (!mimetype || !isAllowedAudioMimetype(mimetype)) {
    return { ok: false, code: 'invalidType' }
  }
  if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
    return { ok: false, code: 'tooLarge' }
  }
  return { ok: true, mimetype }
}
