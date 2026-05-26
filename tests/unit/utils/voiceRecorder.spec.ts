import { describe, it } from 'vitest'
import {
  buildVoiceMessageBlob,
  defaultVoiceFileName,
  mapGetUserMediaError,
  resolveVoiceRecordingMimeType,
} from '~/utils/voiceRecorder'

describe('voiceRecorder utils', () => {
  it('buildVoiceMessageBlob merges chunks with mime type', () => {
    const chunkOne = new Blob(['a'], { type: 'audio/webm' })
    const chunkTwo = new Blob(['b'], { type: 'audio/webm' })
    const merged = buildVoiceMessageBlob([chunkOne, chunkTwo], 'audio/webm')
    merged.type.should.equal('audio/webm')
    merged.size.should.equal(2)
  })

  it('maps permission denied errors', () => {
    mapGetUserMediaError({ name: 'NotAllowedError' }).code
      .should.equal('permissionDenied')
    mapGetUserMediaError({ name: 'PermissionDeniedError' }).code
      .should.equal('permissionDenied')
  })

  it('maps unknown errors to recordingFailed', () => {
    mapGetUserMediaError(new Error('boom')).code
      .should.equal('recordingFailed')
  })

  it('returns default voice file names by mime type', () => {
    defaultVoiceFileName('audio/webm').should.equal('voice-message.webm')
    defaultVoiceFileName('audio/ogg').should.equal('voice-message.ogg')
  })

  it('resolves a supported recording mime type when MediaRecorder exists', () => {
    const originalMediaRecorder = globalThis.MediaRecorder
    globalThis.MediaRecorder = class MockMediaRecorder {
      static isTypeSupported(type: string) {
        return type === 'audio/webm;codecs=opus'
      }
    } as unknown as typeof MediaRecorder

    resolveVoiceRecordingMimeType()
      .should.equal('audio/webm;codecs=opus')

    globalThis.MediaRecorder = originalMediaRecorder
  })
})
