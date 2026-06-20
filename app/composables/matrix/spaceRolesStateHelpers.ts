import type { MatrixClient } from 'matrix-js-sdk'

import {
  buildUserPowerAssignmentsForRoom,
  compilePowerLevelsContent,
  type SpaceRolesState,
} from '~/utils/decentraSpaceRoles'
import { getPowerLevelsContent } from '~/utils/matrixPowerLevels'
import { POWER_LEVEL_TAGS_STATE_TYPE } from '~/utils/matrixPowerLevelTagState'
import { buildPowerLevelTagsPayload } from '~/utils/spaceRolesMatrixSync'

const EMPTY_STATE_KEY = ''

export async function syncSpacePowerLevelsFromRoles(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  content: SpaceRolesState,
  scrubPowerLevel?: number,
): Promise<void> {
  const existing = getPowerLevelsContent(matrixClient, spaceRoomId)
  const userAssignments = buildUserPowerAssignmentsForRoom(
    matrixClient,
    spaceRoomId,
    content,
  )
  const powerLevelsBody = compilePowerLevelsContent(
    content.roles,
    userAssignments,
    existing,
    scrubPowerLevel,
  )
  await matrixClient.sendStateEvent(
    spaceRoomId,
    'm.room.power_levels',
    powerLevelsBody,
    EMPTY_STATE_KEY,
  )
}

export async function syncSpacePowerLevelTags(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  content: SpaceRolesState,
): Promise<void> {
  await matrixClient.sendStateEvent(
    spaceRoomId,
    POWER_LEVEL_TAGS_STATE_TYPE as Parameters<
      MatrixClient['sendStateEvent']
    >[1],
    buildPowerLevelTagsPayload(content),
    EMPTY_STATE_KEY,
  )
}

export async function saveSpaceRolesAndSyncPowerLevels(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  content: SpaceRolesState,
  scrubPowerLevel?: number,
): Promise<void> {
  await syncSpacePowerLevelsFromRoles(
    matrixClient,
    spaceRoomId,
    content,
    scrubPowerLevel,
  )
  await syncSpacePowerLevelTags(matrixClient, spaceRoomId, content)
}

export async function saveSpacePowerLevelsContent(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  powerLevelsBody: Record<string, unknown>,
): Promise<void> {
  await matrixClient.sendStateEvent(
    spaceRoomId,
    'm.room.power_levels',
    powerLevelsBody,
    EMPTY_STATE_KEY,
  )
}
