import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()
const initCryptoWasm = vi.fn(async () => undefined)

vi.mock('matrix-js-sdk', () => {
  return {
    createClient,
    EventType: { RoomMessage: 'm.room.message' },
    MsgType: { Text: 'm.text' },
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
    ;(globalThis as Record<string, unknown>).useState = (
      key: string,
      init: () => unknown
    ) => {
      if (key === 'matrix-client-restore-attempted') {
        return ref(true)
      }
      return ref(init())
    }
    ;(globalThis as Record<string, unknown>).computed = computed
    localStorage.clear()
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
})
