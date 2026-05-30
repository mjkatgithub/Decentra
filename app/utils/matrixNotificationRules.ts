/**
 * Maps Matrix push rules to a small set of per-room notification levels,
 * mirroring Element's room notification states. Pure helpers only; the
 * imperative push-rule writes live in `useNotificationSettings`.
 */

export type RoomNotificationLevel = 'default' | 'all' | 'mentions' | 'mute'

/** Aggregate level for a whole space; `mixed` when child rooms disagree. */
export type SpaceNotificationLevel = RoomNotificationLevel | 'mixed'

export const ROOM_NOTIFICATION_LEVELS: RoomNotificationLevel[] = [
  'default',
  'all',
  'mentions',
  'mute',
]

interface PushRuleLike {
  rule_id?: string
  enabled?: boolean
  actions?: Array<unknown>
  conditions?: Array<{ kind?: string; key?: string; pattern?: string }>
}

interface PushRulesLike {
  global?: {
    override?: PushRuleLike[]
    room?: PushRuleLike[]
  }
}

function actionsTriggerNotify(actions: Array<unknown> | undefined): boolean {
  if (!actions || actions.length === 0) {
    return false
  }
  return actions.some((action) => action === 'notify')
}

/** Empty actions or a lone `dont_notify` squelch notifications (Element). */
export function isMutePushRuleActions(
  actions: Array<unknown> | undefined,
): boolean {
  if (!actions || actions.length === 0) {
    return true
  }
  return actions.length === 1 && actions[0] === 'dont_notify'
}

/** Room-specific rule whose id matches the room (push rule kind `room`). */
export function findRoomPushRule(
  pushRules: PushRulesLike | null | undefined,
  roomId: string,
): PushRuleLike | undefined {
  const roomRules = pushRules?.global?.room ?? []
  return roomRules.find((rule) => rule.rule_id === roomId)
}

/**
 * Override rule that squelches a whole room (used for the "mute" state).
 * Element keys this rule by the room id and matches on `room_id`.
 */
export function findOverrideMuteRule(
  pushRules: PushRulesLike | null | undefined,
  roomId: string,
): PushRuleLike | undefined {
  const overrideRules = pushRules?.global?.override ?? []
  return overrideRules.find((rule) => {
    if (rule.rule_id === roomId) {
      return isMutePushRuleActions(rule.actions)
    }
    const conditions = rule.conditions ?? []
    if (conditions.length !== 1) {
      return false
    }
    const [condition] = conditions
    return (
      condition?.kind === 'event_match' &&
      condition?.key === 'room_id' &&
      condition?.pattern === roomId &&
      isMutePushRuleActions(rule.actions)
    )
  })
}

export function resolveRoomNotificationLevel(
  pushRules: PushRulesLike | null | undefined,
  roomId: string,
): RoomNotificationLevel {
  if (!roomId) {
    return 'default'
  }

  const overrideMuteRule = findOverrideMuteRule(pushRules, roomId)
  if (overrideMuteRule && overrideMuteRule.enabled !== false) {
    return 'mute'
  }

  const roomRule = findRoomPushRule(pushRules, roomId)
  if (!roomRule || roomRule.enabled === false) {
    return 'default'
  }

  if (actionsTriggerNotify(roomRule.actions)) {
    return 'all'
  }
  return 'mentions'
}

/** Aggregate the per-room levels into one space-level value. */
export function resolveSpaceNotificationLevel(
  levels: RoomNotificationLevel[],
): SpaceNotificationLevel {
  if (levels.length === 0) {
    return 'default'
  }
  const [first, ...rest] = levels
  const allEqual = rest.every((level) => level === first)
  return allEqual ? first! : 'mixed'
}
