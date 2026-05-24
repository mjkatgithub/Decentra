import { useMatrixClient } from '~/composables/useMatrixClient'
import {
  canAssignRole,
  canManageRoleDefinition,
  createEveryoneRole,
  createInitialSpaceRolesContent,
  defaultRolePermissions,
  getSpaceRolesFromClient,
  resolveUserRole,
  sortRolesByPositionDesc,
  validateRoleName,
  validateRolePowerLevel,
  type DecentraSpaceRolesContent,
  type SpaceRoleDefinition,
} from '~/utils/decentraSpaceRoles'
import {
  getEffectiveUserPowerLevel,
  inferOwnerUserId,
  readPowerLevelTagDefinitions,
  resolveSpaceRolesFromClient,
  validateRolePowerLevelAgainstActor,
} from '~/utils/spaceRolesMatrixSync'
import { getPowerLevelsContent } from '~/utils/matrixPowerLevels'
import { getActorRoleInSpace } from '~/utils/decentraSpaceRolesPermissions'

export type SpaceRoleEditDraft = Pick<
  SpaceRoleDefinition,
  'name' | 'color' | 'powerLevel' | 'permissions'
>

export function useSpaceRoles(spaceId: Ref<string>) {
  const { client, userId, saveSpaceRoles } = useMatrixClient()

  const rolesContent = ref<DecentraSpaceRolesContent | null>(null)
  const isLoading = ref(false)
  const saveError = ref('')

  const actorRole = computed(() =>
    getActorRoleInSpace(client.value, spaceId.value, userId.value),
  )

  const sortedRoles = computed(() => {
    if (!rolesContent.value) {
      return []
    }
    return sortRolesByPositionDesc(rolesContent.value.roles)
  })

  function reloadFromRoom() {
    const matrixClient = client.value
    if (!matrixClient || !spaceId.value) {
      rolesContent.value = null
      return
    }
    const parsed = getSpaceRolesFromClient(matrixClient, spaceId.value)
    const merged = resolveSpaceRolesFromClient(
      matrixClient,
      spaceId.value,
      parsed,
    )
    if (merged && !merged.ownerUserId) {
      const powerLevels = getPowerLevelsContent(matrixClient, spaceId.value)
      merged.ownerUserId = inferOwnerUserId(merged, powerLevels)
    }
    rolesContent.value = merged
  }

  watch([client, spaceId], () => reloadFromRoom(), { immediate: true })

  async function ensureInitialRoles(childRoomIds: string[]): Promise<void> {
    const matrixClient = client.value
    const matrixUserId = userId.value
    if (!matrixClient || !matrixUserId || !spaceId.value) {
      return
    }
    reloadFromRoom()
    if (rolesContent.value) {
      const hasNonEveryoneRole = rolesContent.value.roles.some(
        (role) => !role.isEveryone,
      )
      if (hasNonEveryoneRole) {
        return
      }
    }
    const powerLevelTags = readPowerLevelTagDefinitions(
      matrixClient,
      spaceId.value,
    )
    if (powerLevelTags.length > 0) {
      return
    }
    const initial = createInitialSpaceRolesContent(matrixUserId)
    await persistRoles(initial, childRoomIds)
    reloadFromRoom()
  }

  async function persistRoles(
    content: DecentraSpaceRolesContent,
    childRoomIds: string[],
  ): Promise<void> {
    saveError.value = ''
    if (!spaceId.value) {
      return
    }
    try {
      await saveSpaceRoles(spaceId.value, content, childRoomIds)
      rolesContent.value = content
    } catch (thrownError) {
      saveError.value =
        thrownError instanceof Error
          ? thrownError.message
          : String(thrownError)
      throw thrownError
    }
  }

  function createRoleDraft(
    name: string,
    powerLevel: number,
  ): SpaceRoleDefinition | null {
    const content = rolesContent.value
    const actor = actorRole.value
    if (!content || !actor?.permissions.manageRoles) {
      return null
    }
    const nameError = validateRoleName(name)
    if (nameError) {
      saveError.value = nameError
      return null
    }
    const powerError = validateRolePowerLevel(
      powerLevel,
      content.roles,
      '',
    )
    if (powerError) {
      saveError.value = powerError
      return null
    }
    const actorCapError = validateRolePowerLevelAgainstActor(
      powerLevel,
      content,
      userId.value,
      '',
    )
    if (actorCapError) {
      saveError.value = actorCapError
      return null
    }
    return {
      id: `pl_${powerLevel}`,
      name: name.trim(),
      color: '#5865f2',
      position: powerLevel,
      powerLevel,
      permissions: defaultRolePermissions(),
    }
  }

  async function addRole(
    name: string,
    powerLevel: number,
    childRoomIds: string[],
  ): Promise<void> {
    const content = rolesContent.value
    if (!content) {
      return
    }
    const draft = createRoleDraft(name, powerLevel)
    if (!draft) {
      return
    }
    const withoutDuplicate = content.roles.filter(
      (role) => role.powerLevel !== powerLevel,
    )
    const next: DecentraSpaceRolesContent = {
      ...content,
      roles: [...withoutDuplicate, draft],
    }
    await persistRoles(next, childRoomIds)
  }

  async function saveRoleEdits(
    roleId: string,
    draft: SpaceRoleEditDraft,
    childRoomIds: string[],
  ): Promise<boolean> {
    const content = rolesContent.value
    const actor = actorRole.value
    if (!content || !actor) {
      return false
    }
    const target = content.roles.find((role) => role.id === roleId)
    if (!target) {
      return false
    }
    if (!canManageRoleDefinition(actor, target) && !target.isEveryone) {
      return false
    }
    const nameError = validateRoleName(draft.name)
    if (nameError) {
      saveError.value = nameError
      return false
    }
    const powerError = validateRolePowerLevel(
      draft.powerLevel,
      content.roles,
      roleId,
    )
    if (powerError) {
      saveError.value = powerError
      return false
    }
    const actorCapError = validateRolePowerLevelAgainstActor(
      draft.powerLevel,
      content,
      userId.value,
      roleId,
    )
    if (actorCapError) {
      saveError.value = actorCapError
      return false
    }
    saveError.value = ''
    const nextRoles = content.roles.map((role) =>
      role.id === roleId
        ? {
            ...role,
            name: draft.name.trim(),
            color: draft.color,
            powerLevel: draft.powerLevel,
            permissions: { ...draft.permissions },
          }
        : role,
    )
    await persistRoles({ ...content, roles: nextRoles }, childRoomIds)
    return true
  }

  async function updateRole(
    roleId: string,
    patch: Partial<SpaceRoleDefinition>,
    childRoomIds: string[],
  ): Promise<void> {
    const content = rolesContent.value
    const actor = actorRole.value
    if (!content || !actor) {
      return
    }
    const target = content.roles.find((role) => role.id === roleId)
    if (!target) {
      return
    }
    if (!canManageRoleDefinition(actor, target) && !target.isEveryone) {
      return
    }
    const nextRoles = content.roles.map((role) =>
      role.id === roleId ? { ...role, ...patch } : role,
    )
    await persistRoles({ ...content, roles: nextRoles }, childRoomIds)
  }

  async function deleteRole(
    roleId: string,
    childRoomIds: string[],
  ): Promise<void> {
    const content = rolesContent.value
    const actor = actorRole.value
    if (!content || !actor) {
      return
    }
    const target = content.roles.find((role) => role.id === roleId)
    if (!target || target.isEveryone) {
      return
    }
    if (!canManageRoleDefinition(actor, target)) {
      return
    }
    const nextAssignments = { ...content.assignments }
    for (const [assignedUser, assignedRoleId] of Object.entries(
      nextAssignments,
    )) {
      if (assignedRoleId === roleId) {
        delete nextAssignments[assignedUser]
      }
    }
    await persistRoles(
      {
        ...content,
        roles: content.roles.filter((role) => role.id !== roleId),
        assignments: nextAssignments,
      },
      childRoomIds,
    )
  }

  async function reorderRoles(
    orderedRoleIds: string[],
    childRoomIds: string[],
  ): Promise<void> {
    const content = rolesContent.value
    if (!content || orderedRoleIds.length === 0) {
      return
    }
    const roleById = new Map(content.roles.map((role) => [role.id, role]))
    const reordered: typeof content.roles = []
    let position = 10
    for (const roleId of orderedRoleIds) {
      const role = roleById.get(roleId)
      if (!role) {
        continue
      }
      reordered.push({ ...role, position })
      position += 10
    }
    for (const role of content.roles) {
      if (!orderedRoleIds.includes(role.id)) {
        reordered.push({ ...role, position })
        position += 10
      }
    }
    await persistRoles({ ...content, roles: reordered }, childRoomIds)
  }

  async function assignUserRole(
    targetUserId: string,
    roleId: string,
    childRoomIds: string[],
  ): Promise<void> {
    const content = rolesContent.value
    const actor = actorRole.value
    if (!content || !actor) {
      return
    }
    const targetRole = content.roles.find((role) => role.id === roleId)
    if (!targetRole) {
      return
    }
    if (!canAssignRole(actor, targetRole)) {
      return
    }
    await persistRoles(
      {
        ...content,
        assignments: {
          ...content.assignments,
          [targetUserId]: roleId,
        },
      },
      childRoomIds,
    )
  }

  function canManageRoles(): boolean {
    return Boolean(actorRole.value?.permissions.manageRoles)
  }

  return {
    rolesContent,
    sortedRoles,
    actorRole,
    isLoading,
    saveError,
    reloadFromRoom,
    ensureInitialRoles,
    addRole,
    saveRoleEdits,
    updateRole,
    deleteRole,
    reorderRoles,
    assignUserRole,
    canManageRoles,
    resolveUserRole: (targetUserId: string) =>
      rolesContent.value
        ? resolveUserRole(rolesContent.value, targetUserId)
        : createEveryoneRole(),
  }
}
