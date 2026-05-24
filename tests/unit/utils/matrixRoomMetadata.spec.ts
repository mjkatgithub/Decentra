import { describe, expect, it } from 'vitest'
import { validateRoomName } from '~/utils/matrixRoomMetadata'
import {
  createEveryoneRole,
  canAssignRole,
  validateRolePowerLevel,
} from '~/utils/decentraSpaceRoles'

describe('matrixRoomMetadata', () => {
  it('rejects empty room names', () => {
    expect(validateRoomName('   ')).toBe('Room name is required')
    expect(validateRoomName('Valid')).toBeNull()
  })
})

describe('decentraSpaceRoles', () => {
  it('assignRolesBelowOnly blocks higher role assignment', () => {
    expect(canAssignRole(50, 60, true)).toBe(false)
    expect(canAssignRole(100, 50, true)).toBe(true)
  })

  it('rejects duplicate power levels', () => {
    const roles = [
      { ...createEveryoneRole(), id: 'a', powerLevel: 0 },
      { ...createEveryoneRole(), id: 'b', powerLevel: 50 },
    ]
    expect(validateRolePowerLevel(50, roles, 'a')).toMatch(/unique/i)
    expect(validateRolePowerLevel(50, roles, 'b')).toBeNull()
  })
})
