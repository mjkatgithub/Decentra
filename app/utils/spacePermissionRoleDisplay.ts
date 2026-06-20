import type { SpaceRoleDefinition } from '~/utils/decentraSpaceRoles'

export function rolesForPermissionDropdown(
  roles: SpaceRoleDefinition[],
): SpaceRoleDefinition[] {
  return roles.filter((role) => !role.isFounder)
}

export function resolveRoleForRequiredPowerLevel(
  roles: SpaceRoleDefinition[],
  requiredPowerLevel: number,
): SpaceRoleDefinition | null {
  const assignable = rolesForPermissionDropdown(roles)
  if (assignable.length === 0) {
    return null
  }
  const exact = assignable.find(
    (role) => role.powerLevel === requiredPowerLevel,
  )
  if (exact) {
    return exact
  }
  const sorted = [...assignable].sort(
    (roleA, roleB) => roleB.powerLevel - roleA.powerLevel,
  )
  const atOrBelow = sorted.find(
    (role) => role.powerLevel <= requiredPowerLevel,
  )
  return atOrBelow ?? sorted[sorted.length - 1] ?? null
}

export function formatPermissionThresholdLabel(
  role: SpaceRoleDefinition,
  showAndAbove: boolean,
  formatAndAbove: (roleName: string) => string,
): string {
  if (!showAndAbove) {
    return role.name
  }
  return formatAndAbove(role.name)
}
