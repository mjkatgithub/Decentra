import { describe, expect, it } from 'vitest'
import {
  buildUserPowerAssignments,
  compilePowerLevelsContent,
  createEveryoneRole,
  createFullAdminRole,
  createInitialSpaceRolesContent,
  type SpaceRolesState,
} from '~/utils/decentraSpaceRoles'

describe('decentraSpaceRoles PL compile', () => {
  it('maps assigned users to role power levels', () => {
    const everyone = createEveryoneRole()
    const admin = createFullAdminRole('Admin', 100, 100)
    const content: SpaceRolesState = {
      roles: [everyone, admin],
      assignments: { '@alice:hs': admin.id },
      everyoneRoleId: everyone.id,
    }
    const users = buildUserPowerAssignments(content)
    expect(users['@alice:hs']).toBe(100)
  })

  it('omits excluded user ids from power level users map', () => {
    const content = createInitialSpaceRolesContent('@creator:hs')
    const users = buildUserPowerAssignments(content, ['@creator:hs'])
    expect(users['@creator:hs']).toBeUndefined()
  })

  it('preserves existing matrix PL fields when merging users', () => {
    const everyone = createEveryoneRole()
    const compiled = compilePowerLevelsContent(
      [everyone],
      {},
      { kick: 50, ban: 50, users_default: 0 },
    )
    expect(compiled.kick).toBe(50)
    expect(compiled.users).toEqual({})
  })
})
