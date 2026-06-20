import { describe, it } from 'vitest'
import { NotificationCountType } from 'matrix-js-sdk'
import {
  buildUnreadByRoomId,
  findLatestReadableRoomMessageEvent,
  getRoomUnreadState,
  getThreadUnreadState,
  resolveChannelUnreadVisual,
  summarizeGlobalUnread,
} from '~/utils/roomUnread'

function mockRoom(overrides: Record<string, unknown> = {}) {
  return {
    roomId: '!room:example.org',
    getType: () => undefined,
    getMyMembership: () => 'join',
    getUnreadNotificationCount: () => 0,
    getThreadUnreadNotificationCount: () => 0,
    getLiveTimeline: () => ({ getEvents: () => [] }),
    ...overrides,
  }
}

describe('roomUnread', () => {
  it('returns unread when notification count is positive', () => {
    const room = mockRoom({
      getUnreadNotificationCount: (type?: NotificationCountType) =>
        type === NotificationCountType.Total ? 3 : 0,
    })
    const state = getRoomUnreadState(room)
    state.hasUnread.should.equal(true)
    state.totalCount.should.equal(3)
    state.hasMentionUnread.should.equal(false)
  })

  it('returns mention unread when highlight count is positive', () => {
    const room = mockRoom({
      getUnreadNotificationCount: (type?: NotificationCountType) =>
        type === NotificationCountType.Highlight ? 2 : 0,
    })
    const state = getRoomUnreadState(room)
    state.hasMentionUnread.should.equal(true)
    state.highlightCount.should.equal(2)
    state.hasUnread.should.equal(false)
  })

  it('returns read when notification count is zero', () => {
    const room = mockRoom({
      getUnreadNotificationCount: () => 0,
    })
    const state = getRoomUnreadState(room)
    state.hasUnread.should.equal(false)
    state.totalCount.should.equal(0)
    state.hasMentionUnread.should.equal(false)
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
    state.hasMentionUnread.should.equal(false)
  })

  it('resolves mention visual priority over normal unread', () => {
    resolveChannelUnreadVisual({
      hasMentionUnread: true,
      hasUnread: true,
    }).should.equal('mention')
    resolveChannelUnreadVisual({
      hasMentionUnread: false,
      hasUnread: true,
    }).should.equal('normal')
    resolveChannelUnreadVisual({
      hasMentionUnread: false,
      hasUnread: false,
    }).should.equal('none')
  })

  it('summarizes global unread with mention priority in counts', () => {
    const summary = summarizeGlobalUnread({
      '!a:example.org': {
        hasUnread: true,
        totalCount: 1,
        highlightCount: 0,
        hasMentionUnread: false,
      },
      '!b:example.org': {
        hasUnread: false,
        totalCount: 0,
        highlightCount: 1,
        hasMentionUnread: true,
      },
    })
    summary.unreadRoomCount.should.equal(2)
    summary.mentionRoomCount.should.equal(1)
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

  it('reads thread mention unread counts', () => {
    const room = mockRoom({
      getThreadUnreadNotificationCount: (
        _threadId: string,
        type?: NotificationCountType,
      ) => (type === NotificationCountType.Highlight ? 1 : 0),
    })
    const state = getThreadUnreadState(room, '$root:example.org')
    state.hasMentionUnread.should.equal(true)
  })

  it('hides thread unread for the active thread', () => {
    const room = mockRoom({
      getThreadUnreadNotificationCount: () => 2,
    })
    const state = getThreadUnreadState(room, '$root:example.org', {
      activeRoomId: '!room:example.org',
      activeThreadRootId: '$root:example.org',
    })
    state.hasUnread.should.equal(false)
    state.hasMentionUnread.should.equal(false)
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
