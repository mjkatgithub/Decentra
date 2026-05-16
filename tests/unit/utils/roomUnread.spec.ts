import { describe, it } from 'vitest'
import {
  buildUnreadByRoomId,
  findLatestReadableRoomMessageEvent,
  getRoomUnreadState,
} from '~/utils/roomUnread'

function mockRoom(overrides: Record<string, unknown> = {}) {
  return {
    roomId: '!room:example.org',
    getType: () => undefined,
    getMyMembership: () => 'join',
    getUnreadNotificationCount: () => 0,
    getLiveTimeline: () => ({ getEvents: () => [] }),
    ...overrides,
  }
}

describe('roomUnread', () => {
  it('returns unread when notification count is positive', () => {
    const room = mockRoom({
      getUnreadNotificationCount: () => 3,
    })
    const state = getRoomUnreadState(room)
    state.hasUnread.should.equal(true)
    state.totalCount.should.equal(3)
  })

  it('returns read when notification count is zero', () => {
    const room = mockRoom({
      getUnreadNotificationCount: () => 0,
    })
    const state = getRoomUnreadState(room)
    state.hasUnread.should.equal(false)
    state.totalCount.should.equal(0)
  })

  it('hides unread for the active room', () => {
    const room = mockRoom({
      getUnreadNotificationCount: () => 2,
    })
    const state = getRoomUnreadState(room, {
      activeRoomId: '!room:example.org',
    })
    state.hasUnread.should.equal(false)
    state.totalCount.should.equal(0)
  })

  it('ignores space rooms and non-join membership', () => {
    const spaceRoom = mockRoom({
      roomId: '!space:example.org',
      getType: () => 'm.space',
      getUnreadNotificationCount: () => 5,
    })
    getRoomUnreadState(spaceRoom).hasUnread.should.equal(false)

    const inviteRoom = mockRoom({
      getMyMembership: () => 'invite',
      getUnreadNotificationCount: () => 1,
    })
    getRoomUnreadState(inviteRoom).hasUnread.should.equal(false)
  })

  it('builds a map keyed by room id', () => {
    const unreadMap = buildUnreadByRoomId([
      mockRoom({
        roomId: '!a:example.org',
        getUnreadNotificationCount: () => 1,
      }),
      mockRoom({
        roomId: '!b:example.org',
        getUnreadNotificationCount: () => 0,
      }),
    ])
    unreadMap['!a:example.org']!.hasUnread.should.equal(true)
    unreadMap['!b:example.org']!.hasUnread.should.equal(false)
  })

  it('finds the latest m.room.message event', () => {
    const messageEvent = {
      getType: () => 'm.room.message',
      getId: () => '$msg:example.org',
    }
    const room = mockRoom({
      getLiveTimeline: () => ({
        getEvents: () => [
          { getType: () => 'm.room.member', getId: () => '$m:example.org' },
          messageEvent,
        ],
      }),
    })
    const found = findLatestReadableRoomMessageEvent(room)
    found?.getId?.().should.equal('$msg:example.org')
  })
})
