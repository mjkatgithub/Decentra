import type { MatrixClient } from 'matrix-js-sdk'

import {
  getPowerLevelsContent,
  getUserPowerLevelInRoomFromState,
  readNumericPowerLevel,
} from '~/utils/matrixPowerLevels'

export const PINNED_EVENTS_TYPE = 'm.room.pinned_events'

/**
 * Power level required to send `m.room.pinned_events` state.
 * Uses events[m.room.pinned_events] if set, else state_default.
 */
export function getRequiredPowerForPinnedEvents(
  powerLevelsContent: Record<string, unknown> | null,
): number {
  if (!powerLevelsContent) {
    return 100
  }
  const events = powerLevelsContent.events as
    | Record<string, unknown>
    | undefined
  const specific = events?.[PINNED_EVENTS_TYPE]
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

export function canUserPinEvents(
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
  const required = getRequiredPowerForPinnedEvents(content)
  return myLevel >= required
}
