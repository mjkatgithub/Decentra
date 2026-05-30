import { describe, expect, it } from 'vitest'
import {
  findOverrideMuteRule,
  resolveRoomNotificationLevel,
  resolveSpaceNotificationLevel,
} from '~/utils/matrixNotificationRules'

const ROOM_ID = '!room:example.org'

function pushRulesWith(options: {
  room?: Array<Record<string, unknown>>
  override?: Array<Record<string, unknown>>
}) {
  return {
    global: {
      override: options.override ?? [],
      room: options.room ?? [],
    },
  }
}

describe('resolveRoomNotificationLevel', () => {
  it('returns default when no room or override rule exists', () => {
    expect(resolveRoomNotificationLevel(pushRulesWith({}), ROOM_ID)).toBe(
      'default',
    )
  })

  it('returns default for empty room id', () => {
    expect(resolveRoomNotificationLevel(pushRulesWith({}), '')).toBe('default')
  })

  it('returns all when the room rule triggers notify', () => {
    const pushRules = pushRulesWith({
      room: [
        {
          rule_id: ROOM_ID,
          enabled: true,
          actions: ['notify', { set_tweak: 'sound', value: 'default' }],
        },
      ],
    })
    expect(resolveRoomNotificationLevel(pushRules, ROOM_ID)).toBe('all')
  })

  it('returns mentions when the room rule has no notify action', () => {
    const pushRules = pushRulesWith({
      room: [{ rule_id: ROOM_ID, enabled: true, actions: [] }],
    })
    expect(resolveRoomNotificationLevel(pushRules, ROOM_ID)).toBe('mentions')
  })

  it('returns mentions when the room rule uses dont_notify', () => {
    const pushRules = pushRulesWith({
      room: [
        {
          rule_id: ROOM_ID,
          enabled: true,
          actions: ['dont_notify'],
        },
      ],
    })
    expect(resolveRoomNotificationLevel(pushRules, ROOM_ID)).toBe('mentions')
  })

  it('treats a disabled room rule as default', () => {
    const pushRules = pushRulesWith({
      room: [{ rule_id: ROOM_ID, enabled: false, actions: [] }],
    })
    expect(resolveRoomNotificationLevel(pushRules, ROOM_ID)).toBe('default')
  })

  it('returns mute when an override squelch rule matches the room', () => {
    const pushRules = pushRulesWith({
      override: [
        {
          rule_id: ROOM_ID,
          enabled: true,
          conditions: [
            { kind: 'event_match', key: 'room_id', pattern: ROOM_ID },
          ],
          actions: ['dont_notify'],
        },
      ],
      room: [{ rule_id: ROOM_ID, enabled: true, actions: [] }],
    })
    expect(resolveRoomNotificationLevel(pushRules, ROOM_ID)).toBe('mute')
  })

  it('returns mute for legacy empty-action override mute rules', () => {
    const pushRules = pushRulesWith({
      override: [
        {
          rule_id: ROOM_ID,
          enabled: true,
          conditions: [
            { kind: 'event_match', key: 'room_id', pattern: ROOM_ID },
          ],
          actions: [],
        },
      ],
    })
    expect(resolveRoomNotificationLevel(pushRules, ROOM_ID)).toBe('mute')
  })

  it('ignores a disabled override mute rule', () => {
    const pushRules = pushRulesWith({
      override: [
        {
          rule_id: ROOM_ID,
          enabled: false,
          conditions: [
            { kind: 'event_match', key: 'room_id', pattern: ROOM_ID },
          ],
          actions: [],
        },
      ],
    })
    expect(resolveRoomNotificationLevel(pushRules, ROOM_ID)).toBe('default')
  })

  it('does not treat a notifying override as a mute rule', () => {
    const pushRules = pushRulesWith({
      override: [
        {
          rule_id: 'other',
          enabled: true,
          conditions: [
            { kind: 'event_match', key: 'room_id', pattern: ROOM_ID },
          ],
          actions: ['notify'],
        },
      ],
    })
    expect(findOverrideMuteRule(pushRules, ROOM_ID)).toBeUndefined()
  })
})

describe('resolveSpaceNotificationLevel', () => {
  it('returns default for an empty space', () => {
    expect(resolveSpaceNotificationLevel([])).toBe('default')
  })

  it('returns the shared level when all rooms agree', () => {
    expect(resolveSpaceNotificationLevel(['mute', 'mute'])).toBe('mute')
  })

  it('returns mixed when rooms disagree', () => {
    expect(resolveSpaceNotificationLevel(['mute', 'all'])).toBe('mixed')
  })
})
