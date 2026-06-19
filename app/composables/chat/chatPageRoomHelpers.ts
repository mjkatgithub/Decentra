import { EventType } from "matrix-js-sdk";
import type { Room } from "matrix-js-sdk";
import {
  isHomeGroupChatFromCounts,
  isPersonalChatFromCounts,
} from "~/utils/homeRoomCategories";
import { getRoomNameFromState } from "~/utils/matrixRoomMetadata";
import { readStoredMatrixPresence } from "~/utils/matrixPresencePreference";
import type {
  MemberItem,
  PresenceStatus,
  RoomItem,
} from "~/composables/chat/chatPageTypes";

export function getRoomType(
  room: Record<string, any>,
): string | undefined {
  return (room as { getType?: () => string }).getType?.();
}

export function getParentSpaceIds(
  room: Record<string, any>,
): string[] {
  const currentState = room.currentState;
  const stateEvents = currentState?.getStateEvents?.("m.space.parent");

  if (!stateEvents) {
    return [];
  }

  const normalizedEvents = Array.isArray(stateEvents)
    ? stateEvents
    : [stateEvents];

  return normalizedEvents
    .map((stateEvent) => stateEvent?.getStateKey?.())
    .filter((spaceId): spaceId is string => Boolean(spaceId));
}

export function getMatrixRoomId(room: unknown): string {
  return String((room as { roomId: string }).roomId);
}

export function roomIsListedInDirectAccountData(
  client: { getAccountData: (type: string) => unknown } | null,
  roomId: string,
): boolean {
  if (!client) {
    return false;
  }
  const directEvent = client.getAccountData(EventType.Direct);
  const content = (directEvent as { getContent?: () => Record<string, string[]> })
    ?.getContent?.();
  if (!content) {
    return false;
  }
  return Object.values(content).some((ids) => ids?.includes(roomId));
}

export function countJoinedMembersForRoom(
  matrixRoom: Record<string, unknown> | undefined,
): number {
  if (!matrixRoom) {
    return 0;
  }
  const members = (
    matrixRoom as { getMembers?: () => Array<{ membership?: string }> }
  ).getMembers?.();
  if (members && members.length > 0) {
    const joinedCount = members.filter(
      (member) => member.membership === "join",
    ).length;
    if (joinedCount > 0) {
      return joinedCount;
    }
  }
  const summaryCount = Number(
    (matrixRoom as { getJoinedMemberCount?: () => number })
      .getJoinedMemberCount?.() ?? 0,
  );
  if (summaryCount > 0) {
    return summaryCount;
  }
  const currentState = (matrixRoom as {
    currentState?: {
      getStateEvents?: (eventType: string) => unknown;
    };
  }).currentState;
  const memberEvents = currentState?.getStateEvents?.("m.room.member");
  const normalizedEvents = Array.isArray(memberEvents)
    ? memberEvents
    : memberEvents
      ? [memberEvents]
      : [];
  return normalizedEvents.filter((stateEvent) => {
    const content = (
      stateEvent as { getContent?: () => { membership?: string } }
    ).getContent?.();
    return content?.membership === "join";
  }).length;
}

function roomCreateIsDirect(matrixRoom: Record<string, unknown>): boolean {
  const currentState = (matrixRoom as {
    currentState?: {
      getStateEvents?: (
        eventType: string,
        stateKey: string,
      ) => unknown;
    };
  }).currentState;
  const createEvent = currentState?.getStateEvents?.(
    "m.room.create",
    "",
  ) as { getContent?: () => { is_direct?: boolean } } | undefined;
  return createEvent?.getContent?.()?.is_direct === true;
}

/** 1:1 DM: m.direct entry, is_direct on create, or Matrix DM inviter hint. */
export function isDirectMessageRoom(
  roomId: string,
  matrixRoom: Record<string, unknown> | undefined,
  client: { getAccountData: (type: string) => unknown } | null,
): boolean {
  if (roomIsListedInDirectAccountData(client, roomId)) {
    return true;
  }
  if (matrixRoom && roomCreateIsDirect(matrixRoom)) {
    return true;
  }
  const dmInviter = (
    matrixRoom as { getDMInviter?: () => string | undefined }
  ).getDMInviter?.();
  return Boolean(dmInviter);
}

