import type { MatrixClient } from 'matrix-js-sdk'

import { SPACE_CHILD_EVENT } from '~/utils/spaceRoomCategories'
import { POWER_LEVEL_TAGS_STATE_TYPE } from '~/utils/matrixPowerLevelTagState'

export const DECENTRA_SPACE_ROLES_TYPE = 'decentra.space.roles'
export const EVERYONE_ROLE_ID = '__everyone__'

export interface SpaceRolePermissions {
  viewSpace: boolean
  manageSpaceProfile: boolean
  reorderChannels: boolean
  manageChannels: boolean
  manageCategories: boolean
  inviteMembers: boolean
  kickMembers: boolean
  banMembers: boolean
  manageRoles: boolean
  assignRolesBelowOnly: boolean
  sendMessages: boolean
  sendThreads: boolean
  attachFiles: boolean
  addReactions: boolean
  pinMessages: boolean
  redactOthers: boolean
  editOwnMessages: boolean
  mentionEveryone: boolean
  visibleRoomIds: string[]
}

export interface SpaceRoleDefinition {
  id: string
  name: string
  color: string
  position: number
  powerLevel: number
  permissions: SpaceRolePermissions
  isEveryone?: boolean
}

export interface DecentraSpaceRolesContent {
  version: 1
  roles: SpaceRoleDefinition[]
  assignments: Record<string, string>
  everyoneRoleId: string
  /** Space creator — always receives max(role PL) + 1 in Matrix PL sync */
  ownerUserId?: string
}

export function defaultRolePermissions(
  overrides: Partial<SpaceRolePermissions> = {},
): SpaceRolePermissions {
  return {
    viewSpace: true,
    manageSpaceProfile: false,
    reorderChannels: false,
    manageChannels: false,
    manageCategories: false,
    inviteMembers: false,
    kickMembers: false,
    banMembers: false,
    manageRoles: false,
    assignRolesBelowOnly: true,
    sendMessages: true,
    sendThreads: true,
    attachFiles: true,
    addReactions: true,
    pinMessages: false,
    redactOthers: false,
    editOwnMessages: true,
    mentionEveryone: false,
    visibleRoomIds: [],
    ...overrides,
  }
}

export function createEveryoneRole(): SpaceRoleDefinition {
  return {
    id: EVERYONE_ROLE_ID,
    name: '@everyone',
    color: '#99aab5',
    position: 0,
    powerLevel: 0,
    isEveryone: true,
    permissions: defaultRolePermissions({
      viewSpace: true,
      sendMessages: true,
      visibleRoomIds: [],
    }),
  }
}

export function createFullAdminRole(
  name: string,
  position: number,
  powerLevel: number,
): SpaceRoleDefinition {
  return {
    id: `role_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`,
    name: name.trim() || 'Admin',
    color: '#e74c3c',
    position,
    powerLevel,
    permissions: defaultRolePermissions({
      viewSpace: true,
      manageSpaceProfile: true,
      reorderChannels: true,
      manageChannels: true,
      manageCategories: true,
      inviteMembers: true,
      kickMembers: true,
      banMembers: true,
      manageRoles: true,
      assignRolesBelowOnly: false,
      sendMessages: true,
      pinMessages: true,
      redactOthers: true,
      mentionEveryone: true,
      visibleRoomIds: [],
    }),
  }
}

export function createInitialSpaceRolesContent(
  creatorUserId: string,
  creatorRoleName = 'Admin',
): DecentraSpaceRolesContent {
  const everyone = createEveryoneRole()
  const admin = createFullAdminRole(creatorRoleName, 100, 100)
  return {
    version: 1,
    roles: [everyone, admin],
    assignments: { [creatorUserId]: admin.id },
    everyoneRoleId: EVERYONE_ROLE_ID,
    ownerUserId: creatorUserId,
  }
}

