import type { MatrixClient } from 'matrix-js-sdk'

import {
  createEveryoneRole,
  defaultRolePermissions,
  EVERYONE_ROLE_ID,
  getRoleById,
  type DecentraSpaceRolesContent,
  type SpaceRoleDefinition,
} from '~/utils/decentraSpaceRoles'
import { getPowerLevelsContent } from '~/utils/matrixPowerLevels'
import { POWER_LEVEL_TAGS_STATE_TYPE } from '~/utils/matrixPowerLevelTagState'

const DEFAULT_LEVEL_NAMES: Record<number, string> = {
  100: 'Admin',
  50: 'Moderator',
  0: 'Member',
}

export interface ExternalPowerLevelDefinition {
  name: string
  powerLevel: number
  color?: string
}

export function getMaxRolePowerLevel(
  roles: SpaceRoleDefinition[],
): number {
  if (roles.length === 0) {
    return 0
  }
  return Math.max(...roles.map((role) => role.powerLevel))
}

export function getOwnerEffectivePowerLevel(
  content: DecentraSpaceRolesContent,
): number {
  return getMaxRolePowerLevel(content.roles) + 1
}

export function getEffectiveUserPowerLevel(
  content: DecentraSpaceRolesContent,
  matrixUserId: string | null | undefined,
): number {
  if (!matrixUserId) {
    return 0
  }
  if (content.ownerUserId && content.ownerUserId === matrixUserId) {
    return getOwnerEffectivePowerLevel(content)
  }
  const role = getRoleById(
    content,
    content.assignments[matrixUserId] ?? content.everyoneRoleId,
  )
  return role?.powerLevel ?? 0
}

export function validateRolePowerLevelAgainstActor(
  powerLevel: number,
  content: DecentraSpaceRolesContent,
  actorUserId: string | null | undefined,
  roleId: string,
): string | null {
  if (!actorUserId) {
    return 'Not signed in'
  }
  if (content.ownerUserId === actorUserId) {
    return null
  }
  const actorLevel = getEffectiveUserPowerLevel(content, actorUserId)
  if (powerLevel >= actorLevel) {
    return 'Power level must be lower than your own'
  }
  return null
}

function parsePowerLevelTags(
  raw: Record<string, unknown> | null,
): ExternalPowerLevelDefinition[] {
  if (!raw) {
    return []
  }
  const parsed: ExternalPowerLevelDefinition[] = []
  for (const [key, value] of Object.entries(raw)) {
    const powerLevel = Number.parseInt(key, 10)
    if (!Number.isFinite(powerLevel)) {
      continue
    }
    if (!value || typeof value !== 'object') {
      continue
    }
    const record = value as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    if (!name) {
      continue
    }
    parsed.push({
      name,
      powerLevel,
      color: typeof record.color === 'string' ? record.color : undefined,
    })
  }
  return parsed
}

function findNumericPowersInRecord(
  record: Record<string, unknown>,
  powers: Set<number>,
): void {
  for (const value of Object.values(record)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      powers.add(value)
      continue
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      findNumericPowersInRecord(value as Record<string, unknown>, powers)
    }
  }
}

/** Member role PL values from m.room.power_levels (not event thresholds). */
export function collectRolePowerLevelsFromMatrix(
  powerLevelsContent: Record<string, unknown> | null,
): Set<number> {
  const levels = new Set<number>()
  if (!powerLevelsContent) {
    return levels
  }
  const users = powerLevelsContent.users as
    | Record<string, unknown>
    | undefined
  if (users) {
    for (const level of Object.values(users)) {
      if (typeof level === 'number' && Number.isFinite(level)) {
        levels.add(level)
      }
    }
  }
  const usersDefault = powerLevelsContent.users_default
  if (typeof usersDefault === 'number' && Number.isFinite(usersDefault)) {
    levels.add(usersDefault)
  }
  return levels
}

/** All numeric PL values in m.room.power_levels (including event thresholds). */
export function collectUsedPowerLevels(
  powerLevelsContent: Record<string, unknown> | null,
): Set<number> {
  const levels = new Set<number>()
  if (!powerLevelsContent) {
    return levels
  }
  findNumericPowersInRecord(powerLevelsContent, levels)
  return levels
}

export function readPowerLevelTagDefinitions(
  matrixClient: MatrixClient,
  spaceRoomId: string,
): ExternalPowerLevelDefinition[] {
  const room = matrixClient.getRoom(spaceRoomId)
  const stateEvents = room?.currentState?.getStateEvents?.(
    POWER_LEVEL_TAGS_STATE_TYPE,
    '',
  )
  const rawList = Array.isArray(stateEvents) ? stateEvents : stateEvents
    ? [stateEvents]
    : []
  const first = rawList[0]
  const content = first?.getContent?.() as Record<string, unknown> | undefined
  return parsePowerLevelTags(content ?? null)
}

function fallbackNameForPowerLevel(
  powerLevel: number,
  tagged: ExternalPowerLevelDefinition[],
): string {
  const match = tagged.find((entry) => entry.powerLevel === powerLevel)
  if (match) {
    return match.name
  }
  return DEFAULT_LEVEL_NAMES[powerLevel] ?? `Level ${powerLevel}`
}