export function homeRoomCategoryInput(
  room: RoomItem,
  matrixRooms: Array<Record<string, unknown>>,
  client: { getAccountData: (type: string) => unknown } | null,
): {
  parentSpaceIds: string[];
  joinedMemberCount: number;
  isDirectMessage: boolean;
} {
  const matrixRoom = matrixRooms.find(
    (entry) => entry.roomId === room.roomId,
  );
  return {
    parentSpaceIds: room.parentSpaceIds,
    joinedMemberCount: countJoinedMembersForRoom(matrixRoom),
    isDirectMessage: isDirectMessageRoom(room.roomId, matrixRoom, client),
  };
}

export function isPersonalChatRoom(
  room: RoomItem,
  matrixRooms: Array<Record<string, unknown>>,
  client: { getAccountData: (type: string) => unknown } | null,
): boolean {
  return isPersonalChatFromCounts(
    homeRoomCategoryInput(room, matrixRooms, client),
  );
}

export function isGroupChatRoom(
  room: RoomItem,
  matrixRooms: Array<Record<string, unknown>>,
  client: { getAccountData: (type: string) => unknown } | null,
): boolean {
  return isHomeGroupChatFromCounts(
    homeRoomCategoryInput(room, matrixRooms, client),
  );
}

export function resolveSidebarRoomName(
  room: Record<string, unknown>,
  translateText: (key: string) => string,
): string {
  const rawName = String((room as { name?: string }).name ?? "").trim();
  if (rawName) {
    return rawName;
  }
  const fromState = getRoomNameFromState(room as Room).trim();
  if (fromState) {
    return fromState;
  }
  return translateText("layout.roomFallback");
}

export function toCategoryRoomBase(room: { roomId: string; name: string }) {
  return {
    roomId: room.roomId,
    name: room.name,
  };
}

export function normalizePresence(
  rawPresence: string | undefined,
): PresenceStatus {
  if (rawPresence === "online") {
    return "online";
  }
  if (rawPresence === "org.matrix.msc3026.busy" || rawPresence === "busy") {
    return "busy";
  }
  if (rawPresence === "dnd") {
    return "busy";
  }
  if (rawPresence === "unavailable") {
    return "away";
  }
  if (rawPresence === "offline") {
    return "offline";
  }
  return "unknown";
}

export function resolveRawMemberPresence(
  member: {
    userId?: string;
    user?: { presence?: string };
    presence?: string;
  },
  matrixClient: {
    getUserId?: () => string | null;
    getUser?: (userId: string) => { presence?: string } | null;
  } | null,
): string | undefined {
  const ownUserId = matrixClient?.getUserId?.() ?? null;
  const memberUserId =
    typeof member.userId === "string" ? member.userId : null;
  if (ownUserId && memberUserId === ownUserId) {
    const storedPresence = readStoredMatrixPresence();
    if (typeof storedPresence === "string") {
      return storedPresence;
    }
    const ownPresence = matrixClient?.getUser?.(ownUserId)?.presence;
    if (typeof ownPresence === "string") {
      return ownPresence;
    }
  }
  if (typeof member.user?.presence === "string") {
    return member.user.presence;
  }
  if (typeof member.presence === "string") {
    return member.presence;
  }
  return undefined;
}

export function buildSortedMemberItems(
  room: Record<string, any> | null | undefined,
  getMemberAvatarUrl: (member: Record<string, any>) => string | undefined,
  matrixClient: {
    getUserId?: () => string | null;
    getUser?: (userId: string) => { presence?: string } | null;
  } | null,
): MemberItem[] {
  if (!room) {
    return [];
  }
  const statusRank = {
    online: 0,
    busy: 1,
    away: 2,
    offline: 3,
    unknown: 4,
  } as const;
  return room
    .getMembers()
    .map((member: Record<string, any>) => ({
      userId: String(member.userId || ""),
      displayName: String(member.name || member.userId || ""),
      avatarUrl: getMemberAvatarUrl(member),
      status: normalizePresence(
        resolveRawMemberPresence(member, matrixClient),
      ),
    }))
    .sort((memberA: MemberItem, memberB: MemberItem) => {
      const statusRankDiff =
        statusRank[memberA.status] - statusRank[memberB.status];
      if (statusRankDiff !== 0) {
        return statusRankDiff;
      }
      return memberA.displayName.localeCompare(memberB.displayName);
    });
}
