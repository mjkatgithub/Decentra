import { useMatrixClient } from '~/composables/useMatrixClient'
import { useChatMedia } from '~/composables/useChatMedia'
import {
  createFounderRole,
  FOUNDER_ROLE_ID,
  sortRolesByPositionDesc,
  type SpaceRoleDefinition,
} from '~/utils/decentraSpaceRoles'
import {
  isSpaceRoomFounder,
  resolveSpaceRolesFromClient,
  resolveUserRoleForSpace,
} from '~/utils/spaceRolesMatrixSync'

export interface SpaceMemberEntry {
  userId: string
  displayName: string
  avatarUrl?: string
  status: 'online' | 'away' | 'busy' | 'offline' | 'unknown'
}

export interface SpaceMemberGroup {
  role: SpaceRoleDefinition
  members: SpaceMemberEntry[]
}

function memberPresence(
  membership: string | undefined,
): SpaceMemberEntry['status'] {
  if (membership === 'online') {
    return 'online'
  }
  if (membership === 'unavailable') {
    return 'away'
  }
  if (membership === 'offline') {
    return 'offline'
  }
  return 'unknown'
}

export function useSpaceMembers(
  spaceId: Ref<string | null>,
  childRoomIds: Ref<string[]>,
) {
  const { client } = useMatrixClient()
  const { getMemberAvatarUrl } = useChatMedia(client)

  function isFounder(userId: string): boolean {
    return isSpaceRoomFounder(client.value, spaceId.value, userId)
  }

  const memberGroups = computed<SpaceMemberGroup[]>(() => {
    const matrixClient = client.value
    const rootSpaceId = spaceId.value
    if (!matrixClient || !rootSpaceId) {
      return []
    }
    const rolesContent = resolveSpaceRolesFromClient(
      matrixClient,
      rootSpaceId,
    )
    if (!rolesContent) {
      return []
    }
    const seenUserIds = new Set<string>()
    const membersByRoleId = new Map<string, SpaceMemberEntry[]>()
    const founderRole = createFounderRole()

    membersByRoleId.set(FOUNDER_ROLE_ID, [])
    for (const role of rolesContent.roles) {
      membersByRoleId.set(role.id, [])
    }

    const roomIds = [
      rootSpaceId,
      ...childRoomIds.value.filter((roomId) => roomId !== rootSpaceId),
    ]

    for (const roomId of roomIds) {
      const room = matrixClient.getRoom(roomId)
      if (!room) {
        continue
      }
      for (const member of room.getMembers()) {
        const memberUserId = member.userId
        if (!memberUserId || seenUserIds.has(memberUserId)) {
          continue
        }
        if (member.membership !== 'join') {
          continue
        }
        seenUserIds.add(memberUserId)
        const role = resolveUserRoleForSpace(
          matrixClient,
          rootSpaceId,
          rolesContent,
          memberUserId,
        )
        const list = membersByRoleId.get(role.id) ?? []
        list.push({
          userId: memberUserId,
          displayName:
            member.name || member.rawDisplayName || memberUserId,
          avatarUrl: getMemberAvatarUrl(member),
          status: memberPresence(member.user?.presence),
        })
        membersByRoleId.set(role.id, list)
      }
    }

    const founderMembers = (membersByRoleId.get(FOUNDER_ROLE_ID) ?? [])
      .sort((memberA, memberB) =>
        memberA.displayName.localeCompare(memberB.displayName),
      )
    const roleGroups = sortRolesByPositionDesc(rolesContent.roles)
      .map((role) => ({
        role,
        members: (membersByRoleId.get(role.id) ?? []).sort(
          (memberA, memberB) =>
            memberA.displayName.localeCompare(memberB.displayName),
        ),
      }))
      .filter((group) => group.members.length > 0)

    if (founderMembers.length === 0) {
      return roleGroups
    }
    return [{ role: founderRole, members: founderMembers }, ...roleGroups]
  })

  return { memberGroups, isFounder }
}
