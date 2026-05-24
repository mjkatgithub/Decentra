import { describe, expect, it } from 'vitest'
import {
  buildUserPowerAssignments,
  createInitialSpaceRolesContent,
} from '~/utils/decentraSpaceRoles'
import {
  buildRolesFromMatrixPowerLevels,
  collectUsedPowerLevels,
  getOwnerEffectivePowerLevel,
  validateRolePowerLevelAgainstActor,
} from '~/utils/spaceRolesMatrixSync'

describe('spaceRolesMatrixSync', () => {
  it('assigns owner max role PL plus one', () => {
    const content = createInitialSpaceRolesContent('@owner:example.org')
    const users = buildUserPowerAssignments(content)
    expect(users['@owner:example.org']).toBe(
      getOwnerEffectivePowerLevel(content),
    )
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

  it('builds roles from cinny tags and drops decentra-only roles', () => {
    const decentraOnly = createInitialSpaceRolesContent('@owner:example.org')
    decentraOnly.roles.push({
      id: 'asdf',
      name: 'asdf',
      color: '#5865f2',
      position: 150,
      powerLevel: 150,
      permissions: decentraOnly.roles[1]!.permissions,
    })
    const built = buildRolesFromMatrixPowerLevels(
      {
        users: { '@mod:example.org': 50 },
        users_default: 0,
      },
      [{ name: 'Moderator', powerLevel: 50 }, { name: 'qwer', powerLevel: 25 }],
      decentraOnly,
    )
    expect(built.roles.some((role) => role.name === 'asdf')).toBe(false)
    expect(built.roles.some((role) => role.name === 'qwer')).toBe(true)
    expect(built.roles.some((role) => role.name === 'Moderator')).toBe(true)
  })

  it('collects numeric powers from nested PL content', () => {
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
