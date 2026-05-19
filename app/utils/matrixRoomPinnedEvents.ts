import type { MatrixClient } from 'matrix-js-sdk'

import { PINNED_EVENTS_TYPE } from '~/utils/matrixRoomPinnedEventsPermissions'

const PINNED_STATE_KEY = ''

function normalizeStateEvents(raw: unknown): Array<{
  getContent?: () => Record<string, unknown>
}> {
  if (!raw) {
    return []
  }
  return Array.isArray(raw) ? raw : [raw]
}

function parsePinnedIds(content: Record<string, unknown> | null): string[] {
  if (!content) {
    return []
  }
  const pinned = content.pinned
  if (!Array.isArray(pinned)) {
    return []
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of pinned) {
    if (typeof entry !== 'string' || !entry.trim()) {
      continue
    }
    const eventId = entry.trim()
    if (seen.has(eventId)) {
      continue
    }
    seen.add(eventId)
    result.push(eventId)
  }
  return result
}

export function getPinnedEventIds(
  matrixClient: MatrixClient,
  roomId: string,
): string[] {
  const room = matrixClient.getRoom(roomId)
  const stateEvents = room?.currentState?.getStateEvents?.(
    PINNED_EVENTS_TYPE,
    PINNED_STATE_KEY,
  )
  const list = normalizeStateEvents(stateEvents)
  const first = list[0]
  return parsePinnedIds(first?.getContent?.() ?? null)
}

export async function pinRoomEvent(
  matrixClient: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<void> {
  const trimmedEventId = eventId.trim()
  if (!trimmedEventId) {
    throw new Error('Event id is required')
  }
  const pinned = getPinnedEventIds(matrixClient, roomId)
  if (pinned.includes(trimmedEventId)) {
    return
  }
  await matrixClient.sendStateEvent(
    roomId,
    PINNED_EVENTS_TYPE,
    { pinned: [...pinned, trimmedEventId] },
    PINNED_STATE_KEY,
  )
}

export async function unpinRoomEvent(
  matrixClient: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<void> {
  const trimmedEventId = eventId.trim()
  if (!trimmedEventId) {
    throw new Error('Event id is required')
  }
  const pinned = getPinnedEventIds(matrixClient, roomId)
  const nextPinned = pinned.filter((id) => id !== trimmedEventId)
  if (nextPinned.length === pinned.length) {
    return
  }
  await matrixClient.sendStateEvent(
    roomId,
    PINNED_EVENTS_TYPE,
    { pinned: nextPinned },
    PINNED_STATE_KEY,
  )
}
