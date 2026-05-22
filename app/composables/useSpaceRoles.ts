import { useMatrixClient } from '~/composables/useMatrixClient'
import {
  allocatePowerLevelBetween,
  canAssignRole,
  canManageRoleDefinition,
  createEveryoneRole,
  createInitialSpaceRolesContent,
  defaultRolePermissions,
  getSpaceRolesFromClient,
  resolveUserRole,
  sortRolesByPositionDesc,
  validateRoleName,
  type DecentraSpaceRolesContent,
  type SpaceRoleDefinition,
} from '~/utils/decentraSpaceRoles'
import { getActorRoleInSpace } from '~/utils/decentraSpaceRolesPermissions'

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
    rolesContent.value = parsed
  }

  watch([client, spaceId], () => reloadFromRoom(), { immediate: true })

  async function ensureInitialRoles(childRoomIds: string[]): Promise<void> {
    const matrixClient = client.value
    const matrixUserId = userId.value
    if (!matrixClient || !matrixUserId || !spaceId.value) {
      return
    }
    if (rolesContent.value) {
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

  function createRoleDraft(name: string): SpaceRoleDefinition | null {
    const content = rolesContent.value
    const actor = actorRole.value
    if (!content || !actor?.permissions.manageRoles) {
      return null
    }
    const validationError = validateRoleName(name)
    if (validationError) {
      saveError.value = validationError
      return null
    }
    const maxPosition = Math.max(
      ...content.roles.map((role) => role.position),
      0,
    )
    const position = maxPosition + 10
    return {
      id: `role_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`,
      name: name.trim(),
      color: '#5865f2',
      position,
      powerLevel: allocatePowerLevelBetween(content.roles, position),
      permissions: defaultRolePermissions(),
    }
  }

  async function addRole(
    name: string,
    childRoomIds: string[],
  ): Promise<void> {
    const content = rolesContent.value
    if (!content) {
      return
    }
    const draft = createRoleDraft(name)
    if (!draft) {
      return
    }
    const next: DecentraSpaceRolesContent = {
      ...content,
      roles: [...content.roles, draft],
    }
    await persistRoles(next, childRoomIds)
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
