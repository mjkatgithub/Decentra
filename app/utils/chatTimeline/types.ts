export interface ChatTimelineMedia {
  url: string
  mxcUrl: string
  mimetype?: string
  isEncrypted?: boolean
  encryptionInfo?: Record<string, any>
  playbackUrl?: string
  playbackMxcUrl?: string
  playbackMimetype?: string
  playbackIsEncrypted?: boolean
  playbackEncryptionInfo?: Record<string, any>
  info?: {
    w?: number
    h?: number
    size?: number
    duration?: number
  }
}

export interface ChatThreadLastReply {
  eventId: string
  senderName: string
  body: string
  originServerTs: number
  avatarUrl?: string
}

export interface ChatThreadSummary {
  replyCount: number
  lastReply?: ChatThreadLastReply
}

export interface ChatTimelineMessage {
  id: string
  kind: 'message' | 'notice'
  isDecryptionError?: boolean
  isMessageDeleted?: boolean
  senderId: string
  senderName: string
  avatarUrl?: string
  body: string
  replyTo?: ChatTimelineReply
  media?: ChatTimelineMedia
  reactions: ChatTimelineReaction[]
  readBy: Array<{
    userId: string
    displayName: string
    avatarUrl?: string
  }>
  /** Present on root messages that have thread replies (MSC3440) */
  threadSummary?: ChatThreadSummary
  isEdited?: boolean
  /** Event id to pass to m.replace when editing (original, not latest replace) */
  editTargetEventId?: string
  /** Chronological position (original ts for m.replace replacements) */
  originServerTs?: number
}

export interface ChatTimelineReaction {
  emoji: string
  count: number
  hasOwnReaction: boolean
  ownReactionEventIds: string[]
}

export type ChatTimelineReplyMsgtype =
  | 'm.text'
  | 'm.image'
  | 'm.video'
  | 'm.audio'

export interface ChatTimelineReply {
  eventId: string
  senderName: string
  body: string
  msgtype?: ChatTimelineReplyMsgtype
  media?: ChatTimelineMedia
}

export interface TimelineWindowOptions {
  windowSize: number
  anchorEventId?: string
}

export interface TimelineWindowSelection {
  startIndex: number
  endIndex: number
  anchorIndex: number | null
  anchorFound: boolean
}

export interface PreservedTimelineWindowInput {
  previousStartIndex: number
  previousEndIndex: number
  previousEventCount: number
  previousFirstMessageId?: string
  previousLastMessageId?: string
  nextEventIds: string[]
  windowSize: number
  stickToBottom: boolean
}

export interface PreservedTimelineWindowSelection {
  startIndex: number
  endIndex: number
  shouldScrollToBottom: boolean
}

export interface ThreadNavEntry {
  rootEventId: string
  title: string
  replyCount: number
  lastActivityTs: number
  lastReplySenderName?: string
  lastReplyBody?: string
  lastReplyAvatarUrl?: string
  hasUnread?: boolean
  hasMentionUnread?: boolean
}

export interface BuildRoomThreadNavOptions {
  /** Pass null to list every thread regardless of age. */
  maxAgeDays?: number | null
  nowMs?: number
}

export interface GetMessageBodyOptions {
  redactedMessage?: boolean
  deletedMessageText?: string
}

export type TimelineEventRecord = Record<string, any>

export interface MapTimelineArgs {
  room: Record<string, any>
  ownUserId: string | undefined
  getMemberAvatarUrl: (member: Record<string, any>) => string | undefined
  getMediaUrl: (
    mxcUrl: string,
    mimetype?: string,
    body?: string,
  ) => string | undefined
  buildNoticeText: (
    timelineEvent: Record<string, any>,
    room: Record<string, any>,
  ) => string
  buildDeletedMessageText: () => string
}

export type TimelineMappingMode =
  | { kind: 'main' }
  | { kind: 'thread'; rootEventId: string }

export interface MessageRelationIndex {
  threadRootByMessageId: Map<string, string>
  supersededMessageIds: Set<string>
  displayTsByEventId: Map<string, number>
}
