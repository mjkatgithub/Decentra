import type { MatrixClient } from 'matrix-js-sdk'

import type { SpaceRoleDefinition, SpaceRolesState } from '~/utils/decentraSpaceRoles'
import {
  canPerformSpaceMatrixAction,
} from '~/utils/matrixSpaceRolePermissions'
import {
  resolveSpaceRolesFromClient,
  resolveUserRoleForSpace,
} from '~/utils/spaceRolesMatrixSync'

export type SpaceRoleAction =
  | 'sendMessages'
  | 'pinMessages'
  | 'redactOthers'
  | 'reorderChannels'
  | 'manageSpaceProfile'
  | 'inviteMembers'
  | 'kickMembers'
  | 'manageRoles'
  | 'viewRoom'

export function getSpaceRolesContent(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null,
): SpaceRolesState | null {
  if (!matrixClient || !spaceRoomId) {
    return null
  }
  return resolveSpaceRolesFromClient(matrixClient, spaceRoomId)
}

export function getActorRoleInSpace(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null,
  userId: string | null | undefined,
): SpaceRoleDefinition | null {
  const content = getSpaceRolesContent(matrixClient, spaceRoomId)
  if (!content) {
    return null
  }
  return resolveUserRoleForSpace(
    matrixClient,
    spaceRoomId,
    content,
    userId,
  )
}

export function canPerformSpaceRoleAction(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null,
  userId: string | null | undefined,
  action: SpaceRoleAction,
  targetRoomId?: string,
): boolean {
  return canPerformSpaceMatrixAction(
    matrixClient,
    spaceRoomId,
    userId,
    action,
    targetRoomId,
  )
}
