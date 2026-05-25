import type { MatrixClient, Room } from 'matrix-js-sdk'

export const ROOM_NAME_EVENT = 'm.room.name'
export const ROOM_TOPIC_EVENT = 'm.room.topic'
export const ROOM_AVATAR_EVENT = 'm.room.avatar'

const EMPTY_STATE_KEY = ''

function normalizeStateEvents(raw: unknown): Array<{
  getContent?: () => Record<string, unknown>
}> {
  if (!raw) {
    return []
  }
  return Array.isArray(raw) ? raw : [raw]
}

export function getRoomNameFromState(room: Room | null): string {
  const stateEvents = room?.currentState?.getStateEvents?.(
    ROOM_NAME_EVENT,
    EMPTY_STATE_KEY,
  )
  const list = normalizeStateEvents(stateEvents)
  const name = list[0]?.getContent?.()?.name
  return typeof name === 'string' ? name : ''
}

export function getRoomTopicFromState(room: Room | null): string {
  const stateEvents = room?.currentState?.getStateEvents?.(
    ROOM_TOPIC_EVENT,
    EMPTY_STATE_KEY,
  )
  const list = normalizeStateEvents(stateEvents)
  const topic = list[0]?.getContent?.()?.topic
  return typeof topic === 'string' ? topic : ''
}

export function getRoomAvatarMxcFromState(room: Room | null): string | null {
  const avatarMxcFromRoom = room?.getMxcAvatarUrl?.()
  if (typeof avatarMxcFromRoom === 'string' && avatarMxcFromRoom.length > 0) {
    return avatarMxcFromRoom
  }
  const stateEvents = room?.currentState?.getStateEvents?.(
    ROOM_AVATAR_EVENT,
    EMPTY_STATE_KEY,
  )
  const list = normalizeStateEvents(stateEvents)
  const url = list[0]?.getContent?.()?.url
  return typeof url === 'string' && url.length > 0 ? url : null
}

export function validateRoomName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return 'Room name is required'
  }
  if (trimmed.length > 255) {
    return 'Room name is too long'
  }
  return null
}

export async function setRoomName(
  matrixClient: MatrixClient,
  roomId: string,
  name: string,
): Promise<void> {
  const validationError = validateRoomName(name)
  if (validationError) {
    throw new Error(validationError)
  }
  await matrixClient.sendStateEvent(
    roomId,
    ROOM_NAME_EVENT as Parameters<MatrixClient['sendStateEvent']>[1],
    { name: name.trim() },
    EMPTY_STATE_KEY,
  )
}

export async function setRoomTopic(
  matrixClient: MatrixClient,
  roomId: string,
  topic: string,
): Promise<void> {
  await matrixClient.sendStateEvent(
    roomId,
    ROOM_TOPIC_EVENT as Parameters<MatrixClient['sendStateEvent']>[1],
    { topic: topic.trim() },
    EMPTY_STATE_KEY,
  )
}

export async function setRoomAvatarFromMxc(
  matrixClient: MatrixClient,
  roomId: string,
  mxcUrl: string,
): Promise<void> {
  await matrixClient.sendStateEvent(
    roomId,
    ROOM_AVATAR_EVENT as Parameters<MatrixClient['sendStateEvent']>[1],
    { url: mxcUrl },
    EMPTY_STATE_KEY,
  )
}

export async function clearRoomAvatar(
  matrixClient: MatrixClient,
  roomId: string,
): Promise<void> {
  await matrixClient.sendStateEvent(
    roomId,
    ROOM_AVATAR_EVENT as Parameters<MatrixClient['sendStateEvent']>[1],
    {},
    EMPTY_STATE_KEY,
  )
}

export async function uploadRoomAvatarFile(
  matrixClient: MatrixClient,
  imageFile: File,
): Promise<string> {
  const uploadResponse = await matrixClient.uploadContent(imageFile, {
    type: imageFile.type || 'image/png',
    includeFilename: true,
  })
  const contentUri = (uploadResponse as { content_uri?: string })?.content_uri
  if (typeof contentUri !== 'string' || !contentUri) {
    throw new Error('Avatar upload failed')
  }
  return contentUri
}
