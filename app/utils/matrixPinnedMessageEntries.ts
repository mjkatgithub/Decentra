import type { MatrixEvent, Room } from 'matrix-js-sdk'

export interface PinnedMessageEntry {
  eventId: string
  senderName: string
  snippet: string
  pinnedAtTs: number
  isUnavailable?: boolean
}

export interface BuildPinnedMessageEntriesOptions {
  unavailableSnippet: string
  resolveSenderName?: (
    event: MatrixEvent,
    senderId: string,
  ) => string
}

const SNIPPET_MAX_LENGTH = 96

export function clipPinnedSnippet(body: string | undefined): string {
  const firstLine = body?.split('\n')[0]?.trim() ?? ''
  if (!firstLine) {
    return ''
  }
  if (firstLine.length <= SNIPPET_MAX_LENGTH) {
    return firstLine
  }
  return `${firstLine.slice(0, SNIPPET_MAX_LENGTH - 3)}...`
}

function resolveSenderId(event: MatrixEvent): string {
  return event.getSender?.() ?? ''
}

function resolveMessageBody(event: MatrixEvent): string {
  const content = event.getContent?.() ?? {}
  const body = content.body
  return typeof body === 'string' ? body : ''
}

function resolvePinnedAtTs(event: MatrixEvent): number {
  const originServerTs = event.getTs?.()
  if (typeof originServerTs === 'number' && Number.isFinite(originServerTs)) {
    return originServerTs
  }
  return Date.now()
}

export function buildPinnedMessageEntries(
  room: Room,
  pinnedIds: string[],
  options: BuildPinnedMessageEntriesOptions,
): PinnedMessageEntry[] {
  const displayOrder = [...pinnedIds].reverse()
  return displayOrder.map((eventId) => {
    const matrixEvent = room.findEventById?.(eventId) ?? null
    if (!matrixEvent || matrixEvent.isRedacted?.()) {
      return {
        eventId,
        senderName: '',
        snippet: options.unavailableSnippet,
        pinnedAtTs: 0,
        isUnavailable: true,
      }
    }
    const senderId = resolveSenderId(matrixEvent)
    const senderName = options.resolveSenderName?.(
      matrixEvent,
      senderId,
    ) ?? senderId
    return {
      eventId,
      senderName,
      snippet: clipPinnedSnippet(resolveMessageBody(matrixEvent)),
      pinnedAtTs: resolvePinnedAtTs(matrixEvent),
      isUnavailable: false,
    }
  })
}
