import type { MatrixClient } from 'matrix-js-sdk'

import {
  createDefaultSpacePowerLevels,
  mergeUsersIntoPowerLevels,
  scrubPowerLevelFromContent,
} from '~/utils/matrixSpacePowerLevelSettings'
import { getRoomCreatorUserId } from '~/utils/matrixPowerLevels'

export const EVERYONE_ROLE_ID = '__everyone__'
export const FOUNDER_ROLE_ID = '__founder__'

export interface SpaceRoleDefinition {
  id: string
  name: string
  color: string
  position: number
  powerLevel: number
  isEveryone?: boolean
  isFounder?: boolean
}

export interface SpaceRolesState {
  roles: SpaceRoleDefinition[]
  assignments: Record<string, string>
  everyoneRoleId: string
  ownerUserId?: string
}

/** @deprecated use SpaceRolesState */
export type DecentraSpaceRolesContent = SpaceRolesState

export function createEveryoneRole(): SpaceRoleDefinition {
  return {
    id: EVERYONE_ROLE_ID,
    name: 'Member',
    color: '#99aab5',
    position: 0,
    powerLevel: 0,
    isEveryone: true,
  }
}

export function createFounderRole(): SpaceRoleDefinition {
  return {
    id: FOUNDER_ROLE_ID,
    name: 'Founder',
    color: '#5865f2',
    position: 10_000,
    powerLevel: 10_000,
    isFounder: true,
  }
}

export function createFullAdminRole(
  name: string,
  position: number,
  powerLevel: number,
): SpaceRoleDefinition {
  return {
    id: `pl_${powerLevel}`,
    name: name.trim() || 'Admin',
    color: '#5865f2',
    position,
    powerLevel,
  }
}

export function createInitialSpaceRolesContent(
  creatorUserId: string,
  creatorRoleName = 'Admin',
): SpaceRolesState {
  const everyone = createEveryoneRole()
  const admin = createFullAdminRole(creatorRoleName, 100, 100)
  return {
    roles: [everyone, admin],
    assignments: { [creatorUserId]: admin.id },
    everyoneRoleId: EVERYONE_ROLE_ID,
    ownerUserId: creatorUserId,
  }
}

export function sortRolesByPositionDesc(
  roles: SpaceRoleDefinition[],
): SpaceRoleDefinition[] {
  return [...roles].sort((roleA, roleB) => roleB.position - roleA.position)
}

export function getRoleById(
  content: SpaceRolesState,
  roleId: string,
): SpaceRoleDefinition | null {
  return content.roles.find((role) => role.id === roleId) ?? null
}

export function getRoleByPowerLevel(
  content: SpaceRolesState,
  powerLevel: number,
): SpaceRoleDefinition | null {
  return (
    content.roles.find((role) => role.powerLevel === powerLevel) ?? null
  )
}

export function resolveUserRole(
  content: SpaceRolesState,
  userId: string | null | undefined,
): SpaceRoleDefinition {
  if (!userId) {
    return (
      getRoleById(content, content.everyoneRoleId) ?? createEveryoneRole()
    )
  }
  const assignedId = content.assignments[userId]
  if (assignedId) {
    const assigned = getRoleById(content, assignedId)
    if (assigned) {
      return assigned
    }
  }
  return (
    getRoleById(content, content.everyoneRoleId) ?? createEveryoneRole()
  )
}

export function buildUserPowerAssignments(
  content: SpaceRolesState,
  excludeUserIds: string[] = [],
): Record<string, number> {
  const excluded = new Set(excludeUserIds)
  const users: Record<string, number> = {}
  for (const [assignedUserId, roleId] of Object.entries(content.assignments)) {
    if (excluded.has(assignedUserId)) {
      continue
    }
    const role = getRoleById(content, roleId)
    if (role) {
      users[assignedUserId] = role.powerLevel
    }
  }
  return users
}

export function compilePowerLevelsContent(
  roles: SpaceRoleDefinition[],
  userAssignments: Record<string, number>,
  existing: Record<string, unknown> | null = null,
  scrubPowerLevel?: number,
): Record<string, unknown> {
  const maxRoleLevel = Math.max(...roles.map((role) => role.powerLevel), 100)
  let base = existing ?? createDefaultSpacePowerLevels(maxRoleLevel)
  if (scrubPowerLevel !== undefined) {
    base = scrubPowerLevelFromContent(base, scrubPowerLevel)
  }
  return mergeUsersIntoPowerLevels(base, userAssignments, maxRoleLevel)
}

export function canAssignRole(
  actorPowerLevel: number,
  targetPowerLevel: number,
  canManage: boolean,
): boolean {
  if (!canManage) {
    return false
  }
  return actorPowerLevel > targetPowerLevel
}

export function canManageRoleDefinition(
  actorPowerLevel: number,
  targetPowerLevel: number,
  canManage: boolean,
  targetIsEveryone = false,
): boolean {
  if (targetIsEveryone) {
    return canManage
  }
  if (!canManage) {
    return false
  }
  return actorPowerLevel > targetPowerLevel
}

export function validateRoleName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return 'Role name is required'
  }
  if (trimmed.length > 100) {
    return 'Role name is too long'
  }
  return null
}

export function validateRolePowerLevel(
  powerLevel: number,
  roles: SpaceRoleDefinition[],
  roleId: string,
): string | null {
  if (!Number.isFinite(powerLevel) || !Number.isInteger(powerLevel)) {
    return 'Power level must be a whole number'
  }
  if (powerLevel < -100 || powerLevel > 1000) {
    return 'Power level must be between -100 and 1000'
  }
  const duplicate = roles.find(
    (role) => role.id !== roleId && role.powerLevel === powerLevel,
  )
  if (duplicate) {
    return 'Power level must be unique for each role'
  }
  return null
}

export function buildUserPowerAssignmentsForRoom(
  matrixClient: MatrixClient,
  roomId: string,
  content: SpaceRolesState,
): Record<string, number> {
  const creatorUserId = getRoomCreatorUserId(matrixClient, roomId)
  const excludeUserIds = creatorUserId ? [creatorUserId] : []
  return buildUserPowerAssignments(content, excludeUserIds)
}
