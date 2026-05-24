import { SPACE_CHILD_EVENT } from '~/utils/spaceRoomCategories'
import { POWER_LEVEL_TAGS_STATE_TYPE } from '~/utils/matrixPowerLevelTagState'
import { readNumericPowerLevel } from '~/utils/matrixPowerLevels'

export type SpacePowerLevelFieldKind = 'scalar' | 'event'

export interface SpacePowerLevelPermissionField {
  id: string
  labelKey: string
  kind: SpacePowerLevelFieldKind
  eventType?: string
}

/** Matrix m.room.power_levels fields (Cinny/Sable permissions UI). */
export const SPACE_POWER_LEVEL_PERMISSION_FIELDS: SpacePowerLevelPermissionField[] =
  [
    {
      id: 'users_default',
      labelKey: 'settings.spacePlDefaultPower',
      kind: 'scalar',
    },
    {
      id: 'm.space.child',
      labelKey: 'settings.spacePlManageRooms',
      kind: 'event',
      eventType: SPACE_CHILD_EVENT,
    },
    {
      id: 'm.room.message',
      labelKey: 'settings.spacePlMessageEvents',
      kind: 'event',
      eventType: 'm.room.message',
    },
    {
      id: 'invite',
      labelKey: 'settings.spacePlInvite',
      kind: 'scalar',
    },
    {
      id: 'kick',
      labelKey: 'settings.spacePlKick',
      kind: 'scalar',
    },
    {
      id: 'ban',
      labelKey: 'settings.spacePlBan',
      kind: 'scalar',
    },
    {
      id: 'm.room.avatar',
      labelKey: 'settings.spacePlSpaceAvatar',
      kind: 'event',
      eventType: 'm.room.avatar',
    },
    {
      id: 'm.room.name',
      labelKey: 'settings.spacePlSpaceName',
      kind: 'event',
      eventType: 'm.room.name',
    },
    {
      id: 'm.room.topic',
      labelKey: 'settings.spacePlSpaceTopic',
      kind: 'event',
      eventType: 'm.room.topic',
    },
    {
      id: 'redact',
      labelKey: 'settings.spacePlRedact',
      kind: 'scalar',
    },
    {
      id: 'state_default',
      labelKey: 'settings.spacePlStateDefault',
      kind: 'scalar',
    },
  ]

export function readPowerLevelFieldValue(
  content: Record<string, unknown> | null,
  field: SpacePowerLevelPermissionField,
): number {
  if (!content) {
    return 0
  }
  if (field.kind === 'event' && field.eventType) {
    const events = content.events as Record<string, unknown> | undefined
    const specific = events?.[field.eventType]
    if (typeof specific === 'number' && Number.isFinite(specific)) {
      return specific
    }
    return readNumericPowerLevel(content, 'state_default') ?? 50
  }
  return readNumericPowerLevel(content, field.id) ?? 0
}

export function writePowerLevelFieldValue(
  content: Record<string, unknown>,
  field: SpacePowerLevelPermissionField,
  powerLevel: number,
): Record<string, unknown> {
  const next = { ...content }
  if (field.kind === 'event' && field.eventType) {
    const events = {
      ...(next.events as Record<string, number> | undefined),
    }
    events[field.eventType] = powerLevel
    next.events = events
    return next
  }
  next[field.id] = powerLevel
  return next
}

export function createDefaultSpacePowerLevels(
  maxRoleLevel = 100,
  moderatorLevel = 50,
): Record<string, unknown> {
  return {
    users: {},
    users_default: 0,
    events_default: 0,
    state_default: maxRoleLevel,
    invite: 0,
    kick: moderatorLevel,
    ban: moderatorLevel,
    redact: moderatorLevel,
    events: {
      [SPACE_CHILD_EVENT]: moderatorLevel,
      'm.room.message': maxRoleLevel,
      'm.room.name': moderatorLevel,
      'm.room.topic': moderatorLevel,
      'm.room.avatar': moderatorLevel,
      'm.room.pinned_events': maxRoleLevel,
      [POWER_LEVEL_TAGS_STATE_TYPE]: maxRoleLevel,
    },
  }
}

function scrubNumericRecord(
  record: Record<string, unknown> | undefined,
  powerLevel: number,
): Record<string, unknown> {
  if (!record) {
    return {}
  }
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (value === powerLevel) {
      continue
    }
    next[key] = value
  }
  return next
}

/** Remove a PL from Matrix content (tags + getUsedPowers sources). */
export function scrubPowerLevelFromContent(
  content: Record<string, unknown>,
  powerLevel: number,
): Record<string, unknown> {
  const next = { ...content }
  const scalarKeys = [
    'users_default',
    'events_default',
    'state_default',
    'kick',
    'ban',
    'invite',
    'redact',
  ] as const
  for (const key of scalarKeys) {
    if (next[key] === powerLevel) {
      delete next[key]
    }
  }
  const users = scrubNumericRecord(
    next.users as Record<string, unknown> | undefined,
    powerLevel,
  )
  next.users = users
  next.events = scrubNumericRecord(
    next.events as Record<string, unknown> | undefined,
    powerLevel,
  )
  if (next.notifications && typeof next.notifications === 'object') {
    next.notifications = scrubNumericRecord(
      next.notifications as Record<string, unknown>,
      powerLevel,
    )
  }
  return next
}

export function mergeUsersIntoPowerLevels(
  existing: Record<string, unknown> | null,
  userAssignments: Record<string, number>,
  maxRoleLevel: number,
): Record<string, unknown> {
  const base =
    existing && Object.keys(existing).length > 0
      ? { ...existing }
      : createDefaultSpacePowerLevels(maxRoleLevel)
  return {
    ...base,
    users: userAssignments,
  }
}
