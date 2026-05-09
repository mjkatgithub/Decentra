import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'
import {
  assignLexOrdersForSiblingCount,
  parseSpaceChildEvents,
  sortParsedSpaceChildren,
  SPACE_CHILD_EVENT,
  SPACE_PARENT_EVENT,
  viaServersFromRoomId,
} from '~/utils/spaceRoomCategories'

function normalizeStateEvents(raw: MatrixEvent | MatrixEvent[]): MatrixEvent[] {
  if (!raw) {
    return []
  }
  return Array.isArray(raw) ? raw : [raw]
}

export function findSpaceStateEvent(
  room: Room,
  eventType: string,
  stateKey: string,
): MatrixEvent | null {
  const raw = room.currentState?.getStateEvents?.(eventType)
  for (const matrixEvent of normalizeStateEvents(raw)) {
    if (matrixEvent?.getStateKey?.() === stateKey) {
      return matrixEvent
    }
  }
  return null
}

export async function sendSpaceChildState(
  matrixClient: MatrixClient,
  options: {
    parentSpaceId: string
    childRoomId: string
    via: string[]
    order?: string
  },
): Promise<void> {
  const content: Record<string, unknown> = { via: options.via }
  if (options.order !== undefined) {
    content.order = options.order
  }
  await matrixClient.sendStateEvent(
    options.parentSpaceId,
    SPACE_CHILD_EVENT,
    content,
    options.childRoomId,
  )
}

export async function sendSpaceParentState(
  matrixClient: MatrixClient,
  options: {
    childRoomId: string
    parentSpaceId: string
    via: string[]
  },
): Promise<void> {
  await matrixClient.sendStateEvent(
    options.childRoomId,
    SPACE_PARENT_EVENT,
    { via: options.via },
    options.parentSpaceId,
  )
}

export async function redactSpaceStateIfPresent(
  matrixClient: MatrixClient,
  roomId: string,
  eventType: string,
  stateKey: string,
): Promise<void> {
  const room = matrixClient.getRoom(roomId)
  if (!room) {
    return
  }
  const matrixEvent = findSpaceStateEvent(room, eventType, stateKey)
  const eventId = matrixEvent?.getId?.()
  if (!eventId) {
    return
  }
  await matrixClient.redactEvent(roomId, eventId)
}

export function readViaFromSpaceChild(room: Room, childRoomId: string): string[] {
  const matrixEvent = findSpaceStateEvent(room, SPACE_CHILD_EVENT, childRoomId)
  const content = matrixEvent?.getContent?.() as
    | { via?: unknown }
    | undefined
  const via = content?.via
  return Array.isArray(via)
    ? via.filter((entry): entry is string => typeof entry === 'string')
    : []
}

/**
 * Re-index order fields for all children on a parent space room.
 */
export async function persistSpaceChildOrder(
  matrixClient: MatrixClient,
  parentSpaceId: string,
  orderedChildRoomIds: string[],
): Promise<void> {
  const parentRoom = matrixClient.getRoom(parentSpaceId)
  if (!parentRoom) {
    throw new Error('Parent space room not available')
  }
  const orders = assignLexOrdersForSiblingCount(orderedChildRoomIds.length)
  for (let index = 0; index < orderedChildRoomIds.length; index++) {
    const childRoomId = orderedChildRoomIds[index]
    if (!childRoomId) {
      continue
    }
    const previousVia =
      readViaFromSpaceChild(parentRoom, childRoomId) ||
      viaServersFromRoomId(childRoomId)
    const orderValue = orders[index]
    if (!orderValue) {
      continue
    }
    await sendSpaceChildState(matrixClient, {
      parentSpaceId,
      childRoomId,
      via: previousVia.length > 0 ? previousVia : viaServersFromRoomId(childRoomId),
      order: orderValue,
    })
  }
}

export async function moveRoomBetweenParents(options: {
  matrixClient: MatrixClient
  roomId: string
  previousParentSpaceId: string | null
  nextParentSpaceId: string
  /** Insert position among siblings on next parent (default append) */
  insertIndex?: number
}): Promise<void> {
  const {
    matrixClient,
    roomId,
    previousParentSpaceId,
    nextParentSpaceId,
    insertIndex,
  } = options

  if (
    previousParentSpaceId &&
    previousParentSpaceId === nextParentSpaceId
  ) {
    return
  }

  const viaRoom = viaServersFromRoomId(roomId)
  const viaNextParent = viaServersFromRoomId(nextParentSpaceId)

  if (previousParentSpaceId) {
    await redactSpaceStateIfPresent(
      matrixClient,
      previousParentSpaceId,
      SPACE_CHILD_EVENT,
      roomId,
    )
    await redactSpaceStateIfPresent(
      matrixClient,
      roomId,
      SPACE_PARENT_EVENT,
      previousParentSpaceId,
    )
  }

  const nextParentRoom = matrixClient.getRoom(nextParentSpaceId)
  if (!nextParentRoom) {
    throw new Error('Target space room not available')
  }

  const existingChildren = sortParsedSpaceChildren(
    parseSpaceChildEvents(nextParentRoom as never),
    (childId) => childId,
  ).map((parsed) => parsed.childRoomId)

  const filtered = existingChildren.filter((childId) => childId !== roomId)
  const position =
    insertIndex === undefined || insertIndex < 0 || insertIndex > filtered.length
      ? filtered.length
      : insertIndex
  const nextOrder = [...filtered]
  nextOrder.splice(position, 0, roomId)

  await persistSpaceChildOrder(matrixClient, nextParentSpaceId, nextOrder)

  await sendSpaceParentState(matrixClient, {
    childRoomId: roomId,
    parentSpaceId: nextParentSpaceId,
    via: viaNextParent.length > 0 ? viaNextParent : viaRoom,
  })
}
