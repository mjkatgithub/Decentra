import { describe, it } from 'vitest'
import {
  HOME_SPACE_ID,
  buildSpaceUnreadById,
} from '~/utils/spaceUnread'

describe('spaceUnread', () => {
  it('aggregates mention unread for home across sidebar rooms', () => {
    const unreadBySpace = buildSpaceUnreadById({
      spaceIds: [HOME_SPACE_ID],
      homeRoomIds: ['!dm:example.org'],
      sidebarRooms: [
        { roomId: '!dm:example.org', parentSpaceIds: [] },
        { roomId: '!other:example.org', parentSpaceIds: [] },
      ],
      unreadByRoomId: {
        '!dm:example.org': {
          hasUnread: false,
          totalCount: 0,
          highlightCount: 1,
          hasMentionUnread: true,
        },
        '!other:example.org': {
          hasUnread: false,
          totalCount: 0,
          highlightCount: 0,
          hasMentionUnread: false,
        },
      },
      matrixRoomsById: new Map(),
      getRoomType: () => undefined,
      getParentSpaceIds: () => [],
    })
    unreadBySpace[HOME_SPACE_ID]!.hasMentionUnread.should.equal(true)
    unreadBySpace[HOME_SPACE_ID]!.hasUnread.should.equal(true)
  })

  it('aggregates normal unread for a child space', () => {
    const spaceId = '!space:example.org'
    const unreadBySpace = buildSpaceUnreadById({
      spaceIds: [spaceId],
      sidebarRooms: [
        {
          roomId: '!channel:example.org',
          parentSpaceIds: [spaceId],
        },
      ],
      unreadByRoomId: {
        '!channel:example.org': {
          hasUnread: true,
          totalCount: 2,
          highlightCount: 0,
          hasMentionUnread: false,
        },
      },
      matrixRoomsById: new Map([
        [
          spaceId,
          {
            getType: () => 'm.space',
            currentState: {
              getStateEvents: (eventType: string) => {
                if (eventType !== 'm.space.child') {
                  return []
                }
                return [
                  {
                    getStateKey: () => '!channel:example.org',
                    getContent: () => ({}),
                  },
                ]
              },
            },
          },
        ],
        [
          '!channel:example.org',
          { getType: () => undefined },
        ],
      ]),
      getRoomType: (room) =>
        (room as { getType?: () => string }).getType?.(),
      getParentSpaceIds: () => [],
    })
    unreadBySpace[spaceId]!.hasUnread.should.equal(true)
    unreadBySpace[spaceId]!.hasMentionUnread.should.equal(false)
    unreadBySpace[spaceId]!.totalCount.should.equal(2)
  })

  it('aggregates via m.space.child when room has no m.space.parent', () => {
    const spaceId = '!space:example.org'
    const unreadBySpace = buildSpaceUnreadById({
      spaceIds: [spaceId],
      sidebarRooms: [
        { roomId: '!channel:example.org', parentSpaceIds: [] },
      ],
      unreadByRoomId: {
        '!channel:example.org': {
          hasUnread: true,
          totalCount: 5,
          highlightCount: 0,
          hasMentionUnread: false,
        },
      },
      matrixRoomsById: new Map([
        [
          spaceId,
          {
            getType: () => 'm.space',
            currentState: {
              getStateEvents: (eventType: string) => {
                if (eventType !== 'm.space.child') {
                  return []
                }
                return [
                  {
                    getStateKey: () => '!channel:example.org',
                    getContent: () => ({}),
                  },
                ]
              },
            },
          },
        ],
        ['!channel:example.org', { getType: () => undefined }],
      ]),
      getRoomType: (room) =>
        (room as { getType?: () => string }).getType?.(),
      getParentSpaceIds: () => [],
    })
    unreadBySpace[spaceId]!.hasUnread.should.equal(true)
    unreadBySpace[spaceId]!.totalCount.should.equal(5)
  })

  it('excludes space channels from home when homeRoomIds is set', () => {
    const spaceId = '!space:example.org'
    const unreadBySpace = buildSpaceUnreadById({
      spaceIds: [HOME_SPACE_ID, spaceId],
      homeRoomIds: ['!dm:example.org'],
      sidebarRooms: [
        { roomId: '!dm:example.org', parentSpaceIds: [] },
        { roomId: '!channel:example.org', parentSpaceIds: [] },
      ],
      unreadByRoomId: {
        '!dm:example.org': {
          hasUnread: true,
          totalCount: 1,
          highlightCount: 0,
          hasMentionUnread: false,
        },
        '!channel:example.org': {
          hasUnread: true,
          totalCount: 5,
          highlightCount: 0,
          hasMentionUnread: false,
        },
      },
      matrixRoomsById: new Map([
        [
          spaceId,
          {
            getType: () => 'm.space',
            currentState: {
              getStateEvents: (eventType: string) => {
                if (eventType !== 'm.space.child') {
                  return []
                }
                return [
                  {
                    getStateKey: () => '!channel:example.org',
                    getContent: () => ({}),
                  },
                ]
              },
            },
          },
        ],
        ['!channel:example.org', { getType: () => undefined }],
      ]),
      getRoomType: (room) =>
        (room as { getType?: () => string }).getType?.(),
      getParentSpaceIds: () => [],
    })
    unreadBySpace[HOME_SPACE_ID]!.totalCount.should.equal(1)
    unreadBySpace[spaceId]!.totalCount.should.equal(5)
  })
})
