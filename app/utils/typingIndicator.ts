export type TypingTranslateFn = (
  key: string,
  placeholders?: Record<string, string>,
) => string

export interface TypingMemberLike {
  userId?: string
  name?: string
  typing?: boolean
  membership?: string
}

export interface TypingRoomLike {
  getMembers?: () => TypingMemberLike[]
}

export function resolveTypingDisplayName(
  member: TypingMemberLike,
): string {
  const userId = String(member.userId ?? '')
  return String(member.name || userId)
}

export function getTypingMembers(
  room: TypingRoomLike | null | undefined,
  currentUserId: string | null | undefined,
): TypingMemberLike[] {
  if (!room?.getMembers) {
    return []
  }
  const selfId = currentUserId ?? ''
  return room
    .getMembers()
    .filter((member) => {
      if (!member.typing) {
        return false
      }
      if (member.membership && member.membership !== 'join') {
        return false
      }
      const memberId = String(member.userId ?? '')
      return memberId.length > 0 && memberId !== selfId
    })
}

export function buildTypingIndicatorLabel(
  members: TypingMemberLike[],
  translateText: TypingTranslateFn,
): string | null {
  const names = members.map((member) => resolveTypingDisplayName(member))
  if (names.length === 0) {
    return null
  }
  if (names.length === 1) {
    return translateText('chat.typingOne', { name: names[0]! })
  }
  if (names.length === 2) {
    return translateText('chat.typingTwo', {
      first: names[0]!,
      second: names[1]!,
    })
  }
  const first = names[0]!
  const second = names[1]!
  const othersCount = names.length - 2
  if (othersCount === 1) {
    return translateText('chat.typingManyOneOther', { first, second })
  }
  return translateText('chat.typingManyOthers', {
    first,
    second,
    count: String(othersCount),
  })
}
