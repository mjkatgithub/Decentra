import { describe, expect, it } from 'vitest'
import {
  buildUserPowerAssignments,
  createInitialSpaceRolesContent,
} from '~/utils/decentraSpaceRoles'
import {
  buildPowerLevelTagsPayload,
  buildRolesFromMatrixPowerLevels,
  collectUsedPowerLevels,
  getOwnerEffectivePowerLevel,
  validateRolePowerLevelAgainstActor,
} from '~/utils/spaceRolesMatrixSync'

describe('spaceRolesMatrixSync', () => {
  it('assigns owner max role PL plus one when not excluded', () => {
    const content = createInitialSpaceRolesContent('@owner:example.org')
    const users = buildUserPowerAssignments(content)
    expect(users['@owner:example.org']).toBe(
      getOwnerEffectivePowerLevel(content),
    )
  })

  it('excludes room creator from m.room.power_levels users map', () => {
    const content = createInitialSpaceRolesContent('@owner:example.org')
    const users = buildUserPowerAssignments(content, ['@owner:example.org'])
    expect(users['@owner:example.org']).toBeUndefined()
  })

  it('blocks non-owner from role at or above actor PL', () => {
    const content = createInitialSpaceRolesContent('@owner:example.org')
    const adminId = content.assignments['@owner:example.org']!
    const adminRole = content.roles.find((role) => role.id === adminId)!
    const limited = {
      ...content,
      assignments: { '@mod:example.org': adminRole.id },
    }
    expect(
      validateRolePowerLevelAgainstActor(
        adminRole.powerLevel,
        limited,
        '@mod:example.org',
        'new',
      ),
    ).toMatch(/lower than your own/i)
  })

  it('reads roles from matrix PL and tags like interop clients', () => {
    const overlay = createInitialSpaceRolesContent('@owner:example.org')
    const built = buildRolesFromMatrixPowerLevels(
      {
        users: { '@mod:example.org': 50 },
        users_default: 0,
      },
      [{ name: 'noop', powerLevel: -10 }],
      overlay,
    )
    expect(built.roles.some((role) => role.name === 'noop')).toBe(true)
    expect(built.roles.some((role) => role.powerLevel === 50)).toBe(true)
  })

  it('writes tag payload only for current roles', () => {
    const content = createInitialSpaceRolesContent('@owner:example.org')
    const payload = buildPowerLevelTagsPayload(content)
    expect(payload['-10']).toBeUndefined()
    expect(payload['0']?.name).toBeTruthy()
    expect(payload['100']?.name).toBe('Admin')
  })

  it('imports legacy tags when no decentra overlay exists', () => {
    const built = buildRolesFromMatrixPowerLevels(
      {
        users: { '@mod:example.org': 50 },
        users_default: 0,
      },
      [{ name: 'Moderator', powerLevel: 50 }, { name: 'qwer', powerLevel: 25 }],
      null,
    )
    expect(built.roles.some((role) => role.name === 'qwer')).toBe(true)
    expect(built.roles.some((role) => role.name === 'Moderator')).toBe(true)
  })

  it('collects all numeric PL values from matrix content', () => {
    const used = collectUsedPowerLevels({
      users: { '@a:hs': 100 },
      events: { 'm.room.message': 0 },
      kick: 50,
    })
    expect(used.has(100)).toBe(true)
    expect(used.has(50)).toBe(true)
    expect(used.has(0)).toBe(true)
  })
})
