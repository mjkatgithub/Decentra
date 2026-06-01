export interface StoredMatrixSession {
  baseUrl: string
  accessToken: string
  userId: string
  deviceId?: string
  refreshToken?: string
  oauthTokenExpiresAtMs?: number
  oidcTokenEndpoint?: string
  oidcClientId?: string
}

export interface StoredMatrixDevice {
  baseUrl: string
  userId: string
  deviceId: string
}

export type SessionRestoreStatus = 'idle' | 'loading' | 'success' | 'failure'

export interface MatrixEncryptedFile {
  key: {
    k: string
    kty: string
    alg: string
    key_ops: string[]
    ext: boolean
  }
  iv: string
  hashes: Record<string, string>
  v: string
  url: string
}

export interface ImageInfo {
  mimetype: string
  size: number
  w?: number
  h?: number
}

export interface AudioInfo {
  mimetype: string
  size: number
  duration?: number
}

export interface VideoInfo {
  mimetype: string
  size: number
  duration?: number
  w?: number
  h?: number
  thumbnail_url?: string
  thumbnail_info?: ImageInfo
  thumbnail_file?: MatrixEncryptedFile
}

export interface MessageReplyOptions {
  eventId: string
}

/** Options for {@link sendMessage}; legacy shape `{ eventId }` is still reply-only */
export interface SendTextMessageOptions {
  replyTo?: MessageReplyOptions
  threadRootEventId?: string
}

/** Options for {@link sendAudioMessage} */
export interface SendAudioMessageOptions {
  durationMs?: number
  /** When false, omits MSC3245 voice marker (file attachment). */
  isVoiceMessage?: boolean
  replyTo?: MessageReplyOptions
  threadRootEventId?: string
}

export interface SendImageMessageOptions {
  replyTo?: MessageReplyOptions
  threadRootEventId?: string
}

/** Options for {@link sendVideoMessage} */
export interface SendVideoMessageOptions {
  replyTo?: MessageReplyOptions
  threadRootEventId?: string
}

export interface ReactionToggleOptions {
  ownReactionEventIds?: string[]
}

export interface PublicRoomListItem {
  roomId: string
  name?: string
  topic?: string
  canonicalAlias?: string
  aliases?: string[]
  numJoinedMembers?: number
}

export interface SearchPublicRoomsResult {
  rooms: PublicRoomListItem[]
  nextBatch?: string
  prevBatch?: string
  totalRoomCountEstimate?: number
}

export interface CreateGroupRoomInput {
  name: string
  topic?: string
  /** Private = invite-only; public = joinable and directory-listed */
  visibility: 'private' | 'public'
  /** Link new room as m.space.child of this space */
  parentSpaceId?: string
  /** Sibling index on parent (default: append) */
  insertIndex?: number
  /** Matrix user IDs to invite on create */
  inviteUserIds?: string[]
}

export interface InviteUsersToRoomResult {
  invited: string[]
  failed: Array<{ userId: string; error: string }>
}

export interface CreateMatrixSpaceInput {
  name: string
  topic?: string
  visibility: 'private' | 'public'
  /** Link new space as m.space.child of this parent space */
  parentSpaceId?: string
  insertIndex?: number
  inviteUserIds?: string[]
}

export interface UserDirectoryResultItem {
  userId: string
  displayName?: string
  avatarUrl?: string
}
