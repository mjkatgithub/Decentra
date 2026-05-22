import { describe, expect, it } from 'vitest'
import { validateRoomName } from '~/utils/matrixRoomMetadata'
import {
  parseSpaceRolesContent,
  createEveryoneRole,
  canAssignRole,
  isRoomVisibleToRole,
} from '~/utils/decentraSpaceRoles'

describe('matrixRoomMetadata', () => {
  it('rejects empty room names', () => {
    expect(validateRoomName('   ')).toBe('Room name is required')
    expect(validateRoomName('Valid')).toBeNull()
  })
})

describe('decentraSpaceRoles', () => {
  it('parses role content version 1', () => {
    const everyone = createEveryoneRole()
    const parsed = parseSpaceRolesContent({
      version: 1,
      roles: [everyone],
      assignments: {},
      everyoneRoleId: everyone.id,
    })
    expect(parsed?.roles).toHaveLength(1)
    expect(parsed?.roles[0].name).toBe('@everyone')
  })

  it('assignRolesBelowOnly blocks higher role assignment', () => {
    const actor = {
      ...createEveryoneRole(),
      position: 50,
      permissions: {
        ...createEveryoneRole().permissions,
        manageRoles: true,
        assignRolesBelowOnly: true,
      },
    }
    const target = {
      ...createEveryoneRole(),
      id: 'target',
      position: 60,
    }
    expect(canAssignRole(actor, target)).toBe(false)
  })

  it('visibleRoomIds restrict sidebar rooms', () => {
    const role = {
      ...createEveryoneRole(),
      permissions: {
        ...createEveryoneRole().permissions,
        visibleRoomIds: ['!a:hs'],
      },
    }
    expect(isRoomVisibleToRole(role, '!a:hs')).toBe(true)
    expect(isRoomVisibleToRole(role, '!b:hs')).toBe(false)
  })

  it('empty visibleRoomIds means all rooms visible', () => {
    const role = createEveryoneRole()
    expect(isRoomVisibleToRole(role, '!any:hs')).toBe(true)
  })
})
