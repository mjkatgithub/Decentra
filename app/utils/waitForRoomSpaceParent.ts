import type { MatrixClient } from 'matrix-js-sdk'

const POLL_MS = 100
const DEFAULT_TIMEOUT_MS = 5000

function readParentSpaceIds(room: {
  currentState?: {
    getStateEvents?: (type: string) => unknown
  }
}): string[] {
  const raw = room.currentState?.getStateEvents?.('m.space.parent')
  if (!raw) {
    return []
  }
  const events = Array.isArray(raw) ? raw : [raw]
  return events
    .map((matrixEvent) =>
      (matrixEvent as { getStateKey?: () => string }).getStateKey?.(),
    )
    .filter((spaceId): spaceId is string => Boolean(spaceId))
}

/** Wait until m.space.parent for parentSpaceId is visible locally. */
export async function waitForRoomSpaceParentLink(
  matrixClient: MatrixClient,
  roomId: string,
  parentSpaceId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const room = matrixClient.getRoom(roomId)
    if (room && readParentSpaceIds(room).includes(parentSpaceId)) {
      return
    }
    await new Promise((resolve) => {
      window.setTimeout(resolve, POLL_MS)
    })
  }
}
