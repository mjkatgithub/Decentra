import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'
import type {
  ImageInfo,
  AudioInfo,
  VideoInfo,
  MatrixEncryptedFile,
} from './matrixClientTypes'

function base64ToBase64Url(input: string): string {
  return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const value of bytes) {
    binary += String.fromCharCode(value)
  }
  return btoa(binary)
}

function toUnpaddedBase64(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/=+$/g, '')
}

export async function encryptAttachmentData(
  data: ArrayBuffer,
): Promise<{
  encryptedData: ArrayBuffer
  encryptedFile: Omit<MatrixEncryptedFile, 'url'>
}> {
  const cryptoKey = await crypto.subtle.generateKey(
    { name: 'AES-CTR', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  const rawKey = await crypto.subtle.exportKey('raw', cryptoKey)
  const keyBytes = new Uint8Array(rawKey)
  const ivBytes = new Uint8Array(16)
  crypto.getRandomValues(ivBytes)
  for (let index = 8; index < ivBytes.length; index++) {
    ivBytes[index] = 0
  }

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-CTR',
      counter: ivBytes,
      length: 64,
    },
    cryptoKey,
    data,
  )
  const hashBuffer = await crypto.subtle.digest('SHA-256', encryptedData)
  const hashBase64 = toUnpaddedBase64(new Uint8Array(hashBuffer))

  return {
    encryptedData,
    encryptedFile: {
      key: {
        k: base64ToBase64Url(bytesToBase64(keyBytes)),
        kty: 'oct',
        alg: 'A256CTR',
        key_ops: ['encrypt', 'decrypt'],
        ext: true,
      },
      iv: toUnpaddedBase64(ivBytes),
      hashes: { sha256: hashBase64 },
      v: 'v2',
    },
  }
}

export function extractMxcUrl(uploadResponse: unknown): string {
  if (typeof uploadResponse === 'string') {
    return uploadResponse
  }
  if (uploadResponse && typeof uploadResponse === 'object') {
    const response = uploadResponse as Record<string, unknown>
    const contentUri = response.content_uri
    if (typeof contentUri === 'string') {
      return contentUri
    }
  }
  throw new Error('Media upload did not return an MXC URL')
}

export async function readImageDimensions(
  imageFile: Blob,
): Promise<{ w?: number; h?: number }> {
  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    return {}
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(imageFile)
    const image = new Image()
    image.onload = () => {
      resolve({ w: image.naturalWidth, h: image.naturalHeight })
      URL.revokeObjectURL(objectUrl)
    }
    image.onerror = () => {
      resolve({})
      URL.revokeObjectURL(objectUrl)
    }
    image.src = objectUrl
  })
}

export function getImageInfo(
  imageFile: Blob,
  dimensions: { w?: number; h?: number },
): ImageInfo {
  return {
    mimetype: imageFile.type || 'application/octet-stream',
    size: imageFile.size,
    ...dimensions,
  }
}

export function getAudioInfo(
  audioFile: Blob,
  durationMs?: number,
): AudioInfo {
  const info: AudioInfo = {
    mimetype: audioFile.type || 'application/octet-stream',
    size: audioFile.size,
  }
  if (typeof durationMs === 'number' && durationMs > 0) {
    info.duration = Math.round(durationMs)
  }
  return info
}

export function getVideoInfo(
  videoFile: Blob,
  metadata: { durationMs?: number; w?: number; h?: number },
  mimetype: string,
  thumbnail?: {
    mxcUrl?: string
    encryptedFile?: MatrixEncryptedFile
    info?: ImageInfo
  },
): VideoInfo {
  const info: VideoInfo = {
    mimetype,
    size: videoFile.size,
    ...(typeof metadata.w === 'number' ? { w: metadata.w } : {}),
    ...(typeof metadata.h === 'number' ? { h: metadata.h } : {}),
  }
  if (typeof metadata.durationMs === 'number' && metadata.durationMs > 0) {
    info.duration = Math.round(metadata.durationMs)
  }
  if (thumbnail?.encryptedFile) {
    info.thumbnail_file = thumbnail.encryptedFile
  } else if (thumbnail?.mxcUrl) {
    info.thumbnail_url = thumbnail.mxcUrl
  }
  if (thumbnail?.info) {
    info.thumbnail_info = thumbnail.info
  }
  return info
}

export async function uploadPlainAttachment(
  matrixClient: MatrixClient,
  blob: Blob,
  mimetype: string,
): Promise<string> {
  const uploadResponse = await matrixClient.uploadContent(blob, {
    type: mimetype,
    includeFilename: true,
  })
  return extractMxcUrl(uploadResponse)
}

export async function uploadEncryptedAttachment(
  matrixClient: MatrixClient,
  blob: Blob,
): Promise<MatrixEncryptedFile> {
  const plaintextData = await blob.arrayBuffer()
  const encryptedResult = await encryptAttachmentData(plaintextData)
  const encryptedBlob = new Blob(
    [encryptedResult.encryptedData],
    { type: 'application/octet-stream' },
  )
  const uploadResponse = await matrixClient.uploadContent(encryptedBlob, {
    type: 'application/octet-stream',
    includeFilename: true,
  })
  const mxcUrl = extractMxcUrl(uploadResponse)
  return {
    ...encryptedResult.encryptedFile,
    url: mxcUrl,
  }
}

export function isRoomEncrypted(room: sdk.Room): boolean {
  const hasEncryptionStateEvent = (room as sdk.Room & {
    hasEncryptionStateEvent?: () => boolean
  }).hasEncryptionStateEvent
  if (typeof hasEncryptionStateEvent === 'function') {
    return hasEncryptionStateEvent.call(room)
  }
  const encryptionStateEvent = room.currentState
    ?.getStateEvents?.('m.room.encryption', '')
  if (Array.isArray(encryptionStateEvent)) {
    return encryptionStateEvent.length > 0
  }
  return Boolean(encryptionStateEvent)
}
