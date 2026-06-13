import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'
import {
  EventType,
  JoinRule,
  Preset,
  Visibility,
} from 'matrix-js-sdk'
import {
  pinRoomEvent as pinRoomEventState,
  unpinRoomEvent as unpinRoomEventState,
} from '~/utils/matrixRoomPinnedEvents'
import {
  clearRoomAvatar,
  setRoomAvatarFromMxc,
  setRoomName,
  setRoomTopic,
  uploadRoomAvatarFile,
} from '~/utils/matrixRoomMetadata'
import {
  saveSpaceRolesAndSyncPowerLevels,
} from '~/composables/matrix/spaceRolesStateHelpers'
import {
  syncChildRoomPowerLevelsFromSpaceRoles,
} from '~/composables/matrix/spaceRolesRoomSync'
import {
  setSpaceJoinRule,
  type SpaceAccessRule,
} from '~/utils/matrixSpaceGeneralSettings'
import {
  moveRoomBetweenParents,
  persistSpaceChildOrder,
} from '~/composables/matrix/spaceStateHelpers'
import { waitForRoomSpaceParentLink } from '~/utils/waitForRoomSpaceParent'
import {
  HOMESERVER_CONNECTION_HINT_ERROR,
  isTransportFailureWithoutMatrixBody,
} from './matrixClientShared'
import {
  homeserverFromUserId,
  mapPublicRoomsChunk,
  normalizeMatrixUserId,
  throwMappedMatrixError,
} from './matrixClientHelpers'
import type {
  CreateGroupRoomInput,
  CreateMatrixSpaceInput,
  InviteUsersToRoomResult,
  SearchPublicRoomsResult,
  UserDirectoryResultItem,
} from './matrixClientTypes'

function readDirectAccountContent(
  matrixClient: MatrixClient,
): Record<string, string[]> {
  const directEvent = matrixClient.getAccountData(EventType.Direct)
  return (directEvent?.getContent() as
    | Record<string, string[]>
    | undefined) ?? {}
}

export function isRoomListedInDirectAccountData(
  matrixClient: MatrixClient,
  roomId: string,
): boolean {
  const content = readDirectAccountContent(matrixClient)
  return Object.values(content).some((ids) => ids?.includes(roomId))
}

export async function removeDirectAccountData(
  matrixClient: MatrixClient,
  roomId: string,
): Promise<void> {
  const previous = readDirectAccountContent(matrixClient)
  let changed = false
  const next: Record<string, string[]> = {}
  for (const [peerUserId, roomIds] of Object.entries(previous)) {
    const filtered = (roomIds ?? []).filter((id) => id !== roomId)
    if (filtered.length !== (roomIds?.length ?? 0)) {
      changed = true
    }
    if (filtered.length > 0) {
      next[peerUserId] = filtered
    }
  }
  if (changed) {
    await matrixClient.setAccountData(EventType.Direct, next)
  }
}

export async function mergeDirectAccountData(
  matrixClient: MatrixClient,
  peerUserId: string,
  roomId: string,
): Promise<void> {
  const directEvent = matrixClient.getAccountData(EventType.Direct)
  const previous = (directEvent?.getContent() as
    | Record<string, string[]>
    | undefined) ?? {}
  const next: Record<string, string[]> = { ...previous }
  const existing = new Set(next[peerUserId] ?? [])
  existing.add(roomId)
  next[peerUserId] = [...existing]
  await matrixClient.setAccountData(EventType.Direct, next)
}

export function findJoinedDirectRoomId(
  matrixClient: MatrixClient,
  peerUserId: string,
): string | null {
  const directEvent = matrixClient.getAccountData(EventType.Direct)
  const content = directEvent?.getContent() as
    | Record<string, string[]>
    | undefined
  const candidates = content?.[peerUserId] ?? []
  for (const roomId of candidates) {
    const room = matrixClient.getRoom(roomId)
    if (room?.getMyMembership() === 'join') {
      return roomId
    }
  }
  return null
}

