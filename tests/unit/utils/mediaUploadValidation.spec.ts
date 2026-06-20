import { describe, it } from 'vitest'
import {
  ALLOWED_AUDIO_MIMETYPES,
  ALLOWED_VIDEO_MIMETYPES,
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  validateAudioFile,
  validateVideoFile,
} from '~/utils/mediaUploadValidation'

describe('mediaUploadValidation', () => {
  it('accepts allowed video mime types', () => {
    for (const mimetype of ALLOWED_VIDEO_MIMETYPES) {
      const file = new Blob(['video'], { type: mimetype })
      const result = validateVideoFile(file)
      result.ok.should.equal(true)
      if (result.ok) {
        result.mimetype.should.equal(mimetype)
      }
    }
  })

  it('rejects unsupported mime types', () => {
    const file = new Blob(['video'], { type: 'video/quicktime' })
    const result = validateVideoFile(file)
    result.ok.should.equal(false)
    if (!result.ok) {
      result.code.should.equal('invalidType')
    }
  })

  it('accepts mp4 by file extension when type is empty', () => {
    const file = new Blob(['video'], { type: '' })
    const result = validateVideoFile(file, 'clip.mp4')
    result.ok.should.equal(true)
    if (result.ok) {
      result.mimetype.should.equal('video/mp4')
    }
  })

  it('rejects files above max size', () => {
    const oversized = new Blob([new Uint8Array(MAX_VIDEO_UPLOAD_BYTES + 1)], {
      type: 'video/mp4',
    })
    const result = validateVideoFile(oversized)
    result.ok.should.equal(false)
    if (!result.ok) {
      result.code.should.equal('tooLarge')
    }
  })

  it('accepts allowed audio mime types', () => {
    for (const mimetype of ALLOWED_AUDIO_MIMETYPES) {
      const file = new Blob(['audio'], { type: mimetype })
      const result = validateAudioFile(file)
      result.ok.should.equal(true)
      if (result.ok) {
        result.mimetype.should.equal(mimetype)
      }
    }
  })

  it('accepts audio with codec parameters in mime type', () => {
    const file = new Blob(['audio'], { type: 'audio/ogg;codecs=opus' })
    const result = validateAudioFile(file)
    result.ok.should.equal(true)
    if (result.ok) {
      result.mimetype.should.equal('audio/ogg')
    }
  })

  it('rejects unsupported audio mime types', () => {
    const file = new Blob(['audio'], { type: 'audio/aac' })
    const result = validateAudioFile(file)
    result.ok.should.equal(false)
    if (!result.ok) {
      result.code.should.equal('invalidType')
    }
  })

  it('accepts mp3 by file extension when type is empty', () => {
    const file = new Blob(['audio'], { type: '' })
    const result = validateAudioFile(file, 'track.mp3')
    result.ok.should.equal(true)
    if (result.ok) {
      result.mimetype.should.equal('audio/mpeg')
    }
  })

  it('rejects audio files above max size', () => {
    const oversized = new Blob([new Uint8Array(MAX_AUDIO_UPLOAD_BYTES + 1)], {
      type: 'audio/mpeg',
    })
    const result = validateAudioFile(oversized)
    result.ok.should.equal(false)
    if (!result.ok) {
      result.code.should.equal('tooLarge')
    }
  })
})
