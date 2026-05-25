import type { MatrixClient } from 'matrix-js-sdk'

import {
  getPowerLevelsContent,
  getUserPowerLevelInRoomFromState,
  readNumericPowerLevel,
} from '~/utils/matrixPowerLevels'
import { isSpaceRoomFounder } from '~/utils/spaceRolesMatrixSync'

import { SPACE_CHILD_EVENT } from '~/utils/spaceRoomCategories'

const SPACE_CHILD_TYPE = SPACE_CHILD_EVENT

/**
 * Power level required to send `m.space.child` state on this room (space).
 * Uses events[m.space.child] if set, else state_default (Matrix spec).
 */
export function getRequiredPowerForSpaceChild(
  powerLevelsContent: Record<string, unknown> | null,
): number {
  if (!powerLevelsContent) {
    return 100
  }
  const events = powerLevelsContent.events as
    | Record<string, unknown>
    | undefined
  const specific = events?.[SPACE_CHILD_TYPE]
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

export { getUserPowerLevelInRoomFromState }

/**
 * True if the user may send `m.space.child` on this space room (reorder/move
 * children in the hierarchy). This is room state — changes apply for all
 * members once the homeserver accepts the event.
 */
export function canUserSendSpaceChildState(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  userId: string | null | undefined,
): boolean {
  if (!userId) {
    return false
  }
  const content = getPowerLevelsContent(matrixClient, spaceRoomId)
  if (!content) {
    return false
  }
  const myLevel = getUserPowerLevelInRoomFromState(content, userId)
  const required = getRequiredPowerForSpaceChild(content)
  return myLevel >= required
}

/** Founder or PL high enough to link/reorder m.space.child on this space. */
export function canManageSpaceChildren(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!matrixClient || !spaceRoomId || !userId) {
    return false
  }
  if (isSpaceRoomFounder(matrixClient, spaceRoomId, userId)) {
    return true
  }
  const roomState = matrixClient.getRoom(spaceRoomId)?.currentState
  if (roomState?.maySendStateEvent?.(SPACE_CHILD_EVENT, userId)) {
    return true
  }
  return canUserSendSpaceChildState(matrixClient, spaceRoomId, userId)
}
