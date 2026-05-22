import type { MatrixClient } from 'matrix-js-sdk'

import {
  getSpaceRolesFromClient,
  resolveUserRole,
  type DecentraSpaceRolesContent,
  type SpaceRoleDefinition,
  type SpaceRolePermissions,
} from '~/utils/decentraSpaceRoles'

export type SpaceRoleAction =
  | keyof Omit<SpaceRolePermissions, 'visibleRoomIds'>
  | 'viewRoom'

export function getSpaceRolesContent(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null,
): DecentraSpaceRolesContent | null {
  if (!matrixClient || !spaceRoomId) {
    return null
  }
  return getSpaceRolesFromClient(matrixClient, spaceRoomId)
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
  return resolveUserRole(content, userId)
}

export function canPerformSpaceRoleAction(
  actorRole: SpaceRoleDefinition | null,
  action: SpaceRoleAction,
  targetRoomId?: string,
): boolean {
  if (!actorRole) {
    return true
  }
  if (action === 'viewRoom') {
    if (!targetRoomId) {
      return actorRole.permissions.viewSpace
    }
    const visible = actorRole.permissions.visibleRoomIds
    if (visible.length === 0) {
      return true
    }
    return visible.includes(targetRoomId)
  }
  const permissions = actorRole.permissions
  if (action in permissions) {
    return Boolean(permissions[action as keyof typeof permissions])
  }
  return false
}