export async function getOrCreateDirectMessageRoom(
  matrixClient: MatrixClient,
  rawUserId: string,
  ensureCryptoReady: () => Promise<boolean>,
): Promise<string> {
  const selfId = matrixClient.getUserId()
  if (!selfId) {
    throw new Error('Not logged in')
  }
  const domain = homeserverFromUserId(selfId)
  const peerUserId = normalizeMatrixUserId(rawUserId, domain)
  if (peerUserId.toLowerCase() === selfId.toLowerCase()) {
    throw new Error('Cannot start a direct message with yourself')
  }
  const fromAccount = findJoinedDirectRoomId(matrixClient, peerUserId)
  if (fromAccount) {
    return fromAccount
  }
  const createOpts: sdk.ICreateRoomOpts = {
    invite: [peerUserId],
    preset: Preset.PrivateChat,
    is_direct: true,
  }
  if (await ensureCryptoReady()) {
    createOpts.initial_state = [
      {
        type: EventType.RoomEncryption,
        state_key: '',
        content: { algorithm: 'm.megolm.v1.aes-sha2' },
      },
    ]
  }
  try {
    const { room_id: roomId } = await matrixClient.createRoom(createOpts)
    await mergeDirectAccountData(matrixClient, peerUserId, roomId)
    return roomId
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    throwMappedMatrixError(error, 'Could not start direct message')
  }
}

export function buildRoomCreateInitialState(
  isPublic: boolean,
  includeEncryption: boolean,
): sdk.ICreateRoomOpts['initial_state'] {
  const encryptionReady = includeEncryption
  const encryptionState =
    encryptionReady
      ? [
          {
            type: EventType.RoomEncryption,
            state_key: '',
            content: { algorithm: 'm.megolm.v1.aes-sha2' },
          },
        ]
      : []
  return [
    {
      type: EventType.RoomJoinRules,
      state_key: '',
      content: {
        join_rule: isPublic ? JoinRule.Public : JoinRule.Invite,
      },
    },
    {
      type: EventType.RoomHistoryVisibility,
      state_key: '',
      content: {
        history_visibility: isPublic ? 'world_readable' : 'invited',
      },
    },
    ...encryptionState,
  ]
}

export async function linkRoomToParentSpace(
  matrixClient: MatrixClient,
  roomId: string,
  parentSpaceId: string,
  insertIndex?: number,
): Promise<void> {
  await moveChannelBetweenSpaceParents(matrixClient, {
    roomId,
    previousParentSpaceId: null,
    nextParentSpaceId: parentSpaceId,
    insertIndex,
  })
  await waitForRoomSpaceParentLink(matrixClient, roomId, parentSpaceId)
}

export async function createMatrixSpace(
  matrixClient: MatrixClient,
  input: CreateMatrixSpaceInput,
): Promise<string> {
  const trimmedName = input.name.trim()
  if (!trimmedName) {
    throw new Error('Space name is required')
  }
  const topic = input.topic?.trim()
  const isPublic = input.visibility === 'public'
  const selfId = matrixClient.getUserId()
  const inviteUserIds = (input.inviteUserIds ?? []).filter(
    (matrixUserId) =>
      !selfId ||
      matrixUserId.toLowerCase() !== selfId.toLowerCase(),
  )
  const createOpts: sdk.ICreateRoomOpts = {
    name: trimmedName,
    ...(topic ? { topic } : {}),
    visibility: isPublic ? Visibility.Public : Visibility.Private,
    creation_content: { type: 'm.space' },
    ...(inviteUserIds.length > 0 ? { invite: inviteUserIds } : {}),
    initial_state: buildRoomCreateInitialState(isPublic, false),
  }
  try {
    const { room_id: roomId } = await matrixClient.createRoom(createOpts)
    if (input.parentSpaceId) {
      await linkRoomToParentSpace(
        matrixClient,
        roomId,
        input.parentSpaceId,
        input.insertIndex,
      )
    }
    return roomId
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    throwMappedMatrixError(error, 'Could not create space')
  }
}

