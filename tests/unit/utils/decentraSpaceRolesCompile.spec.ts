import { describe, expect, it } from 'vitest'
import {
  buildUserPowerAssignments,
  compilePowerLevelsContent,
  createEveryoneRole,
  createFullAdminRole,
  createInitialSpaceRolesContent,
  type DecentraSpaceRolesContent,
} from '~/utils/decentraSpaceRoles'

describe('decentraSpaceRoles PL compile', () => {
  it('maps assigned users to role power levels', () => {
    const everyone = createEveryoneRole()
    const admin = createFullAdminRole('Admin', 100, 100)
    const content: DecentraSpaceRolesContent = {
      version: 1,
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

  it('lowers redact threshold when a role may redact', () => {
    const mod = createEveryoneRole()
    mod.id = 'mod'
    mod.name = 'Mod'
    mod.powerLevel = 50
    mod.permissions.redactOthers = true
    const compiled = compilePowerLevelsContent([mod], {})
    expect(compiled.redact).toBe(50)
  })
})
