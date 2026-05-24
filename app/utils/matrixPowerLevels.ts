import type { MatrixClient } from 'matrix-js-sdk'

const POWER_LEVELS_TYPE = 'm.room.power_levels'
const ROOM_CREATE_TYPE = 'm.room.create'
const EMPTY_STATE_KEY = ''

function normalizeStateEvents(raw: unknown): Array<{
  getContent?: () => Record<string, unknown>
}> {
  if (!raw) {
    return []
  }
  return Array.isArray(raw) ? raw : [raw]
}

export function getPowerLevelsContent(
  matrixClient: MatrixClient,
  roomId: string,
): Record<string, unknown> | null {
  const room = matrixClient.getRoom(roomId)
  const stateEvents = room?.currentState?.getStateEvents?.(
    POWER_LEVELS_TYPE,
  )
  const list = normalizeStateEvents(stateEvents)
  const first = list[0]
  const content = first?.getContent?.()
  return content && typeof content === 'object' ? content : null
}

export function readNumericPowerLevel(
  record: Record<string, unknown> | null,
  key: string,
): number | undefined {
  if (!record) {
    return undefined
  }
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}

export function getUserPowerLevelInRoomFromState(
  powerLevelsContent: Record<string, unknown> | null,
  userId: string,
): number {
  if (!powerLevelsContent) {
    return 0
  }
  const users = powerLevelsContent.users as
    | Record<string, unknown>
    | undefined
  const mine = users?.[userId]
  if (typeof mine === 'number' && Number.isFinite(mine)) {
    return mine
  }
  const usersDefault = readNumericPowerLevel(
    powerLevelsContent,
    'users_default',
  )
  return usersDefault ?? 0
}

export function getRoomCreatorUserId(
  matrixClient: MatrixClient,
  roomId: string,
): string | undefined {
  const room = matrixClient.getRoom(roomId)
  const stateEvents = room?.currentState?.getStateEvents?.(
    ROOM_CREATE_TYPE,
    EMPTY_STATE_KEY,
  )
  const list = normalizeStateEvents(stateEvents)
  const creator = list[0]?.getContent?.()?.creator
  return typeof creator === 'string' ? creator : undefined
}