export async function createGroupRoom(
  matrixClient: MatrixClient,
  input: CreateGroupRoomInput,
  ensureCryptoReady: () => Promise<boolean>,
): Promise<string> {
  const trimmedName = input.name.trim()
  if (!trimmedName) {
    throw new Error('Room name is required')
  }
  const topic = input.topic?.trim()
  const isPublic = input.visibility === 'public'
  const encryptionReady = await ensureCryptoReady()
  const selfId = matrixClient.getUserId()
  const inviteUserIds = (input.inviteUserIds ?? []).filter(
    (matrixUserId) =>
      !selfId ||
      matrixUserId.toLowerCase() !== selfId.toLowerCase(),
  )
  const createOpts: sdk.ICreateRoomOpts = {
    name: trimmedName,
    ...(topic ? { topic } : {}),
    visibility: isPublic ? Visibility.Public : Visibility.Private,
    ...(isPublic ? { preset: Preset.PublicChat } : {}),
    is_direct: false,
    ...(inviteUserIds.length > 0 ? { invite: inviteUserIds } : {}),
    initial_state: buildRoomCreateInitialState(isPublic, encryptionReady),
  }
  try {
    const { room_id: roomId } = await matrixClient.createRoom(createOpts)
    if (input.parentSpaceId) {
      await linkRoomToParentSpace(
        matrixClient,
        roomId,
        input.parentSpaceId,
        input.insertIndex,
      )
    }
    return roomId
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    throwMappedMatrixError(error, 'Could not create room')
  }
}

