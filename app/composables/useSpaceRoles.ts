import { RoomEvent } from 'matrix-js-sdk'
import { useMatrixClient } from '~/composables/useMatrixClient'
import {
  canAssignRole,
  canManageRoleDefinition,
  createEveryoneRole,
  createInitialSpaceRolesContent,
  resolveUserRole,
  type SpaceRoleDefinition,
  type SpaceRolesState,
  validateRoleName,
  validateRolePowerLevel,
} from '~/utils/decentraSpaceRoles'
import {
  getActorPowerLevelInSpace,
  canManageSpaceRoles,
} from '~/utils/matrixSpaceRolePermissions'
import {
  inferOwnerUserId,
  isSpaceRoomFounder,
  readPowerLevelTagDefinitions,
  resolveSpaceRolesFromClient,
  validateRolePowerLevelAgainstActor,
} from '~/utils/spaceRolesMatrixSync'
import { getPowerLevelsContent } from '~/utils/matrixPowerLevels'

export type SpaceRoleEditDraft = Pick<
  SpaceRoleDefinition,
  'name' | 'color' | 'powerLevel'
>

export function useSpaceRoles(spaceId: Ref<string>) {
  const { client, userId, saveSpaceRoles } = useMatrixClient()

  const rolesContent = ref<SpaceRolesState | null>(null)
  const isLoading = ref(false)
  const saveError = ref('')
  const permissionRevision = ref(0)

  const actorPowerLevel = computed(() =>
    getActorPowerLevelInSpace(client.value, spaceId.value, userId.value),
  )

  const canManageRoles = computed(() => {
    permissionRevision.value
    rolesContent.value
    const matrixClient = client.value
    const roomId = spaceId.value
    const matrixUserId = userId.value
    if (
      isSpaceRoomFounder(matrixClient, roomId, matrixUserId) ||
      canManageSpaceRoles(matrixClient, roomId, matrixUserId)
    ) {
      return true
    }
    return false
  })

  const sortedRoles = computed(() => {
    if (!rolesContent.value) {
      return []
    }
    return [...rolesContent.value.roles].sort(
      (roleA, roleB) => roleB.powerLevel - roleA.powerLevel,
    )
  })

  function reloadFromRoom() {
    const matrixClient = client.value
    if (!matrixClient || !spaceId.value) {
      rolesContent.value = null
      return
    }
    const merged = resolveSpaceRolesFromClient(matrixClient, spaceId.value)
    if (merged) {
      const powerLevels = getPowerLevelsContent(matrixClient, spaceId.value)
      merged.ownerUserId = inferOwnerUserId(merged, powerLevels)
    }
    rolesContent.value = merged
  }

  watch([client, spaceId], () => reloadFromRoom(), { immediate: true })

  watch([client, spaceId], (current, _previous, onCleanup) => {
    const matrixClient = current[0]
    const roomId = current[1]
    if (!matrixClient || !roomId) {
      return
    }
    const room = matrixClient.getRoom(roomId)
    if (!room) {
      return
    }
    const onStateUpdated = () => {
      permissionRevision.value += 1
      reloadFromRoom()
    }
    room.on(RoomEvent.CurrentStateUpdated, onStateUpdated)
    onCleanup(() => {
      room.off(RoomEvent.CurrentStateUpdated, onStateUpdated)
    })
  }, { immediate: true })

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
    content: SpaceRolesState,
    childRoomIds: string[],
    scrubPowerLevel?: number,
  ): Promise<void> {
    saveError.value = ''
    if (!spaceId.value) {
      return
    }
    try {
      await saveSpaceRoles(
        spaceId.value,
        content,
        childRoomIds,
        scrubPowerLevel,
      )
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
    if (!content || !canManageRoles.value) {
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
    await persistRoles(
      { ...content, roles: [...withoutDuplicate, draft] },
      childRoomIds,
    )
  }

  async function saveRoleEdits(
    roleId: string,
    draft: SpaceRoleEditDraft,
    childRoomIds: string[],
  ): Promise<boolean> {
    const content = rolesContent.value
    if (!content || !canManageRoles.value) {
      return false
    }
    const target = content.roles.find((role) => role.id === roleId)
    if (!target) {
      return false
    }
    if (
      !canManageRoleDefinition(
        actorPowerLevel.value,
        target.powerLevel,
        canManageRoles.value,
        target.isEveryone,
      )
    ) {
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
            position: draft.powerLevel,
            id: role.isEveryone ? role.id : `pl_${draft.powerLevel}`,
          }
        : role,
    )
    await persistRoles({ ...content, roles: nextRoles }, childRoomIds)
    return true
  }

  async function deleteRole(
    roleId: string,
    childRoomIds: string[],
  ): Promise<void> {
    const content = rolesContent.value
    if (!content || !canManageRoles.value) {
      return
    }
    const target = content.roles.find((role) => role.id === roleId)
    if (!target || target.isEveryone) {
      return
    }
    if (
      !canManageRoleDefinition(
        actorPowerLevel.value,
        target.powerLevel,
        canManageRoles.value,
      )
    ) {
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
      target.powerLevel,
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
    if (!content || !canManageRoles.value) {
      return
    }
    if (isSpaceRoomFounder(client.value, spaceId.value, targetUserId)) {
      return
    }
    const targetRole = content.roles.find((role) => role.id === roleId)
    if (!targetRole) {
      return
    }
    if (
      !canAssignRole(
        actorPowerLevel.value,
        targetRole.powerLevel,
        canManageRoles.value,
      )
    ) {
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

  return {
    rolesContent,
    sortedRoles,
    actorPowerLevel,
    isLoading,
    saveError,
    reloadFromRoom,
    ensureInitialRoles,
    addRole,
    saveRoleEdits,
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
