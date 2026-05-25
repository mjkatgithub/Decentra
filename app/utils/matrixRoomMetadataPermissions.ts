import type { MatrixClient } from 'matrix-js-sdk'

import {
  getPowerLevelsContent,
  getUserPowerLevelInRoomFromState,
  readNumericPowerLevel,
} from '~/utils/matrixPowerLevels'

import {
  ROOM_AVATAR_EVENT,
  ROOM_NAME_EVENT,
  ROOM_TOPIC_EVENT,
} from '~/utils/matrixRoomMetadata'

function getRequiredPowerForStateEvent(
  powerLevelsContent: Record<string, unknown> | null,
  eventType: string,
): number {
  if (!powerLevelsContent) {
    return 100
  }
  const events = powerLevelsContent.events as
    | Record<string, unknown>
    | undefined
  const specific = events?.[eventType]
  if (typeof specific === 'number' && Number.isFinite(specific)) {
    return specific
  }
  const stateDefault = readNumericPowerLevel(
    powerLevelsContent,
    'state_default',
  )
  if (stateDefault !== undefined) {
    return stateDefault
  }
  return 50
}

export function canUserSetRoomName(
  matrixClient: MatrixClient,
  roomId: string,
  userId: string | null | undefined,
): boolean {
  if (!userId) {
    return false
  }
  const content = getPowerLevelsContent(matrixClient, roomId)
  if (!content) {
    return false
  }
  const myLevel = getUserPowerLevelInRoomFromState(content, userId)
  const required = getRequiredPowerForStateEvent(content, ROOM_NAME_EVENT)
  return myLevel >= required
}

export function canUserSetRoomTopic(
  matrixClient: MatrixClient,
  roomId: string,
  userId: string | null | undefined,
): boolean {
  if (!userId) {
    return false
  }
  const content = getPowerLevelsContent(matrixClient, roomId)
  if (!content) {
    return false
  }
  const myLevel = getUserPowerLevelInRoomFromState(content, userId)
  const required = getRequiredPowerForStateEvent(content, ROOM_TOPIC_EVENT)
  return myLevel >= required
}

export function canUserSetRoomAvatar(
  matrixClient: MatrixClient,
  roomId: string,
  userId: string | null | undefined,
): boolean {
  if (!userId) {
    return false
  }
  const content = getPowerLevelsContent(matrixClient, roomId)
  if (!content) {
    return false
  }
  const myLevel = getUserPowerLevelInRoomFromState(content, userId)
  const required = getRequiredPowerForStateEvent(content, ROOM_AVATAR_EVENT)
  return myLevel >= required
}
