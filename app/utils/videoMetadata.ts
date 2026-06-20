export interface VideoMetadata {
  durationMs?: number
  w?: number
  h?: number
}

const THUMBNAIL_MAX_EDGE_PX = 320
const THUMBNAIL_JPEG_QUALITY = 0.85

export async function readVideoMetadata(
  videoFile: Blob,
): Promise<VideoMetadata> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return {}
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(videoFile)
    const videoElement = document.createElement('video')
    videoElement.preload = 'metadata'
    videoElement.muted = true
    videoElement.playsInline = true
    const cleanup = () => {
      videoElement.removeAttribute('src')
      if (typeof videoElement.load === 'function') {
        videoElement.load()
      }
      URL.revokeObjectURL(objectUrl)
    }
    videoElement.onloadedmetadata = () => {
      const durationMs = Number.isFinite(videoElement.duration)
        ? Math.round(videoElement.duration * 1000)
        : undefined
      const metadata: VideoMetadata = {
        durationMs,
        w: videoElement.videoWidth || undefined,
        h: videoElement.videoHeight || undefined,
      }
      cleanup()
      resolve(metadata)
    }
    videoElement.onerror = () => {
      cleanup()
      resolve({})
    }
    videoElement.src = objectUrl
  })
}

function scaleThumbnailDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  const longestEdge = Math.max(width, height)
  if (longestEdge <= THUMBNAIL_MAX_EDGE_PX) {
    return { width, height }
  }
  const scale = THUMBNAIL_MAX_EDGE_PX / longestEdge
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

export async function captureVideoThumbnail(
  videoFile: Blob,
): Promise<Blob | undefined> {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined'
  ) {
    return undefined
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(videoFile)
    const videoElement = document.createElement('video')
    videoElement.preload = 'auto'
    videoElement.muted = true
    videoElement.playsInline = true
    const cleanup = () => {
      videoElement.removeAttribute('src')
      if (typeof videoElement.load === 'function') {
        videoElement.load()
      }
      URL.revokeObjectURL(objectUrl)
    }
    const finish = (thumbnail?: Blob) => {
      cleanup()
      resolve(thumbnail)
    }
    videoElement.onloadeddata = () => {
      const sourceWidth = videoElement.videoWidth
      const sourceHeight = videoElement.videoHeight
      if (!sourceWidth || !sourceHeight) {
        finish(undefined)
        return
      }
      const scaled = scaleThumbnailDimensions(sourceWidth, sourceHeight)
      const canvas = document.createElement('canvas')
      canvas.width = scaled.width
      canvas.height = scaled.height
      const context = canvas.getContext('2d')
      if (!context) {
        finish(undefined)
        return
      }
      context.drawImage(
        videoElement,
        0,
        0,
        scaled.width,
        scaled.height,
      )
      canvas.toBlob(
        (blob) => finish(blob ?? undefined),
        'image/jpeg',
        THUMBNAIL_JPEG_QUALITY,
      )
    }
    videoElement.onerror = () => finish(undefined)
    videoElement.src = objectUrl
    videoElement.currentTime = 0
  })
}
