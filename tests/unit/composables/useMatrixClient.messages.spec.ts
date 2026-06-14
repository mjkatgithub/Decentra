import { beforeEach, describe, expect, it, vi } from 'vitest'
import './matrixClientSpecMocks'
import { createClient } from 'matrix-js-sdk'
import {
  installLoginFlow,
  installLoginFlowFromStubs,
  installRegisterClient,
} from './matrixClientTestDoubles'
import {
  prepareMatrixClientSpecFile,
  setupMatrixClientTestGlobals,
} from './matrixClientTestSetup'

describe('useMatrixClient messages', () => {
  beforeEach(() => {
    prepareMatrixClientSpecFile()
    setupMatrixClientTestGlobals()
    installLoginFlow(createClient)
  })

  it('sends text message with reply relation payload', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    await sendMessage('!room:example.org', 'Reply text', {
      eventId: 'evt-original'
    })

    expect(matrixClient.sendEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.text',
        body: 'Reply text',
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: 'evt-original'
          }
        }
      })
    )
  })

  it('sends text message edit with m.replace and m.new_content', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123',
      })),
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      sendEvent: vi.fn(async () => undefined),
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendEditMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    await sendEditMessage(
      '!room:example.org',
      'Updated text',
      'evt-original',
    )

    expect(matrixClient.sendEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.text',
        body: 'Updated text',
        'm.new_content': {
          msgtype: 'm.text',
          body: 'Updated text',
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: 'evt-original',
        },
      }),
    )
  })

  it('sends thread reply with MSC3440 relates_to', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    await sendMessage('!room:example.org', 'In thread', {
      threadRootEventId: '$root-event',
      replyTo: { eventId: '$prev-in-thread' },
    })

    expect(matrixClient.sendEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.text',
        body: 'In thread',
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: '$root-event',
          'm.in_reply_to': {
            event_id: '$prev-in-thread',
          },
        },
      }),
    )
  })

  it('sends image message with url payload for non-encrypted room', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      })),
      uploadContent: vi.fn(async () => ({
        content_uri: 'mxc://example.org/plain-image'
      })),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)
    const originalImage = (globalThis as Record<string, unknown>).Image
    ;(globalThis as Record<string, unknown>).Image = undefined

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendImageMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const imageBlob = new Blob(['img-data'], { type: 'image/png' })
    await sendImageMessage('!room:example.org', imageBlob, 'photo.png')

    expect(matrixClient.uploadContent).toHaveBeenCalledTimes(1)
    expect(matrixClient.sendEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.image',
        body: 'photo.png',
        url: 'mxc://example.org/plain-image',
        info: expect.objectContaining({
          mimetype: 'image/png'
        })
      })
    )
    ;(globalThis as Record<string, unknown>).Image = originalImage
  })

  it('sends image message with reply relation for non-encrypted room', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      })),
      uploadContent: vi.fn(async () => ({
        content_uri: 'mxc://example.org/plain-image'
      })),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)
    const originalImage = (globalThis as Record<string, unknown>).Image
    ;(globalThis as Record<string, unknown>).Image = undefined

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendImageMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const imageBlob = new Blob(['img-data'], { type: 'image/png' })
    await sendImageMessage(
      '!room:example.org',
      imageBlob,
      'photo.png',
      { replyTo: { eventId: '$reply-target' } },
    )

    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload.url).toBe('mxc://example.org/plain-image')
    expect(sendEventPayload['m.relates_to']).to.deep.equal({
      'm.in_reply_to': { event_id: '$reply-target' },
    })
    ;(globalThis as Record<string, unknown>).Image = originalImage
  })

  it('sends image message with thread relation for non-encrypted room', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      })),
      uploadContent: vi.fn(async () => ({
        content_uri: 'mxc://example.org/plain-image'
      })),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)
    const originalImage = (globalThis as Record<string, unknown>).Image
    ;(globalThis as Record<string, unknown>).Image = undefined

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendImageMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const imageBlob = new Blob(['img-data'], { type: 'image/png' })
    await sendImageMessage(
      '!room:example.org',
      imageBlob,
      'photo.png',
      {
        threadRootEventId: '$thread-root',
        replyTo: { eventId: '$in-thread' },
      },
    )

    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload.url).toBe('mxc://example.org/plain-image')
    expect(sendEventPayload['m.relates_to']).to.deep.equal({
      rel_type: 'm.thread',
      event_id: '$thread-root',
      'm.in_reply_to': { event_id: '$in-thread' },
    })
    ;(globalThis as Record<string, unknown>).Image = originalImage
  })

  it('sends plain audio message with voice marker and duration', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      })),
      uploadContent: vi.fn(async () => ({
        content_uri: 'mxc://example.org/plain-audio'
      })),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendAudioMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' })
    await sendAudioMessage(
      '!room:example.org',
      audioBlob,
      'voice.webm',
      { durationMs: 3200 },
    )

    expect(matrixClient.sendEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.audio',
        body: 'voice.webm',
        url: 'mxc://example.org/plain-audio',
        'org.matrix.msc3245.voice': {},
        info: expect.objectContaining({
          mimetype: 'audio/webm',
          duration: 3200,
        }),
      }),
    )
  })

  it('sends audio message with reply relation', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      })),
      uploadContent: vi.fn(async () => ({
        content_uri: 'mxc://example.org/reply-audio'
      })),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendAudioMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const audioBlob = new Blob(['audio-data'], { type: 'audio/ogg' })
    await sendAudioMessage('!room:example.org', audioBlob, 'voice.ogg', {
      replyTo: { eventId: '$reply-target' },
    })

    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload['m.relates_to']).to.deep.equal({
      'm.in_reply_to': { event_id: '$reply-target' },
    })
  })

  it('sends audio message with thread relation', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      })),
      uploadContent: vi.fn(async () => ({
        content_uri: 'mxc://example.org/thread-audio'
      })),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendAudioMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' })
    await sendAudioMessage('!room:example.org', audioBlob, 'voice.webm', {
      threadRootEventId: '$thread-root',
      replyTo: { eventId: '$in-thread' },
    })

    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload['m.relates_to']).to.deep.equal({
      rel_type: 'm.thread',
      event_id: '$thread-root',
      'm.in_reply_to': { event_id: '$in-thread' },
    })
  })

  it('sends plain video message with thumbnail for non-encrypted room', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123',
      })),
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null),
        },
      })),
      uploadContent: vi.fn(async () => ({
        content_uri: 'mxc://example.org/uploaded',
      })),
      sendEvent: vi.fn(async () => undefined),
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)
    const originalImage = (globalThis as Record<string, unknown>).Image
    ;(globalThis as Record<string, unknown>).Image = undefined

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendVideoMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const videoBlob = new Blob(['video-data'], { type: 'video/mp4' })
    await sendVideoMessage('!room:example.org', videoBlob, 'clip.mp4')

    expect(matrixClient.uploadContent).toHaveBeenCalledTimes(2)
    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload.msgtype).toBe('m.video')
    expect(sendEventPayload.url).toBe('mxc://example.org/uploaded')
    expect(sendEventPayload.info.thumbnail_url).toBe(
      'mxc://example.org/uploaded',
    )
    expect(sendEventPayload.info.duration).to.equal(5000)
    ;(globalThis as Record<string, unknown>).Image = originalImage
  })

  it('rejects unsupported video uploads in sendVideoMessage', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123',
      })),
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null),
        },
      })),
      uploadContent: vi.fn(async () => undefined),
      sendEvent: vi.fn(async () => undefined),
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendVideoMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const imageBlob = new Blob(['img'], { type: 'image/png' })

    await expect(
      sendVideoMessage('!room:example.org', imageBlob, 'photo.png'),
    ).rejects.toThrow('Only supported video uploads are allowed')
  })

  it('rejects non-audio uploads in sendAudioMessage', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      })),
      uploadContent: vi.fn(async () => undefined),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendAudioMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const imageBlob = new Blob(['img'], { type: 'image/png' })

    await expect(
      sendAudioMessage('!room:example.org', imageBlob, 'photo.png'),
    ).rejects.toThrow('Only supported audio uploads are allowed')
  })

  it('sends audio file without voice marker when isVoiceMessage is false', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      })),
      uploadContent: vi.fn(async () => ({
        content_uri: 'mxc://example.org/file-audio'
      })),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendAudioMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const audioBlob = new Blob(['audio-data'], { type: 'audio/mpeg' })
    await sendAudioMessage('!room:example.org', audioBlob, 'track.mp3', {
      isVoiceMessage: false,
    })

    expect(matrixClient.sendEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.audio',
        body: 'track.mp3',
        url: 'mxc://example.org/file-audio',
        info: expect.objectContaining({
          mimetype: 'audio/mpeg',
        }),
      }),
    )
    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload['org.matrix.msc3245.voice']).toBeUndefined()
  })

  it('sends encrypted audio message for E2EE room', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getCrypto: vi.fn(() => ({})),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => ({ type: 'm.room.encryption' }))
        }
      })),
      uploadContent: vi.fn(async () => 'mxc://example.org/encrypted-audio'),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendAudioMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' })
    await sendAudioMessage('!room:example.org', audioBlob, 'secure.webm')

    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload.msgtype).toBe('m.audio')
    expect(sendEventPayload['org.matrix.msc3245.voice']).to.deep.equal({})
    expect(sendEventPayload.file.url).toBe('mxc://example.org/encrypted-audio')
    expect(sendEventPayload.url).toBeUndefined()
  })

  it('sends reaction event payload', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendReaction } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    await sendReaction('!room:example.org', 'evt-message', '👍')

    expect(matrixClient.sendEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'm.reaction',
      expect.objectContaining({
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: 'evt-message',
          key: '👍'
        }
      })
    )
  })

  it('toggles reaction by redacting existing own reaction', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      sendEvent: vi.fn(async () => undefined),
      redactEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, toggleReaction } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    await toggleReaction(
      '!room:example.org',
      'evt-message',
      '👍',
      ['reaction-own']
    )

    expect(matrixClient.redactEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'reaction-own'
    )
    expect(matrixClient.sendEvent).not.toHaveBeenCalled()
  })

  it('sends image message with encrypted file payload for E2EE room', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getCrypto: vi.fn(() => ({})),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => ({ type: 'm.room.encryption' }))
        }
      })),
      uploadContent: vi.fn(async () => 'mxc://example.org/encrypted-image'),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)
    const originalImage = (globalThis as Record<string, unknown>).Image
    ;(globalThis as Record<string, unknown>).Image = undefined

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendImageMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const imageBlob = new Blob(['img-data'], { type: 'image/png' })
    await sendImageMessage('!room:example.org', imageBlob, 'secure.png')

    expect(matrixClient.uploadContent).toHaveBeenCalledTimes(1)
    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload.msgtype).toBe('m.image')
    expect(sendEventPayload.body).toBe('secure.png')
    expect(sendEventPayload.file.url).toBe('mxc://example.org/encrypted-image')
    expect(sendEventPayload.file.key.alg).toBe('A256CTR')
    expect(sendEventPayload.file.iv.includes('=')).toBe(false)
    expect(sendEventPayload.file.hashes.sha256.includes('=')).toBe(false)
    ;(globalThis as Record<string, unknown>).Image = originalImage
  })

  it('sends encrypted image message with reply relation for E2EE room', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getCrypto: vi.fn(() => ({})),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => ({ type: 'm.room.encryption' }))
        }
      })),
      uploadContent: vi.fn(async () => 'mxc://example.org/encrypted-image'),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const originalImage = (globalThis as Record<string, unknown>).Image
    ;(globalThis as Record<string, unknown>).Image = undefined

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendImageMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const imageBlob = new Blob(['img-data'], { type: 'image/png' })
    await sendImageMessage(
      '!room:example.org',
      imageBlob,
      'secure.png',
      { replyTo: { eventId: '$reply-target' } },
    )

    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload.msgtype).toBe('m.image')
    expect(sendEventPayload.body).toBe('secure.png')
    expect(sendEventPayload['m.relates_to']).to.deep.equal({
      'm.in_reply_to': { event_id: '$reply-target' },
    })
    expect(sendEventPayload.file.url).toBe('mxc://example.org/encrypted-image')
    ;(globalThis as Record<string, unknown>).Image = originalImage
  })

  it('throws for encrypted room when crypto is not ready', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getCrypto: vi.fn(() => null),
      getDeviceId: vi.fn(() => undefined),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => ({ type: 'm.room.encryption' }))
        }
      })),
      uploadContent: vi.fn(async () => 'mxc://example.org/encrypted-image'),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)
    const originalImage = (globalThis as Record<string, unknown>).Image
    ;(globalThis as Record<string, unknown>).Image = undefined

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendImageMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const imageBlob = new Blob(['img-data'], { type: 'image/png' })

    await expect(
      sendImageMessage('!room:example.org', imageBlob, 'secure.png')
    ).rejects.toThrow('Encryption is not ready for media upload')
    expect(matrixClient.uploadContent).not.toHaveBeenCalled()
    ;(globalThis as Record<string, unknown>).Image = originalImage
  })

  it('treats room as unencrypted when encryption state events are empty', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn(),
      getRoom: vi.fn(() => ({
        currentState: {
          getStateEvents: vi.fn(() => [])
        }
      })),
      uploadContent: vi.fn(async () => ({
        content_uri: 'mxc://example.org/plain-image'
      })),
      sendEvent: vi.fn(async () => undefined)
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)
    const originalImage = (globalThis as Record<string, unknown>).Image
    ;(globalThis as Record<string, unknown>).Image = undefined

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, sendImageMessage } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')
    const imageBlob = new Blob(['img-data'], { type: 'image/png' })
    await sendImageMessage('!room:example.org', imageBlob, 'plain.png')

    const sendEventPayload = (matrixClient.sendEvent as any).mock.calls[0][2]
    expect(sendEventPayload.url).toBe('mxc://example.org/plain-image')
    expect(sendEventPayload.file).toBeUndefined()
    ;(globalThis as Record<string, unknown>).Image = originalImage
  })

  it('upgrades public http homeserver to https for login clients', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:matrix.moepg.de',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn()
    }
    installLoginFlowFromStubs(createClient, authClient, matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login } = useMatrixClient()
    await login(
      'http://matrix.moepg.de',
      '@alice:matrix.moepg.de',
      'secret'
    )

    expect(createClient).toHaveBeenNthCalledWith(1, {
      baseUrl: 'https://matrix.moepg.de'
    })
    expect(createClient).toHaveBeenNthCalledWith(2, {
      baseUrl: 'https://matrix.moepg.de',
      accessToken: 'token-123',
      userId: '@alice:matrix.moepg.de',
      deviceId: 'DEVICE123'
    })
  })

  it('maps browser fetch failures on login to connection hint', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    }
    installRegisterClient(createClient, authClient)

    const {
      HOMESERVER_CONNECTION_HINT_ERROR,
      useMatrixClient
    } = await import('~/composables/useMatrixClient')
    const { login } = useMatrixClient()

    await expect(
      login('https://matrix.example.org', 'alice', 'secret')
    ).rejects.toThrow(HOMESERVER_CONNECTION_HINT_ERROR)
  })
})
