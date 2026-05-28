import { afterEach, describe, it, vi } from 'vitest'
import {
  captureVideoThumbnail,
  readVideoMetadata,
} from '~/utils/videoMetadata'

describe('videoMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('readVideoMetadata returns dimensions and duration', async () => {
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName !== 'video') {
        return createElement(tagName)
      }
      const element = createElement('div') as HTMLVideoElement
      Object.defineProperty(element, 'duration', {
        value: 4.2,
        configurable: true,
      })
      Object.defineProperty(element, 'videoWidth', {
        value: 1280,
        configurable: true,
      })
      Object.defineProperty(element, 'videoHeight', {
        value: 720,
        configurable: true,
      })
      setTimeout(() => {
        element.onloadedmetadata?.(new Event('loadedmetadata'))
      }, 0)
      return element
    })

    const metadata = await readVideoMetadata(
      new Blob(['video'], { type: 'video/mp4' }),
    )
    metadata.durationMs!.should.equal(4200)
    metadata.w!.should.equal(1280)
    metadata.h!.should.equal(720)
  })

  it('captureVideoThumbnail returns jpeg blob from canvas', async () => {
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'video') {
        const element = createElement('div') as HTMLVideoElement
        Object.defineProperty(element, 'videoWidth', {
          value: 640,
          configurable: true,
        })
        Object.defineProperty(element, 'videoHeight', {
          value: 360,
          configurable: true,
        })
        setTimeout(() => {
          element.onloadeddata?.(new Event('loadeddata'))
        }, 0)
        return element
      }
      if (tagName === 'canvas') {
        const canvas = createElement('canvas')
        canvas.getContext = vi.fn(() => ({
          drawImage: vi.fn(),
        })) as typeof canvas.getContext
        canvas.toBlob = vi.fn((callback: BlobCallback) => {
          callback(new Blob(['thumb'], { type: 'image/jpeg' }))
        }) as typeof canvas.toBlob
        return canvas
      }
      return createElement(tagName)
    })

    const thumbnail = await captureVideoThumbnail(
      new Blob(['video'], { type: 'video/webm' }),
    )
    thumbnail!.type.should.equal('image/jpeg')
  })
})
