import type { MatrixClient } from 'matrix-js-sdk'

import {
  buildUserPowerAssignments,
  compilePowerLevelsContent,
  DECENTRA_SPACE_ROLES_TYPE,
  type DecentraSpaceRolesContent,
} from '~/utils/decentraSpaceRoles'

const EMPTY_STATE_KEY = ''

export async function sendSpaceRolesState(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  content: DecentraSpaceRolesContent,
): Promise<void> {
  await matrixClient.sendStateEvent(
    spaceRoomId,
    DECENTRA_SPACE_ROLES_TYPE as Parameters<MatrixClient['sendStateEvent']>[1],
    content,
    EMPTY_STATE_KEY,
  )
}

export async function syncSpacePowerLevelsFromRoles(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  content: DecentraSpaceRolesContent,
): Promise<void> {
  const userAssignments = buildUserPowerAssignments(content)
  const powerLevelsBody = compilePowerLevelsContent(
    content.roles,
    userAssignments,
  )
  await matrixClient.sendStateEvent(
    spaceRoomId,
    'm.room.power_levels',
    powerLevelsBody,
    EMPTY_STATE_KEY,
  )
}

export async function saveSpaceRolesAndSyncPowerLevels(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  content: DecentraSpaceRolesContent,
): Promise<void> {
  await sendSpaceRolesState(matrixClient, spaceRoomId, content)
  await syncSpacePowerLevelsFromRoles(matrixClient, spaceRoomId, content)
}
