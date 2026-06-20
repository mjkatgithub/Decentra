import { vi } from 'vitest'

export type AuthClientStub = {
  loginRequest: ReturnType<typeof vi.fn>
  registerRequest?: ReturnType<typeof vi.fn>
  register?: ReturnType<typeof vi.fn>
  requestRegisterEmailToken?: ReturnType<typeof vi.fn>
}

export type LoggedInClientStub = {
  initRustCrypto: ReturnType<typeof vi.fn>
  startClient: ReturnType<typeof vi.fn>
  setPresence: ReturnType<typeof vi.fn>
  getSyncState: ReturnType<typeof vi.fn>
  isInitialSyncComplete: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  sendEvent: ReturnType<typeof vi.fn>
  uploadContent: ReturnType<typeof vi.fn>
  getRoom: ReturnType<typeof vi.fn>
  getRooms: ReturnType<typeof vi.fn>
  getUserId: ReturnType<typeof vi.fn>
  getDeviceId: ReturnType<typeof vi.fn>
  getCrypto: ReturnType<typeof vi.fn>
  getAccountData: ReturnType<typeof vi.fn>
  setAccountData: ReturnType<typeof vi.fn>
  createRoom: ReturnType<typeof vi.fn>
  leave: ReturnType<typeof vi.fn>
  forget: ReturnType<typeof vi.fn>
  redactEvent: ReturnType<typeof vi.fn>
  sendReadReceipt: ReturnType<typeof vi.fn>
  setRoomReadMarkers: ReturnType<typeof vi.fn>
  [key: string]: unknown
}

const DEFAULT_LOGIN_RESPONSE = {
  access_token: 'token-123',
  user_id: '@alice:example.org',
  device_id: 'DEVICE123',
}

export function buildAuthClient(
  overrides: Partial<AuthClientStub> = {},
): AuthClientStub {
  return {
    loginRequest: vi.fn(async () => DEFAULT_LOGIN_RESPONSE),
    registerRequest: vi.fn(async () => ({ user_id: '@alice:example.org' })),
    register: vi.fn(async () => ({ user_id: '@alice:example.org' })),
    requestRegisterEmailToken: vi.fn(async () => ({ sid: 'sid-1' })),
    ...overrides,
  }
}

export function buildLoggedInClient(
  overrides: Partial<LoggedInClientStub> = {},
): LoggedInClientStub {
  const unencryptedRoom = {
    roomId: '!room:example.org',
    getMyMembership: () => 'join',
    getLiveTimeline: () => ({
      getEvents: () => [],
    }),
    getUnfilteredTimelineSet: () => ({
      getRelationsForEvent: () => ({
        getRelations: () => [],
      }),
    }),
    currentState: {
      getStateEvents: () => ({
        getContent: () => ({}),
      }),
    },
  }

  return {
    initRustCrypto: vi.fn(async () => undefined),
    startClient: vi.fn(async () => undefined),
    setPresence: vi.fn(async () => undefined),
    getSyncState: vi.fn(() => 'PREPARED'),
    isInitialSyncComplete: vi.fn(() => true),
    on: vi.fn(),
    off: vi.fn(),
    sendEvent: vi.fn(async () => ({ event_id: '$evt-1' })),
    uploadContent: vi.fn(async () => ({
      content_uri: 'mxc://example.org/media123',
    })),
    getRoom: vi.fn((roomId: string) => {
      if (roomId === '!room:example.org') {
        return unencryptedRoom
      }
      return null
    }),
    getRooms: vi.fn(() => []),
    getUserId: vi.fn(() => '@alice:example.org'),
    getDeviceId: vi.fn(() => 'DEVICE123'),
    getCrypto: vi.fn(() => null),
    getAccountData: vi.fn(() => undefined),
    setAccountData: vi.fn(async () => undefined),
    createRoom: vi.fn(async () => ({ room_id: '!new-space:example.org' })),
    leave: vi.fn(async () => undefined),
    forget: vi.fn(async () => undefined),
    redactEvent: vi.fn(async () => undefined),
    sendReadReceipt: vi.fn(async () => undefined),
    setRoomReadMarkers: vi.fn(async () => undefined),
    ...overrides,
  }
}

/**
 * First createClient call = auth; subsequent calls = logged-in client.
 */
export function installLoginFlow(
  createClientMock: ReturnType<typeof vi.fn>,
  clientOverrides: Partial<LoggedInClientStub> = {},
  authOverrides: Partial<AuthClientStub> = {},
): { authClient: AuthClientStub; matrixClient: LoggedInClientStub } {
  const authClient = buildAuthClient(authOverrides)
  const matrixClient = buildLoggedInClient(clientOverrides)
  let callCount = 0
  createClientMock.mockImplementation(() => {
    callCount += 1
    return callCount % 2 === 1 ? authClient : matrixClient
  })
  return { authClient, matrixClient }
}

/**
 * Merge partial stubs then wire createClient (odd = auth, even = matrix).
 */
export function installLoginFlowFromStubs(
  createClientMock: ReturnType<typeof vi.fn>,
  authPartial: Partial<AuthClientStub> = {},
  matrixPartial: Partial<LoggedInClientStub> = {},
) {
  const authClient = buildAuthClient(authPartial)
  const matrixClient = buildLoggedInClient(matrixPartial)
  let callCount = 0
  createClientMock.mockImplementation(() => {
    callCount += 1
    return callCount % 2 === 1 ? authClient : matrixClient
  })
  return { authClient, matrixClient }
}

/**
 * All createClient calls return the same auth/register client.
 */
export function installRegisterClient(
  createClientMock: ReturnType<typeof vi.fn>,
  authOverrides: Partial<AuthClientStub> = {},
): AuthClientStub {
  const authClient = buildAuthClient(authOverrides)
  createClientMock.mockImplementation(() => authClient)
  return authClient
}


/**
 * Login + import useMatrixClient (call after installLoginFlow overrides).
 */
export async function loginAndImport(
  createClientMock: ReturnType<typeof vi.fn>,
  clientOverrides: Partial<LoggedInClientStub> = {},
  authOverrides: Partial<AuthClientStub> = {},
) {
  const { authClient, matrixClient } = installLoginFlow(
    createClientMock,
    clientOverrides,
    authOverrides,
  )
  const { useMatrixClient } = await import('~/composables/useMatrixClient')
  const clientApi = useMatrixClient()
  await clientApi.login('https://matrix.example.org', 'alice', 'secret')
  return { clientApi, matrixClient, authClient }
}
