import type { MatrixClient } from 'matrix-js-sdk'

import {
  getPowerLevelsContent,
  getUserPowerLevelInRoomFromState,
  readNumericPowerLevel,
} from '~/utils/matrixPowerLevels'

export function getRequiredPowerForInvite(
  powerLevelsContent: Record<string, unknown> | null,
): number {
  return readNumericPowerLevel(powerLevelsContent, 'invite') ?? 0
}

export function canUserInviteToRoom(
  matrixClient: MatrixClient | null,
  roomId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!matrixClient || !roomId || !userId) {
    return false
  }
  const room = matrixClient.getRoom(roomId)
  const mayInvite = (
    room as { currentState?: { mayInvite?: (id: string) => boolean } }
  )?.currentState?.mayInvite?.(userId)
  if (mayInvite === true) {
    return true
  }
  const content = getPowerLevelsContent(matrixClient, roomId)
  const myLevel = getUserPowerLevelInRoomFromState(content, userId)
  const required = getRequiredPowerForInvite(content)
  return myLevel >= required
}
