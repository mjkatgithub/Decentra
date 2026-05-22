import type { MatrixClient } from 'matrix-js-sdk'

import {
  buildUserPowerAssignments,
  compilePowerLevelsContent,
  type DecentraSpaceRolesContent,
} from '~/utils/decentraSpaceRoles'

const EMPTY_STATE_KEY = ''

export interface ChildRoomSyncResult {
  roomId: string
  success: boolean
  error?: string
}

export async function syncChildRoomPowerLevelsFromSpaceRoles(
  matrixClient: MatrixClient,
  content: DecentraSpaceRolesContent,
  childRoomIds: string[],
): Promise<ChildRoomSyncResult[]> {
  const userAssignments = buildUserPowerAssignments(content)
  const powerLevelsBody = compilePowerLevelsContent(
    content.roles,
    userAssignments,
  )
  const results: ChildRoomSyncResult[] = []
  for (const roomId of childRoomIds) {
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
