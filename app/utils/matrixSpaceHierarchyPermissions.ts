import type { MatrixClient } from 'matrix-js-sdk'

const POWER_LEVELS_TYPE = "m.room.power_levels";
const SPACE_CHILD_TYPE = "m.space.child";

function normalizeStateEvents(raw: unknown): Array<{
  getContent?: () => Record<string, unknown>;
}> {
  if (!raw) {
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}

function getPowerLevelsContent(
  matrixClient: MatrixClient,
  roomId: string,
): Record<string, unknown> | null {
  const room = matrixClient.getRoom(roomId);
  const stateEvents = room?.currentState?.getStateEvents?.(POWER_LEVELS_TYPE);
  const list = normalizeStateEvents(stateEvents);
  const first = list[0];
  const content = first?.getContent?.();
  return content && typeof content === "object" ? content : null;
}

function readNumeric(
  record: Record<string, unknown> | null,
  key: string,
): number | undefined {
  if (!record) {
    return undefined;
  }
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Power level required to send `m.space.child` state on this room (space).
 * Uses events[m.space.child] if set, else state_default (Matrix spec).
 */
export function getRequiredPowerForSpaceChild(
  powerLevelsContent: Record<string, unknown> | null,
): number {
  if (!powerLevelsContent) {
    return 100;
  }
  const events = powerLevelsContent.events as
    | Record<string, unknown>
    | undefined;
  const specific = events?.[SPACE_CHILD_TYPE];
  if (typeof specific === "number" && Number.isFinite(specific)) {
    return specific;
  }
  const stateDefault = readNumeric(powerLevelsContent, "state_default");
  if (stateDefault !== undefined) {
    return stateDefault;
  }
  return 50;
}

export function getUserPowerLevelInRoomFromState(
  powerLevelsContent: Record<string, unknown> | null,
  userId: string,
): number {
  if (!powerLevelsContent) {
    return 0;
  }
  const users = powerLevelsContent.users as
    | Record<string, unknown>
    | undefined;
  const mine = users?.[userId];
  if (typeof mine === "number" && Number.isFinite(mine)) {
    return mine;
  }
  const usersDefault = readNumeric(powerLevelsContent, "users_default");
  return usersDefault ?? 0;
}

/**
 * True if the user may send `m.space.child` on this space room (reorder/move
 * children in the hierarchy). This is room state — changes apply for all
 * members once the homeserver accepts the event.
 */
export function canUserSendSpaceChildState(
  matrixClient: MatrixClient,
  spaceRoomId: string,
  userId: string | null | undefined,
): boolean {
  if (!userId) {
    return false;
  }
  const content = getPowerLevelsContent(matrixClient, spaceRoomId);
  if (!content) {
    return false;
  }
  const myLevel = getUserPowerLevelInRoomFromState(content, userId);
  const required = getRequiredPowerForSpaceChild(content);
  return myLevel >= required;
}
