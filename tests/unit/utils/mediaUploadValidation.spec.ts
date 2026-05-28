import { describe, it } from 'vitest'
import {
  ALLOWED_VIDEO_MIMETYPES,
  MAX_VIDEO_UPLOAD_BYTES,
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
})
