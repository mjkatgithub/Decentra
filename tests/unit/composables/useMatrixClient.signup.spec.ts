import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMatrixSdkMock } from './matrixClientSdkMock'
import {
  setupFreshMatrixClientGlobals,
  setupMatrixClientTestGlobals,
} from './matrixClientTestSetup'

const matrixMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  initCryptoWasm: vi.fn(async () => undefined),
}))

vi.mock('matrix-js-sdk', () => buildMatrixSdkMock(matrixMocks.createClient))
vi.mock('@matrix-org/matrix-sdk-crypto-wasm', () => ({
  initAsync: matrixMocks.initCryptoWasm,
}))
vi.mock('~/utils/videoMetadata', () => ({
  readVideoMetadata: vi.fn(async () => ({
    durationMs: 5000,
    w: 640,
    h: 360,
  })),
  captureVideoThumbnail: vi.fn(async () => (
    new Blob(['thumb'], { type: 'image/jpeg' })
  )),
}))

const createClient = matrixMocks.createClient
const initCryptoWasm = matrixMocks.initCryptoWasm

describe('useMatrixClient signup', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setupMatrixClientTestGlobals()
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

})
