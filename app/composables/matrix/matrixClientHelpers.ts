import {
  readMatrixErrorCode,
  readMatrixErrorMessage,
} from './matrixClientShared'
import type { PublicRoomListItem } from './matrixClientTypes'

export const MATRIX_TO_BASE = 'https://matrix.to/#'

export function homeserverFromUserId(matrixUserId: string): string {
  const colonIndex = matrixUserId.indexOf(':')
  if (colonIndex < 0) {
    return ''
  }
  return matrixUserId.slice(colonIndex + 1)
}

export function normalizeMatrixUserId(
  input: string,
  defaultDomain: string,
): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Matrix user id is required')
  }
  const withAt = trimmed.startsWith('@') ? trimmed : `@${trimmed}`
  if (withAt.includes(':')) {
    return withAt
  }
  const domain = defaultDomain.trim()
  if (!domain) {
    throw new Error('Enter a full Matrix id like @name:server')
  }
  return `${withAt}:${domain}`
}

export function buildMatrixToUserLink(matrixUserId: string): string {
  const id = matrixUserId.trim()
  if (!id) {
    return MATRIX_TO_BASE
  }
  return `${MATRIX_TO_BASE}/${encodeURIComponent(id)}`
}

export function mapPublicRoomsChunk(
  chunk: Array<Record<string, unknown>>,
): PublicRoomListItem[] {
  return chunk.map((entry) => {
    const roomId = String(entry.room_id ?? '')
    return {
      roomId,
      name: typeof entry.name === 'string' ? entry.name : undefined,
      topic: typeof entry.topic === 'string' ? entry.topic : undefined,
      canonicalAlias:
        typeof entry.canonical_alias === 'string'
          ? entry.canonical_alias
          : undefined,
      aliases: Array.isArray(entry.aliases)
        ? entry.aliases.filter((alias): alias is string => typeof alias === 'string')
        : undefined,
      numJoinedMembers:
        typeof entry.num_joined_members === 'number'
          ? entry.num_joined_members
          : undefined,
    }
  })
}

export function throwMappedMatrixError(
  error: unknown,
  fallback: string,
): never {
  const code = readMatrixErrorCode(error)
  const message = readMatrixErrorMessage(error)
  if (code === 'M_FORBIDDEN' || code === 'M_UNAUTHORIZED') {
    throw new Error(message || 'This action is not allowed on this homeserver')
  }
  if (code === 'M_NOT_FOUND') {
    throw new Error(message || 'Room or user was not found')
  }
  if (code === 'M_UNRECOGNIZED' || code === 'M_UNKNOWN') {
    throw new Error(
      message || 'This homeserver does not support this operation',
    )
  }
  if (message) {
    throw new Error(message)
  }
  throw new Error(fallback)
}
