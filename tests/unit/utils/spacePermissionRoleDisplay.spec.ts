import { describe, expect, it } from 'vitest'
import {
  EVERYONE_ROLE_ID,
  type SpaceRoleDefinition,
} from '~/utils/decentraSpaceRoles'
import {
  formatPermissionThresholdLabel,
  resolveRoleForRequiredPowerLevel,
  rolesForPermissionDropdown,
} from '~/utils/spacePermissionRoleDisplay'

const memberRole: SpaceRoleDefinition = {
  id: EVERYONE_ROLE_ID,
  name: 'Member',
  color: '#99aab5',
  position: 0,
  powerLevel: 0,
  isEveryone: true,
}

const moderatorRole: SpaceRoleDefinition = {
  id: 'pl_50',
  name: 'Moderator',
  color: '#faa61a',
  position: 50,
  powerLevel: 50,
}

const adminRole: SpaceRoleDefinition = {
  id: 'pl_100',
  name: 'Admin',
  color: '#ed4245',
  position: 100,
  powerLevel: 100,
}

const founderRole: SpaceRoleDefinition = {
  id: '__founder__',
  name: 'Founder',
  color: '#5865f2',
  position: 10_000,
  powerLevel: 10_000,
  isFounder: true,
}

describe('spacePermissionRoleDisplay', () => {
  it('excludes founder from permission dropdown roles', () => {
    const roles = rolesForPermissionDropdown([
      memberRole,
      moderatorRole,
      founderRole,
    ])
    expect(roles.map((role) => role.id)).toEqual([
      EVERYONE_ROLE_ID,
      'pl_50',
    ])
  })

  it('resolves exact and fallback roles for required PL', () => {
    const roles = [memberRole, moderatorRole, adminRole]
    expect(resolveRoleForRequiredPowerLevel(roles, 50)?.name).toBe(
      'Moderator',
    )
    expect(resolveRoleForRequiredPowerLevel(roles, 75)?.name).toBe(
      'Moderator',
    )
    expect(resolveRoleForRequiredPowerLevel(roles, 0)?.name).toBe('Member')
  })

  it('formats threshold label with and without suffix', () => {
    expect(
      formatPermissionThresholdLabel(moderatorRole, true, (name) =>
        `${name} & Above`,
      ),
    ).toBe('Moderator & Above')
    expect(
      formatPermissionThresholdLabel(memberRole, false, (name) =>
        `${name} & Above`,
      ),
    ).toBe('Member')
  })
})
