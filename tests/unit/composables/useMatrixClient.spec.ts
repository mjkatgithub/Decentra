import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()
const initCryptoWasm = vi.fn(async () => undefined)

vi.mock('matrix-js-sdk', () => {
  return {
    createClient,
    EventType: {
      RoomMessage: 'm.room.message',
      Direct: 'm.direct',
      RoomEncryption: 'm.room.encryption',
      RoomJoinRules: 'm.room.join_rules',
      RoomHistoryVisibility: 'm.room.history_visibility'
    },
    MsgType: { Text: 'm.text', Image: 'm.image' },
    ClientEvent: {},
    Preset: { PrivateChat: 'private_chat', PublicChat: 'public_chat' },
    JoinRule: { Invite: 'invite', Public: 'public' },
    Visibility: { Private: 'private', Public: 'public' }
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
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
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

  it('submits register request with normalized username', async () => {
    const authClient = {
      registerRequest: vi.fn(async () => ({ user_id: '@alice:example.org' }))
    }
    createClient.mockReturnValueOnce(authClient)

    const {
      useMatrixClient
    } = await import('~/composables/useMatrixClient')
    const { register } = useMatrixClient()
    await register('https://matrix.example.org', '@Alice:example.org', 'secret')

    expect(authClient.registerRequest).toHaveBeenCalledWith({
      username: 'alice',
      password: 'secret',
      auth: { type: 'm.login.dummy' },
      inhibit_login: true
    })
  })

  it('with email, starts UIA with register payload without auth', async () => {
    const authClient = {
      registerRequest: vi.fn(async () => ({ user_id: '@alice:example.org' }))
    }
    createClient.mockReturnValueOnce(authClient)

    const {
      useMatrixClient
    } = await import('~/composables/useMatrixClient')
    const { register } = useMatrixClient()
    await register(
      'https://matrix.example.org',
      '@Alice:example.org',
      'secret',
      'alice@example.org'
    )

    expect(authClient.registerRequest).toHaveBeenCalledWith({
      username: 'alice',
      password: 'secret',
      inhibit_login: true
    })
  })

  it('maps homeserver-disabled register API errors to REGISTER_API_CLOSED', async () => {
    const authClient = {
      registerRequest: vi.fn(async () => {
        throw new Error('Registration has been disabled')
      })
    }
    createClient.mockReturnValueOnce(authClient)

    const {
      SIGNUP_REGISTER_API_CLOSED_ERROR,
      useMatrixClient
    } = await import('~/composables/useMatrixClient')
    const { register } = useMatrixClient()

    await expect(
      register('https://matrix.example.org', 'alice', 'secret')
    ).rejects.toThrow(SIGNUP_REGISTER_API_CLOSED_ERROR)
  })

  it('persists UIA email signup state after 401 with session and email flow', async () => {
    const requestRegisterEmailToken = vi.fn(async () => ({ sid: 'sid-1' }))
    const authClient = {
      registerRequest: vi.fn(async () => {
        const stageError = new Error('Additional auth required') as Error & {
          data?: {
            session?: string
            flows?: Array<{ stages?: string[] }>
          }
        }
        stageError.data = {
          session: 'uia-session-1',
          flows: [
            { stages: ['m.login.email.identity'] }
          ]
        }
        throw stageError
      }),
      requestRegisterEmailToken
    }
    createClient.mockReturnValueOnce(authClient)

    const {
      SIGNUP_PENDING_STORAGE_KEY,
      useMatrixClient
    } = await import('~/composables/useMatrixClient')
    const { register } = useMatrixClient()

    await register(
      'https://matrix.example.org',
      'alice',
      'secret',
      'alice@example.org'
    )

    const raw = sessionStorage.getItem(SIGNUP_PENDING_STORAGE_KEY)
    expect(raw).toBeTruthy()
    const stored = raw ? JSON.parse(raw) as { session: string; sid: string } : null
    expect(stored?.session).toBe('uia-session-1')
    expect(stored?.sid).toBe('sid-1')
    expect(requestRegisterEmailToken).toHaveBeenCalledWith(
      'alice@example.org',
      expect.any(String),
      1,
      'http://localhost:3000/signup/verify-email'
    )
  })

  it('maps sdk http identity-server error to legacy email token path', async () => {
    const requestRegisterEmailToken = vi.fn(async () => ({ sid: 'sid-1' }))
    const authClient = {
      registerRequest: vi.fn(async () => {
        throw new Error("Cannot read properties of undefined (reading 'http')")
      }),
      requestRegisterEmailToken
    }
    createClient.mockReturnValueOnce(authClient)

    const {
      SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR,
      useMatrixClient
    } = await import('~/composables/useMatrixClient')
    const { register } = useMatrixClient()

    await expect(
      register(
        'https://matrix.example.org',
        'alice',
        'secret',
        'alice@example.org'
      )
    ).rejects.toThrow(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
    expect(requestRegisterEmailToken).toHaveBeenCalledWith(
      'alice@example.org',
      expect.any(String),
      1,
      'http://localhost:3000/signup/verify-email'
    )
  })

  it('finalize completes after email and dummy UIA stages', async () => {
    sessionStorage.setItem(
      'decentra.signup.pending.v1',
      JSON.stringify({
        v: 1,
        baseUrl: 'https://matrix.example.org',
        username: 'alice',
        password: 'secret',
        email: 'alice@example.org',
        clientSecret: 'csec',
        sid: 'sid-1',
        session: 'sess-p',
        initialSession: 'sess-p',
        flowStages: ['m.login.email.identity', 'm.login.dummy']
      })
    )
    const registerRequest = vi.fn()
      .mockImplementationOnce(async () => {
        const e = new Error('more') as Error & { data?: Record<string, unknown> }
        e.data = {
          session: 'sess-p',
          completed: ['m.login.email.identity'],
          flows: [
            { stages: ['m.login.email.identity', 'm.login.dummy'] }
          ]
        }
        throw e
      })
      .mockResolvedValueOnce({ user_id: '@alice:example.org' })
    const authClient = { registerRequest }
    createClient.mockReturnValueOnce(authClient)

    const {
      SIGNUP_PENDING_STORAGE_KEY,
      finalizeEmailRegistration,
      useMatrixClient
    } = await import('~/composables/useMatrixClient')
    useMatrixClient()
    await finalizeEmailRegistration()
    expect(registerRequest).toHaveBeenCalledTimes(2)
    expect(registerRequest).toHaveBeenNthCalledWith(1, {
      username: 'alice',
      password: 'secret',
      inhibit_login: true,
      auth: expect.objectContaining({
        type: 'm.login.email.identity',
        session: 'sess-p',
        threepid_creds: expect.objectContaining({
          client_secret: 'csec',
          sid: 'sid-1'
        })
      })
    })
    expect(registerRequest).toHaveBeenNthCalledWith(2, {
      username: 'alice',
      password: 'secret',
      inhibit_login: true,
      auth: {
        type: 'm.login.dummy',
        session: 'sess-p'
      }
    })
    expect(sessionStorage.getItem(SIGNUP_PENDING_STORAGE_KEY)).toBeNull()
  })

  it('finalize throws not confirmed when email is not yet verified', async () => {
    sessionStorage.setItem(
      'decentra.signup.pending.v1',
      JSON.stringify({
        v: 1,
        baseUrl: 'https://matrix.example.org',
        username: 'alice',
        password: 'secret',
        email: 'alice@example.org',
        clientSecret: 'csec',
        sid: 'sid-1',
        session: 'sess-p',
        initialSession: 'sess-p',
        flowStages: ['m.login.email.identity']
      })
    )
    const authClient = {
      registerRequest: vi.fn(async () => {
        const e = new Error('nope') as Error & { data?: Record<string, unknown> }
        e.data = { errcode: 'M_UNAUTHORIZED', error: 'nope' }
        throw e
      })
    }
    createClient.mockReturnValueOnce(authClient)

    const {
      SIGNUP_EMAIL_NOT_CONFIRMED_YET,
      finalizeEmailRegistration
    } = await import('~/composables/useMatrixClient')
    await expect(finalizeEmailRegistration()).rejects.toThrow(
      SIGNUP_EMAIL_NOT_CONFIRMED_YET
    )
  })

  it('finalize throws when no pending state exists', async () => {
    const { SIGNUP_PENDING_MISSING, finalizeEmailRegistration } =
      await import('~/composables/useMatrixClient')
    await expect(finalizeEmailRegistration()).rejects.toThrow(
      SIGNUP_PENDING_MISSING
    )
  })

  it('finalize throws session expired on unexpected session change', async () => {
    sessionStorage.setItem(
      'decentra.signup.pending.v1',
      JSON.stringify({
        v: 1,
        baseUrl: 'https://matrix.example.org',
        username: 'alice',
        password: 'secret',
        email: 'alice@example.org',
        clientSecret: 'csec',
        sid: 'sid-1',
        session: 'sess-p',
        initialSession: 'sess-p',
        flowStages: ['m.login.email.identity']
      })
    )
    const authClient = {
      registerRequest: vi.fn(async () => {
        const e = new Error('ui') as Error & { data?: Record<string, unknown> }
        e.data = {
          session: 'other-session',
          flows: [{ stages: ['m.login.email.identity'] }],
          errcode: 'M_FORBIDDEN',
          error: 'fail'
        }
        throw e
      })
    }
    createClient.mockReturnValueOnce(authClient)

    const {
      SIGNUP_SESSION_EXPIRED,
      finalizeEmailRegistration
    } = await import('~/composables/useMatrixClient')
    await expect(finalizeEmailRegistration()).rejects.toThrow(
      SIGNUP_SESSION_EXPIRED
    )
  })

  it('falls back to legacy register method when needed', async () => {
    const authClient = {
      register: vi.fn(async () => ({ user_id: '@alice:example.org' }))
    }
    createClient.mockReturnValueOnce(authClient)

    const {
      useMatrixClient
    } = await import('~/composables/useMatrixClient')
    const { register } = useMatrixClient()
    await register('https://matrix.example.org', 'alice', 'secret')

    expect(authClient.register).toHaveBeenCalledWith(
      'alice',
      'secret',
      undefined,
      { type: 'm.login.dummy' },
      undefined,
      undefined,
      true
    )
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
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

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
    createClient.mockReturnValueOnce(authClient)

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

describe('resolveHomeserverBaseUrlForClient', () => {
  it('upgrades http to https for public hostnames', async () => {
    const { resolveHomeserverBaseUrlForClient } =
      await import('~/composables/useMatrixClient')
    expect(
      resolveHomeserverBaseUrlForClient('http://matrix.moepg.de')
    ).toBe('https://matrix.moepg.de')
  })

  it('keeps http for localhost', async () => {
    const { resolveHomeserverBaseUrlForClient } =
      await import('~/composables/useMatrixClient')
    expect(
      resolveHomeserverBaseUrlForClient('http://localhost:8008')
    ).toBe('http://localhost:8008')
  })

  it('keeps http for private IPv4', async () => {
    const { resolveHomeserverBaseUrlForClient } =
      await import('~/composables/useMatrixClient')
    expect(
      resolveHomeserverBaseUrlForClient('http://192.168.1.5:8080')
    ).toBe('http://192.168.1.5:8080')
  })

  it('defaults scheme to https when omitted', async () => {
    const { resolveHomeserverBaseUrlForClient } =
      await import('~/composables/useMatrixClient')
    expect(resolveHomeserverBaseUrlForClient('matrix.org')).toBe(
      'https://matrix.org'
    )
  })
})

describe('normalizeMatrixUserId / matrix.to helpers', () => {
  it('normalizes localpart with default domain', async () => {
    const { normalizeMatrixUserId } =
      await import('~/composables/useMatrixClient')
    expect(normalizeMatrixUserId('bob', 'example.org')).toBe(
      '@bob:example.org'
    )
    expect(normalizeMatrixUserId('@bob:example.org', 'x')).toBe(
      '@bob:example.org'
    )
  })

  it('throws when domain is missing for localpart-only input', async () => {
    const { normalizeMatrixUserId } =
      await import('~/composables/useMatrixClient')
    expect(() => normalizeMatrixUserId('bob', '')).toThrow()
  })

  it('builds matrix.to link for a user id', async () => {
    const { buildMatrixToUserLink } =
      await import('~/composables/useMatrixClient')
    const link = buildMatrixToUserLink('@alice:example.org')
    expect(link).toContain('matrix.to')
    expect(link).toContain(encodeURIComponent('@alice:example.org'))
  })
})

describe('getOrCreateDirectMessageRoom', () => {
  it('reuses joined room from m.direct map', async () => {
    const createRoom = vi.fn()
    const matrixClient = {
      getUserId: () => '@alice:example.org',
      getAccountData: vi.fn(() => ({
        getContent: () => ({
          '@bob:example.org': ['!old:example.org']
        })
      })),
      getRoom: vi.fn((id: string) => {
        if (id !== '!old:example.org') {
          return null
        }
        return { getMyMembership: () => 'join' }
      }),
      createRoom,
      setAccountData: vi.fn(),
      startClient: vi.fn(),
      initRustCrypto: vi.fn(async () => undefined),
      getCrypto: () => null,
      getDeviceId: () => 'DEV'
    }
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 't',
        user_id: '@alice:example.org',
        device_id: 'DEV'
      }))
    }
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, getOrCreateDirectMessageRoom } = useMatrixClient()
    await login('https://example.org', 'alice', 'pw')
    const roomId = await getOrCreateDirectMessageRoom('@bob:example.org')
    expect(roomId).toBe('!old:example.org')
    expect(createRoom).not.toHaveBeenCalled()
  })

  it('creates room and merges m.direct when none exists', async () => {
    const createRoom = vi.fn(async () => ({ room_id: '!new:example.org' }))
    const setAccountData = vi.fn(async () => undefined)
    const matrixClient = {
      getUserId: () => '@alice:example.org',
      getAccountData: vi.fn(() => undefined),
      getRoom: vi.fn(() => null),
      createRoom,
      setAccountData,
      startClient: vi.fn(),
      initRustCrypto: vi.fn(async () => undefined),
      getCrypto: () => ({}),
      getDeviceId: () => 'DEV'
    }
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 't',
        user_id: '@alice:example.org',
        device_id: 'DEV'
      }))
    }
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, getOrCreateDirectMessageRoom } = useMatrixClient()
    await login('https://example.org', 'alice', 'pw')
    const roomId = await getOrCreateDirectMessageRoom('@bob:example.org')
    expect(roomId).toBe('!new:example.org')
    expect(createRoom).toHaveBeenCalled()
    expect(setAccountData).toHaveBeenCalled()
  })
})
