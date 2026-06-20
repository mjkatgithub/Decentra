import { describe, expect, it } from 'vitest'
import { shouldNotifyIncomingMessage } from '~/utils/incomingMessageNotify'

const ROOM_ID = '!room:example.org'
const OTHER_ROOM = '!other:example.org'

const baseState = {
  hasUnread: true,
  totalCount: 2,
  highlightCount: 0,
  hasMentionUnread: false,
}

describe('shouldNotifyIncomingMessage', () => {
  it('returns false when sound is disabled', () => {
    expect(
      shouldNotifyIncomingMessage({
        roomId: ROOM_ID,
        selectedRoomId: OTHER_ROOM,
        notificationLevel: 'all',
        current: baseState,
        previous: { ...baseState, totalCount: 1 },
        soundEnabled: false,
      }),
    ).toBe(false)
  })

  it('returns false for muted rooms', () => {
    expect(
      shouldNotifyIncomingMessage({
        roomId: ROOM_ID,
        selectedRoomId: OTHER_ROOM,
        notificationLevel: 'mute',
        current: baseState,
        previous: { ...baseState, totalCount: 1 },
        soundEnabled: true,
      }),
    ).toBe(false)
  })

  it('returns false for the active room', () => {
    expect(
      shouldNotifyIncomingMessage({
        roomId: ROOM_ID,
        selectedRoomId: ROOM_ID,
        notificationLevel: 'all',
        current: baseState,
        previous: { ...baseState, totalCount: 1 },
        soundEnabled: true,
      }),
    ).toBe(false)
  })

  it('plays on unread count increase for all-messages rooms', () => {
    expect(
      shouldNotifyIncomingMessage({
        roomId: ROOM_ID,
        selectedRoomId: OTHER_ROOM,
        notificationLevel: 'all',
        current: baseState,
        previous: { ...baseState, totalCount: 1 },
        soundEnabled: true,
      }),
    ).toBe(true)
  })

  it('plays on mention count increase for mentions-only rooms', () => {
    expect(
      shouldNotifyIncomingMessage({
        roomId: ROOM_ID,
        selectedRoomId: OTHER_ROOM,
        notificationLevel: 'mentions',
        current: {
          hasUnread: false,
          totalCount: 0,
          highlightCount: 2,
          hasMentionUnread: true,
        },
        previous: {
          hasUnread: false,
          totalCount: 0,
          highlightCount: 1,
          hasMentionUnread: true,
        },
        soundEnabled: true,
      }),
    ).toBe(true)
  })
})
