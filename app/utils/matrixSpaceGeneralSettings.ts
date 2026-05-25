import type { MatrixClient, Room } from 'matrix-js-sdk'
import { EventType, JoinRule } from 'matrix-js-sdk'

const EMPTY_STATE_KEY = ''

export type SpaceAccessRule = JoinRule.Public | JoinRule.Invite | JoinRule.Knock

export const SPACE_ACCESS_OPTIONS: SpaceAccessRule[] = [
  JoinRule.Public,
  JoinRule.Invite,
  JoinRule.Knock,
]

export function readJoinRuleFromRoom(room: Room | null): JoinRule {
  const joinRule = room?.getJoinRule?.()
  if (joinRule === JoinRule.Public) {
    return JoinRule.Public
  }
  if (joinRule === JoinRule.Knock) {
    return JoinRule.Knock
  }
  return JoinRule.Invite
}

export type RoomDirectoryVisibility = 'public' | 'private'

export async function readDirectoryVisibility(
  matrixClient: MatrixClient,
  roomId: string,
): Promise<boolean> {
  try {
    const response = await matrixClient.getRoomDirectoryVisibility(roomId)
    const visibility = (response as { visibility?: string })?.visibility
    return visibility === 'public'
  } catch {
    return false
  }
}

export async function setDirectoryVisibility(
  matrixClient: MatrixClient,
  roomId: string,
  published: boolean,
): Promise<void> {
  const visibility: RoomDirectoryVisibility = published ? 'public' : 'private'
  await matrixClient.setRoomDirectoryVisibility(roomId, visibility)
}

export function readPublishedAddresses(room: Room | null): {
  canonical: string | null
  alternatives: string[]
} {
  if (!room) {
    return { canonical: null, alternatives: [] }
  }
  const canonical = room.getCanonicalAlias?.() ?? null
  const alternatives = room.getAltAliases?.() ?? []
  return { canonical, alternatives }
}

export function canSetJoinRule(
  matrixClient: MatrixClient | null,
  roomId: string | null,
  userId: string | null | undefined,
): boolean {
  if (!matrixClient || !roomId || !userId) {
    return false
  }
  const roomState = matrixClient.getRoom(roomId)?.currentState
  return roomState?.maySendStateEvent?.(EventType.RoomJoinRules, userId) ?? false
}

export async function setSpaceJoinRule(
  matrixClient: MatrixClient,
  roomId: string,
  joinRule: SpaceAccessRule,
): Promise<void> {
  await matrixClient.sendStateEvent(
    roomId,
    EventType.RoomJoinRules,
    { join_rule: joinRule },
    EMPTY_STATE_KEY,
  )
}

export function readRoomVersion(room: Room | null): string {
  if (!room) {
    return ''
  }
  return String(room.getVersion?.() ?? '')
}
