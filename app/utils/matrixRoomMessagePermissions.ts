import type { MatrixClient } from 'matrix-js-sdk'

import {
  getPowerLevelsContent,
  getUserPowerLevelInRoomFromState,
  readNumericPowerLevel,
} from '~/utils/matrixPowerLevels'

const ROOM_MESSAGE_EVENT_TYPE = 'm.room.message'

export function getRequiredPowerForRoomMessage(
  powerLevelsContent: Record<string, unknown> | null,
): number {
  if (!powerLevelsContent) {
    return 0
  }
  const events = powerLevelsContent.events as
    | Record<string, unknown>
    | undefined
  const specific = events?.[ROOM_MESSAGE_EVENT_TYPE]
  if (typeof specific === 'number' && Number.isFinite(specific)) {
    return specific
  }
  const eventsDefault = readNumericPowerLevel(
    powerLevelsContent,
    'events_default',
  )
  if (eventsDefault !== undefined) {
    return eventsDefault
  }
  return 0
}

export function canUserSendRoomMessage(
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
  const required = getRequiredPowerForRoomMessage(content)
  return myLevel >= required
}