function buildRoleFromPowerLevel(
  powerLevel: number,
  tagged: ExternalPowerLevelDefinition[],
  overlay: DecentraSpaceRolesContent | null,
): SpaceRoleDefinition {
  const tag = tagged.find((entry) => entry.powerLevel === powerLevel)
  const overlayRole = overlay?.roles.find(
    (role) => role.powerLevel === powerLevel,
  )
  const isEveryoneLevel = powerLevel === 0
  return {
    id: overlayRole?.id ?? (isEveryoneLevel ? EVERYONE_ROLE_ID : `pl_${powerLevel}`),
    name: tag?.name ?? overlayRole?.name ?? fallbackNameForPowerLevel(powerLevel, tagged),
    color: tag?.color ?? overlayRole?.color ?? '#5865f2',
    position: powerLevel,
    powerLevel,
    isEveryone: isEveryoneLevel ? true : undefined,
    permissions: overlayRole?.permissions ?? defaultRolePermissions(),
  }
}

function mergeAssignmentsFromPowerLevels(
  overlay: DecentraSpaceRolesContent | null,
  powerLevelsContent: Record<string, unknown> | null,
  roles: SpaceRoleDefinition[],
): Record<string, string> {
  const assignments = { ...(overlay?.assignments ?? {}) }
  const users = powerLevelsContent?.users as
    | Record<string, number>
    | undefined
  if (!users) {
    return assignments
  }
  for (const [assignedUserId, level] of Object.entries(users)) {
    const role = roles.find((entry) => entry.powerLevel === level)
    if (role) {
      assignments[assignedUserId] = role.id
    }
  }
  return assignments
}

/**
 * Build roles from Matrix PL + tag metadata (same sources as Cinny/Sable).
 * decentraOverlay supplies Decentra-only permissions and assignments.
 */
export function buildRolesFromMatrixPowerLevels(
  powerLevelsContent: Record<string, unknown> | null,
  tagDefinitions: ExternalPowerLevelDefinition[],
  decentraOverlay: DecentraSpaceRolesContent | null,
): DecentraSpaceRolesContent {
  const usedLevels = collectUsedPowerLevels(powerLevelsContent)
  for (const tag of tagDefinitions) {
    usedLevels.add(tag.powerLevel)
  }

  const powerLevels = [...usedLevels].sort((levelA, levelB) => levelB - levelA)
  const roles: SpaceRoleDefinition[] = []

  for (const powerLevel of powerLevels) {
    if (powerLevel === 0) {
      const everyone = buildRoleFromPowerLevel(0, tagDefinitions, decentraOverlay)
      roles.push({
        ...createEveryoneRole(),
        ...everyone,
        isEveryone: true,
        id: EVERYONE_ROLE_ID,
      })
      continue
    }
    roles.push(buildRoleFromPowerLevel(powerLevel, tagDefinitions, decentraOverlay))
  }

  if (!roles.some((role) => role.isEveryone)) {
    roles.push(createEveryoneRole())
  }

  const assignments = mergeAssignmentsFromPowerLevels(
    decentraOverlay,
    powerLevelsContent,
    roles,
  )

  return {
    version: 1,
    roles,
    assignments,
    everyoneRoleId: EVERYONE_ROLE_ID,
    ownerUserId: decentraOverlay?.ownerUserId,
  }
}

export function buildPowerLevelTagsPayload(
  content: DecentraSpaceRolesContent,
): Record<string, { name: string; color?: string }> {
  const payload: Record<string, { name: string; color?: string }> = {}
  for (const role of content.roles) {
    payload[String(role.powerLevel)] = {
      name: role.name,
      color: role.color,
    }
  }
  return payload
}

export function resolveSpaceRolesFromClient(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  parsedDecentra: DecentraSpaceRolesContent | null,
): DecentraSpaceRolesContent | null {
  const powerLevelsContent = getPowerLevelsContent(matrixClient, spaceRoomId)
  const tagDefinitions = readPowerLevelTagDefinitions(
    matrixClient,
    spaceRoomId,
  )
  if (!powerLevelsContent && tagDefinitions.length === 0 && !parsedDecentra) {
    return null
  }
  return buildRolesFromMatrixPowerLevels(
    powerLevelsContent,
    tagDefinitions,
    parsedDecentra,
  )
}

export function inferOwnerUserId(
  content: DecentraSpaceRolesContent,
  powerLevelsContent: Record<string, unknown> | null,
): string | undefined {
  if (content.ownerUserId) {
    return content.ownerUserId
  }
  const users = powerLevelsContent?.users as
    | Record<string, number>
    | undefined
  if (!users) {
    return Object.keys(content.assignments)[0]
  }
  const maxLevel = Math.max(...Object.values(users))
  const ownerEntry = Object.entries(users).find(
    ([, level]) => level === maxLevel,
  )
  return ownerEntry?.[0] ?? Object.keys(content.assignments)[0]
}

/** @deprecated use buildRolesFromMatrixPowerLevels */
export function mergeMatrixPowerLevelsIntoRoles(
  content: DecentraSpaceRolesContent | null,
  powerLevelsContent: Record<string, unknown> | null,
  externalDefinitions: ExternalPowerLevelDefinition[],
): DecentraSpaceRolesContent | null {
  return buildRolesFromMatrixPowerLevels(
    powerLevelsContent,
    externalDefinitions,
    content,
  )
}
