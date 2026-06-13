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

describe('useMatrixClient rooms', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setupMatrixClientTestGlobals()
    localStorage.clear()
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
  })

  describe('createMatrixSpace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function loginForSpaceCreate(
    createRoomImpl?: () => Promise<{ room_id: string }>,
  ) {
    const createRoom = vi.fn(
      createRoomImpl ??
        (async () => ({ room_id: '!new-space:example.org' })),
    )
    const matrixClient = {
      getUserId: () => '@alice:example.org',
      createRoom,
      startClient: vi.fn(),
      initRustCrypto: vi.fn(async () => undefined),
      getCrypto: () => null,
      getDeviceId: () => 'DEV',
    }
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 't',
        user_id: '@alice:example.org',
        device_id: 'DEV',
      })),
    }
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const clientApi = useMatrixClient()
    await clientApi.login('https://example.org', 'alice', 'pw')
    return { clientApi, createRoom }
  }

  it('creates a private space with m.space creation content', async () => {
    const { clientApi, createRoom } = await loginForSpaceCreate()
    const spaceId = await clientApi.createMatrixSpace({
      name: 'Team Space',
      visibility: 'private',
    })

    expect(spaceId).toBe('!new-space:example.org')
    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Team Space',
        visibility: 'private',
        creation_content: { type: 'm.space' },
      }),
    )
    const initialState = createRoom.mock.calls[0][0].initial_state
    expect(initialState).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'm.room.join_rules',
          content: { join_rule: 'invite' },
        }),
        expect.objectContaining({
          type: 'm.room.history_visibility',
          content: { history_visibility: 'invited' },
        }),
      ]),
    )
    expect(
      initialState.some(
        (event: { type: string }) => event.type === 'm.room.encryption',
      ),
    ).toBe(false)
  })

  it('creates a public space with topic', async () => {
    const { clientApi, createRoom } = await loginForSpaceCreate()
    await clientApi.createMatrixSpace({
      name: 'Open Space',
      topic: 'Welcome',
      visibility: 'public',
    })

    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Open Space',
        topic: 'Welcome',
        visibility: 'public',
      }),
    )
    const initialState = createRoom.mock.calls[0][0].initial_state
    expect(initialState).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'm.room.join_rules',
          content: { join_rule: 'public' },
        }),
        expect.objectContaining({
          type: 'm.room.history_visibility',
          content: { history_visibility: 'world_readable' },
        }),
      ]),
    )
  })

  it('rejects empty space name before createRoom', async () => {
    const { clientApi, createRoom } = await loginForSpaceCreate()

    await expect(
      clientApi.createMatrixSpace({ name: '   ', visibility: 'private' }),
    ).rejects.toThrow('Space name is required')
    expect(createRoom).not.toHaveBeenCalled()
  })

  it('filters self from invite list', async () => {
    const { clientApi, createRoom } = await loginForSpaceCreate()
    await clientApi.createMatrixSpace({
      name: 'Invited Space',
      visibility: 'private',
      inviteUserIds: [
        '@alice:example.org',
        '@bob:example.org',
      ],
    })

    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        invite: ['@bob:example.org'],
      }),
    )
  })

  it('maps transport failures to connection hint', async () => {
    const { clientApi } = await loginForSpaceCreate(async () => {
      throw new TypeError('Failed to fetch')
    })
    const { HOMESERVER_CONNECTION_HINT_ERROR } =
      await import('~/composables/useMatrixClient')

    await expect(
      clientApi.createMatrixSpace({
        name: 'Fail Space',
        visibility: 'private',
      }),
    ).rejects.toThrow(HOMESERVER_CONNECTION_HINT_ERROR)
  })

  it('maps matrix errors to create space message', async () => {
    const matrixError = {
      data: { errcode: 'M_CONFLICT' },
    }
    const { clientApi } = await loginForSpaceCreate(async () => {
      throw matrixError
    })

    await expect(
      clientApi.createMatrixSpace({
        name: 'Fail Space',
        visibility: 'private',
      }),
    ).rejects.toThrow('Could not create space')
  })

  it('links new space to parent when parentSpaceId is set', async () => {
    const { clientApi, createRoom } = await loginForSpaceCreate()
    const spaceStateHelpers = await import(
      '~/composables/matrix/spaceStateHelpers'
    )
    const waitForParent = await import('~/utils/waitForRoomSpaceParent')
    const moveMock = vi
      .spyOn(spaceStateHelpers, 'moveRoomBetweenParents')
      .mockResolvedValue(undefined)
    const waitMock = vi
      .spyOn(waitForParent, 'waitForRoomSpaceParentLink')
      .mockResolvedValue(undefined)
    await clientApi.createMatrixSpace({
      name: 'Child Space',
      visibility: 'private',
      parentSpaceId: '!parent:example.org',
      insertIndex: 2,
    })

    expect(createRoom).toHaveBeenCalled()
    expect(moveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: '!new-space:example.org',
        previousParentSpaceId: null,
        nextParentSpaceId: '!parent:example.org',
        insertIndex: 2,
      }),
    )
    expect(waitMock).toHaveBeenCalledWith(
      expect.anything(),
      '!new-space:example.org',
      '!parent:example.org',
    )
    moveMock.mockRestore()
    waitMock.mockRestore()
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

describe('leaveRoom via useMatrixClient', () => {
  it('delegates to matrix client leave', async () => {
    const leave = vi.fn(async () => undefined)
    const forget = vi.fn(async () => undefined)
    const matrixClient = {
      getUserId: () => '@alice:example.org',
      getAccountData: vi.fn(() => undefined),
      getRooms: vi.fn(() => []),
      getRoom: vi.fn(() => null),
      leave,
      forget,
      setAccountData: vi.fn(),
      startClient: vi.fn(),
      initRustCrypto: vi.fn(async () => undefined),
      getCrypto: () => null,
      getDeviceId: () => 'DEV',
    }
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 't',
        user_id: '@alice:example.org',
        device_id: 'DEV',
      })),
    }
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, leaveRoom } = useMatrixClient()
    await login('https://example.org', 'alice', 'pw')
    await leaveRoom('!room:example.org')
    expect(leave).toHaveBeenCalledWith('!room:example.org')
    expect(forget).toHaveBeenCalledWith('!room:example.org')
  })

  it('getRooms omits rooms the user has left', async () => {
    const joinedRoom = { roomId: '!joined:example.org', getMyMembership: () => 'join' }
    const leftRoom = { roomId: '!left:example.org', getMyMembership: () => 'leave' }
    const matrixClient = {
      getUserId: () => '@alice:example.org',
      getAccountData: vi.fn(() => undefined),
      getRooms: vi.fn(() => [joinedRoom, leftRoom]),
      getRoom: vi.fn(() => null),
      startClient: vi.fn(),
      initRustCrypto: vi.fn(async () => undefined),
      getCrypto: () => null,
      getDeviceId: () => 'DEV',
    }
    const authClient = {
      loginRequest: vi.fn(async () => ({
        access_token: 't',
        user_id: '@alice:example.org',
        device_id: 'DEV',
      })),
    }
    createClient
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(matrixClient)

    const { useMatrixClient } = await import('~/composables/useMatrixClient')
    const { login, getRooms } = useMatrixClient()
    await login('https://example.org', 'alice', 'pw')
    expect(getRooms().map((room) => room.roomId)).toEqual(['!joined:example.org'])
  })
})
})
