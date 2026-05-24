import type { MatrixClient } from 'matrix-js-sdk'

import {
  buildUserPowerAssignmentsForRoom,
  compilePowerLevelsContent,
  type SpaceRolesState,
} from '~/utils/decentraSpaceRoles'
import { getPowerLevelsContent } from '~/utils/matrixPowerLevels'

const EMPTY_STATE_KEY = ''

export interface ChildRoomSyncResult {
  roomId: string
  success: boolean
  error?: string
}

export async function syncChildRoomPowerLevelsFromSpaceRoles(
  matrixClient: MatrixClient,
  content: SpaceRolesState,
  childRoomIds: string[],
  scrubPowerLevel?: number,
): Promise<ChildRoomSyncResult[]> {
  const results: ChildRoomSyncResult[] = []
  for (const roomId of childRoomIds) {
    const existing = getPowerLevelsContent(matrixClient, roomId)
    const userAssignments = buildUserPowerAssignmentsForRoom(
      matrixClient,
      roomId,
      content,
    )
    const powerLevelsBody = compilePowerLevelsContent(
      content.roles,
      userAssignments,
      existing,
      scrubPowerLevel,
    )
    try {
      await matrixClient.sendStateEvent(
        roomId,
        'm.room.power_levels',
        powerLevelsBody,
        EMPTY_STATE_KEY,
      )
      results.push({ roomId, success: true })
    } catch (thrownError) {
      const message =
        thrownError instanceof Error
          ? thrownError.message
          : String(thrownError)
      results.push({ roomId, success: false, error: message })
    }
  }
  return results
}
