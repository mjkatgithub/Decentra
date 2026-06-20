import type { MatrixClient } from 'matrix-js-sdk'

import { canPerformSpaceMatrixAction } from '~/utils/matrixSpaceRolePermissions'
import { canUserInviteToRoom } from '~/utils/matrixRoomInvitePermissions'
import {
  canUserSetRoomAvatar,
  canUserSetRoomName,
  canUserSetRoomTopic,
} from '~/utils/matrixRoomMetadataPermissions'

/**
 * Invite to a channel: room power levels, or space-level invite when the
 * channel lives under that space (child rooms often use lower per-room PL).
 */
export function canUserInviteToChannel(
  matrixClient: MatrixClient | null,
  channelRoomId: string | null | undefined,
  userId: string | null | undefined,
  parentSpaceRoomId: string | null | undefined,
): boolean {
  if (canUserInviteToRoom(matrixClient, channelRoomId, userId)) {
    return true
  }
  if (
    !matrixClient ||
    !channelRoomId ||
    !userId ||
    !parentSpaceRoomId
  ) {
    return false
  }
  return canPerformSpaceMatrixAction(
    matrixClient,
    parentSpaceRoomId,
    userId,
    'inviteMembers',
    channelRoomId,
  )
}

export function canUserManageChannelMetadata(
  matrixClient: MatrixClient | null,
  roomId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!matrixClient || !roomId || !userId) {
    return false
  }
  return (
    canUserSetRoomName(matrixClient, roomId, userId) ||
    canUserSetRoomTopic(matrixClient, roomId, userId) ||
    canUserSetRoomAvatar(matrixClient, roomId, userId)
  )
}

export function isJoinedRoom(
  matrixClient: MatrixClient | null,
  roomId: string | null | undefined,
): boolean {
  if (!matrixClient || !roomId) {
    return false
  }
  const room = matrixClient.getRoom(roomId)
  return matrixRoomHasJoinedMembership(room)
}

export function matrixRoomHasJoinedMembership(
  room: { getMyMembership?: () => string } | null | undefined,
): boolean {
  return room?.getMyMembership?.() === 'join'
}