export async function inviteUsersToRoom(
  matrixClient: MatrixClient,
  roomId: string,
  matrixUserIds: string[],
): Promise<InviteUsersToRoomResult> {
  const selfId = matrixClient.getUserId()?.toLowerCase()
  const invited: string[] = []
  const failed: InviteUsersToRoomResult['failed'] = []
  for (const matrixUserId of matrixUserIds) {
    if (selfId && matrixUserId.toLowerCase() === selfId) {
      continue
    }
    try {
      await matrixClient.invite(roomId, matrixUserId)
      invited.push(matrixUserId)
    } catch (error) {
      failed.push({
        userId: matrixUserId,
        error:
          error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { invited, failed }
}

export async function joinRoomByIdOrAlias(
  matrixClient: MatrixClient,
  roomIdOrAlias: string,
): Promise<string> {
  const trimmed = roomIdOrAlias.trim()
  if (!trimmed) {
    throw new Error('Room id or alias is required')
  }
  try {
    const room = await matrixClient.joinRoom(trimmed, {})
    return room.roomId
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    throwMappedMatrixError(error, 'Could not join room')
  }
}

export async function leaveRoom(
  matrixClient: MatrixClient,
  roomId: string,
): Promise<void> {
  const trimmed = roomId.trim()
  if (!trimmed) {
    throw new Error('Room id is required')
  }
  const shouldPruneDirect = isRoomListedInDirectAccountData(
    matrixClient,
    trimmed,
  )
  try {
    await matrixClient.leave(trimmed)
    if (shouldPruneDirect) {
      await removeDirectAccountData(matrixClient, trimmed)
    }
    try {
      await matrixClient.forget(trimmed)
    } catch {
      // Left rooms may linger until sync; getRooms() filters non-join.
    }
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    throwMappedMatrixError(error, 'Could not leave room')
  }
}

export async function searchPublicRooms(
  matrixClient: MatrixClient,
  options: {
    searchTerm?: string
    limit?: number
    since?: string
    server?: string
  },
): Promise<SearchPublicRoomsResult> {
  const limit = options.limit ?? 30
  const term = options.searchTerm?.trim()
  try {
    if (term) {
      const response = await matrixClient.publicRooms({
        server: options.server,
        limit,
        since: options.since,
        filter: { generic_search_term: term },
      })
      return {
        rooms: mapPublicRoomsChunk(
          (response.chunk ?? []) as unknown as Array<
            Record<string, unknown>
          >,
        ),
        nextBatch: response.next_batch,
        prevBatch: response.prev_batch,
        totalRoomCountEstimate: response.total_room_count_estimate,
      }
    }
    const response = await matrixClient.publicRooms({
      server: options.server,
      limit,
      since: options.since,
    })
    return {
      rooms: mapPublicRoomsChunk(
        (response.chunk ?? []) as unknown as Array<
          Record<string, unknown>
        >,
      ),
      nextBatch: response.next_batch,
      prevBatch: response.prev_batch,
      totalRoomCountEstimate: response.total_room_count_estimate,
    }
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    throwMappedMatrixError(
      error,
      'Could not load public rooms from this homeserver',
    )
  }
}

export async function searchUsersDirectory(
  matrixClient: MatrixClient,
  options: {
    term: string
    limit?: number
  },
): Promise<UserDirectoryResultItem[]> {
  const term = options.term.trim()
  if (term.length < 2) {
    return []
  }
  try {
    const response = await matrixClient.searchUserDirectory({
      term,
      limit: options.limit ?? 20,
    })
    return (response.results ?? []).map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    }))
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    throwMappedMatrixError(
      error,
      'User directory search is not available',
    )
  }
}

export async function reorderSpaceChildren(
  matrixClient: MatrixClient,
  parentSpaceId: string,
  orderedChildRoomIds: string[],
): Promise<void> {
  await persistSpaceChildOrder(
    matrixClient,
    parentSpaceId,
    orderedChildRoomIds,
  )
}

export async function moveChannelBetweenSpaceParents(
  matrixClient: MatrixClient,
  options: {
    roomId: string
    previousParentSpaceId: string | null
    nextParentSpaceId: string
    insertIndex?: number
  },
): Promise<void> {
  await moveRoomBetweenParents({ matrixClient, ...options })
}

export async function pinRoomEvent(
  matrixClient: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<void> {
  await pinRoomEventState(matrixClient, roomId, eventId)
}

export async function unpinRoomEvent(
  matrixClient: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<void> {
  await unpinRoomEventState(matrixClient, roomId, eventId)
}

export async function updateSpaceName(
  matrixClient: MatrixClient,
  spaceId: string,
  name: string,
): Promise<void> {
  await setRoomName(matrixClient, spaceId, name)
}

export async function updateSpaceTopic(
  matrixClient: MatrixClient,
  spaceId: string,
  topic: string,
): Promise<void> {
  await setRoomTopic(matrixClient, spaceId, topic)
}

export async function updateSpaceAvatar(
  matrixClient: MatrixClient,
  spaceId: string,
  imageFile: File,
): Promise<void> {
  const mxcUrl = await uploadRoomAvatarFile(matrixClient, imageFile)
  await setRoomAvatarFromMxc(matrixClient, spaceId, mxcUrl)
}

export async function removeSpaceAvatar(
  matrixClient: MatrixClient,
  spaceId: string,
): Promise<void> {
  await clearRoomAvatar(matrixClient, spaceId)
}

export async function updateSpaceJoinRule(
  matrixClient: MatrixClient,
  spaceId: string,
  joinRule: SpaceAccessRule,
): Promise<void> {
  await setSpaceJoinRule(matrixClient, spaceId, joinRule)
}

export async function upgradeSpaceRoom(
  matrixClient: MatrixClient,
  spaceId: string,
  targetVersion: string,
): Promise<void> {
  await matrixClient.upgradeRoom(spaceId, targetVersion)
}

export async function saveSpaceRoles(
  matrixClient: MatrixClient,
  spaceId: string,
  content: SpaceRolesState,
  childRoomIds: string[] = [],
  scrubPowerLevel?: number,
): Promise<void> {
  await saveSpaceRolesAndSyncPowerLevels(
    matrixClient,
    spaceId,
    content,
    scrubPowerLevel,
  )
  if (childRoomIds.length > 0) {
    await syncChildRoomPowerLevelsFromSpaceRoles(
      matrixClient,
      content,
      childRoomIds,
      scrubPowerLevel,
    )
  }
}
