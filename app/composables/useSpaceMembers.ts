import { useMatrixClient } from '~/composables/useMatrixClient'
import { useChatMedia } from '~/composables/useChatMedia'
import {
  getSpaceRolesFromClient,
  resolveUserRole,
  sortRolesByPositionDesc,
  type SpaceRoleDefinition,
} from '~/utils/decentraSpaceRoles'

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

  const memberGroups = computed<SpaceMemberGroup[]>(() => {
    const matrixClient = client.value
    const rootSpaceId = spaceId.value
    if (!matrixClient || !rootSpaceId) {
      return []
    }
    const rolesContent = getSpaceRolesFromClient(matrixClient, rootSpaceId)
    if (!rolesContent) {
      return []
    }
    const seenUserIds = new Set<string>()
    const membersByRoleId = new Map<string, SpaceMemberEntry[]>()

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
        const role = resolveUserRole(rolesContent, memberUserId)
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

    return sortRolesByPositionDesc(rolesContent.roles)
      .map((role) => ({
        role,
        members: (membersByRoleId.get(role.id) ?? []).sort((memberA, memberB) =>
          memberA.displayName.localeCompare(memberB.displayName),
        ),
      }))
      .filter((group) => group.members.length > 0)
  })

  return { memberGroups }
}