export function parseSpaceRolesContent(
  raw: Record<string, unknown> | null | undefined,
): DecentraSpaceRolesContent | null {
  if (!raw || raw.version !== 1) {
    return null
  }
  const rolesRaw = raw.roles
  if (!Array.isArray(rolesRaw)) {
    return null
  }
  const roles: SpaceRoleDefinition[] = []
  for (const entry of rolesRaw) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const role = entry as Record<string, unknown>
    const id = typeof role.id === 'string' ? role.id : ''
    const name = typeof role.name === 'string' ? role.name : ''
    if (!id || !name) {
      continue
    }
    const permissionsRaw = role.permissions as
      | Record<string, unknown>
      | undefined
    const visibleRoomIds = Array.isArray(permissionsRaw?.visibleRoomIds)
      ? permissionsRaw.visibleRoomIds.filter(
          (roomId): roomId is string => typeof roomId === 'string',
        )
      : []
    roles.push({
      id,
      name,
      color: typeof role.color === 'string' ? role.color : '#99aab5',
      position:
        typeof role.position === 'number' ? role.position : 0,
      powerLevel:
        typeof role.powerLevel === 'number' ? role.powerLevel : 0,
      isEveryone: id === EVERYONE_ROLE_ID || role.isEveryone === true,
      permissions: defaultRolePermissions({
        viewSpace: permissionsRaw?.viewSpace === true,
        manageSpaceProfile: permissionsRaw?.manageSpaceProfile === true,
        reorderChannels: permissionsRaw?.reorderChannels === true,
        manageChannels: permissionsRaw?.manageChannels === true,
        manageCategories: permissionsRaw?.manageCategories === true,
        inviteMembers: permissionsRaw?.inviteMembers === true,
        kickMembers: permissionsRaw?.kickMembers === true,
        banMembers: permissionsRaw?.banMembers === true,
        manageRoles: permissionsRaw?.manageRoles === true,
        assignRolesBelowOnly:
          permissionsRaw?.assignRolesBelowOnly !== false,
        sendMessages: permissionsRaw?.sendMessages !== false,
        sendThreads: permissionsRaw?.sendThreads !== false,
        attachFiles: permissionsRaw?.attachFiles !== false,
        addReactions: permissionsRaw?.addReactions !== false,
        pinMessages: permissionsRaw?.pinMessages === true,
        redactOthers: permissionsRaw?.redactOthers === true,
        editOwnMessages: permissionsRaw?.editOwnMessages !== false,
        mentionEveryone: permissionsRaw?.mentionEveryone === true,
        visibleRoomIds,
      }),
    })
  }
  if (roles.length === 0) {
    return null
  }
  const assignmentsRaw = raw.assignments
  const assignments: Record<string, string> = {}
  if (assignmentsRaw && typeof assignmentsRaw === 'object') {
    for (const [userId, roleId] of Object.entries(assignmentsRaw)) {
      if (typeof roleId === 'string') {
        assignments[userId] = roleId
      }
    }
  }
  const everyoneRoleId =
    typeof raw.everyoneRoleId === 'string'
      ? raw.everyoneRoleId
      : EVERYONE_ROLE_ID
  const ownerUserId =
    typeof raw.ownerUserId === 'string' ? raw.ownerUserId : undefined
  return {
    version: 1,
    roles,
    assignments,
    everyoneRoleId,
    ownerUserId,
  }
}

export function sortRolesByPositionDesc(
  roles: SpaceRoleDefinition[],
): SpaceRoleDefinition[] {
  return [...roles].sort((roleA, roleB) => roleB.position - roleA.position)
}

export function getRoleById(
  content: DecentraSpaceRolesContent,
  roleId: string,
): SpaceRoleDefinition | null {
  return content.roles.find((role) => role.id === roleId) ?? null
}

