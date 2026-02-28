import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()
const initCryptoWasm = vi.fn(async () => undefined)

vi.mock('matrix-js-sdk', () => {
  return {
    createClient,
    EventType: { RoomMessage: 'm.room.message' },
    MsgType: { Text: 'm.text', Image: 'm.image' },
    ClientEvent: {}
  }
})

vi.mock('@matrix-org/matrix-sdk-crypto-wasm', () => {
  return {
    initAsync: initCryptoWasm
  }
})

describe('useMatrixClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    const stateMap = new Map<string, { value: unknown }>()
    const useStateMock = (
      key: string,
      init: () => unknown
    ) => {
      if (!stateMap.has(key)) {
        stateMap.set(key, ref(init()))
      }
      return stateMap.get(key)
    }
    ;(globalThis as Record<string, unknown>).useState = useStateMock
    useStateMock(
      'matrix-client-restore-status',
      () => 'success'
    )
    ;(globalThis as Record<string, unknown>).computed = computed
    localStorage.clear()
  })

  it('marks restore as success when no session exists', async () => {
    const stateMap = new Map<string, { value: unknown }>()
    ;(globalThis as Record<string, unknown>).useState = (
      key: string,
      init: () => unknown
    ) => {
      if (!stateMap.has(key)) {
        stateMap.set(key, ref(init()))
      }
      return stateMap.get(key)
    }
    ;(globalThis as Record<string, unknown>).computed = computed

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const {
      sessionRestoreStatus,
      ensureSessionRestoreCompleted
    } = useMatrixClient()

    await ensureSessionRestoreCompleted()

    expect(sessionRestoreStatus.value).toBe('success')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('marks restore as failure when session bootstrap throws', async () => {
    localStorage.setItem('decentra.matrix.session.v1', JSON.stringify({
      baseUrl: 'https://matrix.example.org',
      accessToken: 'token-123',
      userId: '@alice:example.org'
    }))
    createClient.mockImplementation(() => {
      throw new Error('restore failed')
    })
    const consoleErrorSpy = vi.spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const stateMap = new Map<string, { value: unknown }>()
    ;(globalThis as Record<string, unknown>).useState = (
      key: string,
      init: () => unknown
    ) => {
      if (!stateMap.has(key)) {
        stateMap.set(key, ref(init()))
      }
      return stateMap.get(key)
    }
    ;(globalThis as Record<string, unknown>).computed = computed

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const {
      sessionRestoreStatus,
      ensureSessionRestoreCompleted
    } = useMatrixClient()

    await ensureSessionRestoreCompleted()

    expect(sessionRestoreStatus.value).toBe('failure')
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('initializes Rust crypto before starting client', async () => {
    const callOrder: string[] = []
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => {
        callOrder.push('initRustCrypto')
      }),
      startClient: vi.fn(() => {
        callOrder.push('startClient')
      })
    }

    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    expect(authClient.loginRequest).toHaveBeenCalledWith({
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: 'alice'
      },
      password: 'secret',
      device_id: undefined
    })
    expect(matrixClient.initRustCrypto).toHaveBeenCalledTimes(1)
    expect(matrixClient.startClient).toHaveBeenCalledWith({
      initialSyncLimit: 50
    })
    expect(callOrder).toEqual(['initRustCrypto', 'startClient'])
    expect(createClient).toHaveBeenNthCalledWith(2, {
      baseUrl: 'https://matrix.example.org',
      accessToken: 'token-123',
      userId: '@alice:example.org',
      deviceId: 'DEVICE123'
    })
  })

  it('continues startup when Rust crypto init fails', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => {
        throw new Error('wasm missing')
      }),
      startClient: vi.fn()
    }

    const consoleErrorSpy = vi.spyOn(console, 'error')
      .mockImplementation(() => undefined)
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    expect(matrixClient.startClient).toHaveBeenCalledWith({
      initialSyncLimit: 50
    })
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it('skips Rust crypto init when device id is missing', async () => {
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'token-123',
        user_id: '@alice:example.org'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn()
    }
    const consoleWarnSpy = vi.spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    expect(matrixClient.initRustCrypto).not.toHaveBeenCalled()
    expect(matrixClient.startClient).toHaveBeenCalledWith({
      initialSyncLimit: 50
    })
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    consoleWarnSpy.mockRestore()
  })

  it('reuses stored device id for next login request', async () => {
    localStorage.setItem('decentra.matrix.session.v1', JSON.stringify({
      baseUrl: 'https://matrix.example.org',
      accessToken: 'old-token',
      userId: '@alice:example.org',
      deviceId: 'DEVICE123'
    }))
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'new-token',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn()
    }
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    expect(authClient.loginRequest).toHaveBeenCalledWith({
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: 'alice'
      },
      password: 'secret',
      device_id: 'DEVICE123'
    })
  })

  it('reuses remembered device id without active session', async () => {
    localStorage.setItem('decentra.matrix.device.v1', JSON.stringify({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:example.org',
      deviceId: 'DEVICE123'
    }))
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'new-token',
        user_id: '@alice:example.org',
        device_id: 'DEVICE123'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn()
    }
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login } = useMatrixClient()
    await login('https://matrix.example.org', 'alice', 'secret')

    expect(authClient.loginRequest).toHaveBeenCalledWith({
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: 'alice'
      },
      password: 'secret',
      device_id: 'DEVICE123'
    })
  })

  it('does not reuse stored device id for other user', async () => {
    localStorage.setItem('decentra.matrix.session.v1', JSON.stringify({
      baseUrl: 'https://matrix.example.org',
      accessToken: 'old-token',
      userId: '@alice:example.org',
      deviceId: 'DEVICE123'
    }))
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'new-token',
        user_id: '@bob:example.org',
        device_id: 'DEVICE999'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn()
    }
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login } = useMatrixClient()
    await login('https://matrix.example.org', 'bob', 'secret')

    expect(authClient.loginRequest).toHaveBeenCalledWith({
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: 'bob'
      },
      password: 'secret',
      device_id: undefined
    })
  })

  it('does not reuse stored device id on other homeserver', async () => {
    localStorage.setItem('decentra.matrix.session.v1', JSON.stringify({
      baseUrl: 'https://matrix.example.org',
      accessToken: 'old-token',
      userId: '@alice:example.org',
      deviceId: 'DEVICE123'
    }))
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 'new-token',
        user_id: '@alice:other.org',
        device_id: 'DEVICE999'
      }))
    }
    const matrixClient = {
      initRustCrypto: vi.fn(async () => undefined),
      startClient: vi.fn()
    }
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login } = useMatrixClient()
    await login('https://other.example.org', 'alice', 'secret')

    expect(authClient.loginRequest).toHaveBeenCalledWith({
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: 'alice'
      },
      password: 'secret',
      device_id: undefined
    })
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
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

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
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)
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
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

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
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

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
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)
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
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)
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
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)
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
})
