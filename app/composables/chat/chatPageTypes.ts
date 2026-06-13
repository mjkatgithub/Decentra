import type { ChatTimelineReply } from "~/utils/chatTimeline";

export type PresenceStatus =
  | "online"
  | "away"
  | "busy"
  | "offline"
  | "unknown";

export interface ChatMessage {
  id: string;
  kind: "message" | "notice";
  isDecryptionError?: boolean;
  isMessageDeleted?: boolean;
  senderId: string;
  senderName: string;
  avatarUrl?: string;
  body: string;
  replyTo?: ChatTimelineReply;
  media?: {
    url: string;
    mxcUrl: string;
    mimetype?: string;
    isEncrypted?: boolean;
    encryptionInfo?: Record<string, any>;
    info?: {
      w?: number;
      h?: number;
      size?: number;
    };
  };
  reactions: Array<{
    emoji: string;
    count: number;
    hasOwnReaction: boolean;
    ownReactionEventIds: string[];
  }>;
  readBy: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string;
  }>;
  threadSummary?: {
    replyCount: number;
    lastReply?: {
      eventId: string;
      senderName: string;
      body: string;
      originServerTs: number;
    };
  };
  isEdited?: boolean;
  editTargetEventId?: string;
}

export type ThreadPresentation = "sidebar" | "main";

export type RightSidebarView = "members" | "threads" | "pinned";

export interface ActiveThreadState {
  roomId: string;
  rootEventId: string;
  presentation: ThreadPresentation;
}

export interface SpaceItem {
  id: string;
  name: string;
  avatarUrl?: string;
  hasUnread?: boolean;
  hasMentionUnread?: boolean;
  totalCount?: number;
  highlightCount?: number;
}

export interface RoomItem {
  roomId: string;
  name: string;
  parentSpaceIds: string[];
}

export interface RoomCategoryGroup {
  id: string;
  name: string;
  kind: "root" | "subspace";
  subspaceRoomId?: string;
  nestingDepth?: number;
  parentSubspaceId?: string;
  rootChildAnchorIds: string[];
  canReorderRooms: boolean;
  rooms: Array<{
    roomId: string;
    name: string;
    hasUnread?: boolean;
    hasMentionUnread?: boolean;
    isJoined?: boolean;
  }>;
  /** Lobby: user joined this subspace room */
  isSubspaceJoined?: boolean;
}

export interface MemberItem {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  status: PresenceStatus;
}

export const MOBILE_BREAKPOINT = 1024;
export const INITIAL_TIMELINE_WINDOW_SIZE = 80;
export const SCROLL_WINDOW_EXPAND_STEP = 40;
export const JUMP_TO_MESSAGE_MAX_PAGINATIONS = 20;