export function resolveUserRole(
  content: DecentraSpaceRolesContent,
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

export function isRoomVisibleToRole(
  role: SpaceRoleDefinition,
  roomId: string,
): boolean {
  const visible = role.permissions.visibleRoomIds
  if (visible.length === 0) {
    return true
  }
  return visible.includes(roomId)
}

export function allocatePowerLevelBetween(
  roles: SpaceRoleDefinition[],
  insertPosition: number,
): number {
  const sorted = [...roles].sort(
    (roleA, roleB) => roleA.position - roleB.position,
  )
  const below = sorted.filter((role) => role.position < insertPosition)
  const above = sorted.filter((role) => role.position > insertPosition)
  const belowRole = below.length > 0 ? below[below.length - 1] : null
  const aboveRole = above.length > 0 ? above[0] : null
  const low = belowRole?.powerLevel ?? 0
  const high = aboveRole?.powerLevel ?? low + 100
  if (high - low > 1) {
    return Math.floor((low + high) / 2)
  }
  return low + 1
}

export function compilePowerLevelsContent(
  roles: SpaceRoleDefinition[],
  userAssignments: Record<string, number>,
): Record<string, unknown> {
  const maxRoleLevel = Math.max(...roles.map((role) => role.powerLevel), 100)
  const events: Record<string, number> = {
    [SPACE_CHILD_EVENT]: maxRoleLevel,
    'm.room.pinned_events': maxRoleLevel,
    'm.room.name': maxRoleLevel,
    'm.room.topic': maxRoleLevel,
    'm.room.avatar': maxRoleLevel,
    [DECENTRA_SPACE_ROLES_TYPE]: maxRoleLevel,
    [POWER_LEVEL_TAGS_STATE_TYPE]: maxRoleLevel,
  }
  for (const role of roles) {
    if (role.permissions.reorderChannels) {
      const current = events[SPACE_CHILD_EVENT] ?? maxRoleLevel
      events[SPACE_CHILD_EVENT] = Math.min(current, role.powerLevel)
    }
    if (role.permissions.pinMessages) {
      const current = events['m.room.pinned_events'] ?? maxRoleLevel
      events['m.room.pinned_events'] = Math.min(current, role.powerLevel)
    }
    if (role.permissions.manageSpaceProfile) {
      const nameLevel = events['m.room.name'] ?? maxRoleLevel
      events['m.room.name'] = Math.min(nameLevel, role.powerLevel)
      const topicLevel = events['m.room.topic'] ?? maxRoleLevel
      events['m.room.topic'] = Math.min(topicLevel, role.powerLevel)
      const avatarLevel = events['m.room.avatar'] ?? maxRoleLevel
      events['m.room.avatar'] = Math.min(avatarLevel, role.powerLevel)
    }
  }
  const redactRoles = roles.filter((role) => role.permissions.redactOthers)
  const kickRoles = roles.filter((role) => role.permissions.kickMembers)
  const redactLevel =
    redactRoles.length > 0
      ? Math.min(...redactRoles.map((role) => role.powerLevel))
      : maxRoleLevel
  const kickLevel =
    kickRoles.length > 0
      ? Math.min(...kickRoles.map((role) => role.powerLevel))
      : maxRoleLevel
  const messageRoles = roles.filter((role) => role.permissions.sendMessages)
  const messageLevel =
    messageRoles.length > 0
      ? Math.min(...messageRoles.map((role) => role.powerLevel))
      : maxRoleLevel + 1
  events['m.room.message'] = messageLevel
  return {
    users: userAssignments,
    users_default: 0,
    events_default: 0,
    state_default: maxRoleLevel,
    events,
    redact: redactLevel,
    kick: kickLevel,
    ban: kickLevel,
    invite: maxRoleLevel,
  }
}

export function buildUserPowerAssignments(
  content: DecentraSpaceRolesContent,
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
  if (content.ownerUserId && !excluded.has(content.ownerUserId)) {
    const ownerLevel = Math.max(...content.roles.map((role) => role.powerLevel), 0) + 1
    users[content.ownerUserId] = ownerLevel
  }
  return users
}

export function canAssignRole(
  actorRole: SpaceRoleDefinition,
  targetRole: SpaceRoleDefinition,
): boolean {
  if (!actorRole.permissions.manageRoles) {
    return false
  }
  if (!actorRole.permissions.assignRolesBelowOnly) {
    return true
  }
  return targetRole.position < actorRole.position
}

export function canManageRoleDefinition(
  actorRole: SpaceRoleDefinition,
  targetRole: SpaceRoleDefinition,
): boolean {
  if (targetRole.isEveryone) {
    return actorRole.permissions.manageRoles
  }
  if (!actorRole.permissions.manageRoles) {
    return false
  }
  return targetRole.position < actorRole.position
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

export function getSpaceRolesFromClient(
  matrixClient: MatrixClient,
  spaceRoomId: string,
): DecentraSpaceRolesContent | null {
  const room = matrixClient.getRoom(spaceRoomId)
  const stateEvents = room?.currentState?.getStateEvents?.(
    DECENTRA_SPACE_ROLES_TYPE,
    '',
  )
  const rawList = Array.isArray(stateEvents) ? stateEvents : stateEvents
    ? [stateEvents]
    : []
  const first = rawList[0]
  const content = first?.getContent?.() as Record<string, unknown> | undefined
  return parseSpaceRolesContent(content ?? null)
}
