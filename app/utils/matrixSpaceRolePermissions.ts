import type { MatrixClient } from 'matrix-js-sdk'

import {
  getPowerLevelsContent,
  getRoomCreatorUserId,
  getUserPowerLevelInRoomFromState,
  readNumericPowerLevel,
} from '~/utils/matrixPowerLevels'
import { canUserPinEvents } from '~/utils/matrixRoomPinnedEventsPermissions'
import { canUserSendRoomMessage } from '~/utils/matrixRoomMessagePermissions'
import { canUserSendSpaceChildState } from '~/utils/matrixSpaceHierarchyPermissions'
import { canUserSetRoomAvatar } from '~/utils/matrixRoomMetadataPermissions'
import { POWER_LEVEL_TAGS_STATE_TYPE } from '~/utils/matrixPowerLevelTagState'

export type SpaceMatrixAction =
  | 'sendMessages'
  | 'pinMessages'
  | 'redactOthers'
  | 'reorderChannels'
  | 'manageSpaceProfile'
  | 'inviteMembers'
  | 'kickMembers'
  | 'manageRoles'

export function getActorPowerLevelInSpace(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null,
  userId: string | null | undefined,
): number {
  if (!matrixClient || !spaceRoomId || !userId) {
    return 0
  }
  const room = matrixClient.getRoom(spaceRoomId)
  const creator = getRoomCreatorUserId(matrixClient, spaceRoomId)
  if (creator === userId) {
    const content = getPowerLevelsContent(matrixClient, spaceRoomId)
    const users = content?.users as Record<string, number> | undefined
    const maxAssigned = users
      ? Math.max(0, ...Object.values(users))
      : 0
    const stateDefault = readNumericPowerLevel(content, 'state_default') ?? 0
    const tagRequired = requiredPowerForStateEvent(
      content,
      POWER_LEVEL_TAGS_STATE_TYPE,
    )
    const powerLevelsRequired = requiredPowerForStateEvent(
      content,
      'm.room.power_levels',
    )
    return Math.max(
      maxAssigned,
      stateDefault,
      tagRequired,
      powerLevelsRequired,
    ) + 1
  }
  const memberLevel = room?.getMember(userId)?.powerLevel
  if (typeof memberLevel === 'number' && Number.isFinite(memberLevel)) {
    return memberLevel
  }
  return getUserPowerLevelInRoomFromState(
    getPowerLevelsContent(matrixClient, spaceRoomId),
    userId,
  )
}

export function canManageSpaceRoles(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null,
  userId: string | null | undefined,
): boolean {
  if (!matrixClient || !spaceRoomId || !userId) {
    return false
  }
  if (getRoomCreatorUserId(matrixClient, spaceRoomId) === userId) {
    return true
  }
  const room = matrixClient.getRoom(spaceRoomId)
  const roomState = room?.currentState
  if (roomState?.maySendStateEvent) {
    const canEditPowerLevels = roomState.maySendStateEvent(
      'm.room.power_levels',
      userId,
    )
    const canEditTags = roomState.maySendStateEvent(
      POWER_LEVEL_TAGS_STATE_TYPE,
      userId,
    )
    if (canEditPowerLevels && canEditTags) {
      return true
    }
  }
  const actorLevel = getActorPowerLevelInSpace(
    matrixClient,
    spaceRoomId,
    userId,
  )
  const content = getPowerLevelsContent(matrixClient, spaceRoomId)
  const required = Math.max(
    requiredPowerForStateEvent(content, POWER_LEVEL_TAGS_STATE_TYPE),
    requiredPowerForStateEvent(content, 'm.room.power_levels'),
    readNumericPowerLevel(content, 'state_default') ?? 50,
  )
  return actorLevel >= required
}

function requiredPowerForStateEvent(
  content: Record<string, unknown> | null,
  eventType: string,
): number {
  if (!content) {
    return 100
  }
  const events = content.events as Record<string, unknown> | undefined
  const specific = events?.[eventType]
  if (typeof specific === 'number' && Number.isFinite(specific)) {
    return specific
  }
  return readNumericPowerLevel(content, 'state_default') ?? 50
}

export function canManageRolePowerLevel(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null,
  userId: string | null | undefined,
  targetPowerLevel: number,
): boolean {
  if (!canManageSpaceRoles(matrixClient, spaceRoomId, userId)) {
    return false
  }
  const actorLevel = getActorPowerLevelInSpace(
    matrixClient,
    spaceRoomId,
    userId,
  )
  return actorLevel > targetPowerLevel
}

export function canAssignUserToRolePowerLevel(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null,
  userId: string | null | undefined,
  targetPowerLevel: number,
): boolean {
  return canManageRolePowerLevel(
    matrixClient,
    spaceRoomId,
    userId,
    targetPowerLevel,
  )
}

export function canPerformSpaceMatrixAction(
  matrixClient: MatrixClient | null,
  spaceRoomId: string | null,
  userId: string | null | undefined,
  action: SpaceMatrixAction,
  targetRoomId?: string,
): boolean {
  if (!matrixClient || !spaceRoomId || !userId) {
    return true
  }
  if (action === 'reorderChannels') {
    return canUserSendSpaceChildState(matrixClient, spaceRoomId, userId)
  }
  if (action === 'manageSpaceProfile') {
    return canUserSetRoomAvatar(matrixClient, spaceRoomId, userId)
  }
  if (action === 'manageRoles') {
    return canManageSpaceRoles(matrixClient, spaceRoomId, userId)
  }
  const content = getPowerLevelsContent(matrixClient, spaceRoomId)
  const actorLevel = getActorPowerLevelInSpace(
    matrixClient,
    spaceRoomId,
    userId,
  )
  if (action === 'inviteMembers') {
    const required = readNumericPowerLevel(content, 'invite') ?? 0
    return actorLevel >= required
  }
  if (action === 'kickMembers') {
    const required = readNumericPowerLevel(content, 'kick') ?? 50
    return actorLevel >= required
  }
  if (action === 'redactOthers') {
    const required = readNumericPowerLevel(content, 'redact') ?? 50
    return actorLevel >= required
  }
  if (action === 'sendMessages') {
    if (targetRoomId) {
      return canUserSendRoomMessage(matrixClient, targetRoomId, userId)
    }
    const required = requiredPowerForStateEvent(content, 'm.room.message')
    return actorLevel >= required
  }
  if (action === 'pinMessages') {
    if (targetRoomId) {
      return canUserPinEvents(matrixClient, targetRoomId, userId)
    }
    const required = requiredPowerForStateEvent(content, 'm.room.pinned_events')
    return actorLevel >= required
  }
  return true
}
