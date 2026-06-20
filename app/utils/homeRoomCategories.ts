/** Inputs for sorting a Matrix room into Home sidebar sections. */
export interface HomeRoomCategoryInput {
  parentSpaceIds: string[]
  joinedMemberCount: number
  isDirectMessage: boolean
}

/**
 * Personal chat: exactly two joined members and Matrix marks the room as a DM.
 */
export function isPersonalChatFromCounts(
  input: HomeRoomCategoryInput,
): boolean {
  if (input.parentSpaceIds.length > 0) {
    return false
  }
  if (input.joinedMemberCount !== 2) {
    return false
  }
  return input.isDirectMessage
}

/**
 * Home group: any non-space room that is not a 1:1 DM (includes rooms with
 * pending invites or a single joined member).
 */
export function isHomeGroupChatFromCounts(
  input: HomeRoomCategoryInput,
): boolean {
  if (input.parentSpaceIds.length > 0) {
    return false
  }
  return !isPersonalChatFromCounts(input)
}
