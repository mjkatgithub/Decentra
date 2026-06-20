import { describe, it } from 'vitest'
import {
  HOME_SPACE_ID,
  buildRoomIdToSpaceIdsMap,
  buildSpaceUnreadById,
  collectSpaceIdsForChangedRooms,
  diffUnreadRoomIds,
  patchSpaceUnreadById,
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

  it('diffUnreadRoomIds reports only changed rooms', () => {
    const previous = {
      '!a:example.org': {
        hasUnread: true,
        totalCount: 1,
        highlightCount: 0,
        hasMentionUnread: false,
      },
    }
    const next = {
      '!a:example.org': {
        hasUnread: true,
        totalCount: 1,
        highlightCount: 0,
        hasMentionUnread: false,
      },
      '!b:example.org': {
        hasUnread: true,
        totalCount: 3,
        highlightCount: 0,
        hasMentionUnread: false,
      },
    }
    diffUnreadRoomIds(previous, next).should.deep.equal([
      '!b:example.org',
    ])
  })

  it('patchSpaceUnreadById updates only affected spaces', () => {
    const spaceA = '!space-a:example.org'
    const spaceB = '!space-b:example.org'
    const baseOptions = {
      spaceIds: [spaceA, spaceB],
      sidebarRooms: [
        { roomId: '!ch-a:example.org', parentSpaceIds: [spaceA] },
        { roomId: '!ch-b:example.org', parentSpaceIds: [spaceB] },
      ],
      unreadByRoomId: {
        '!ch-a:example.org': {
          hasUnread: true,
          totalCount: 1,
          highlightCount: 0,
          hasMentionUnread: false,
        },
        '!ch-b:example.org': {
          hasUnread: false,
          totalCount: 0,
          highlightCount: 0,
          hasMentionUnread: false,
        },
      },
      matrixRoomsById: new Map([
        [
          spaceA,
          {
            getType: () => 'm.space',
            currentState: {
              getStateEvents: (eventType: string) => {
                if (eventType !== 'm.space.child') {
                  return []
                }
                return [
                  {
                    getStateKey: () => '!ch-a:example.org',
                    getContent: () => ({}),
                  },
                ]
              },
            },
          },
        ],
        [
          spaceB,
          {
            getType: () => 'm.space',
            currentState: {
              getStateEvents: (eventType: string) => {
                if (eventType !== 'm.space.child') {
                  return []
                }
                return [
                  {
                    getStateKey: () => '!ch-b:example.org',
                    getContent: () => ({}),
                  },
                ]
              },
            },
          },
        ],
        ['!ch-a:example.org', { getType: () => undefined }],
        ['!ch-b:example.org', { getType: () => undefined }],
      ]),
      getRoomType: (room: unknown) =>
        (room as { getType?: () => string }).getType?.(),
      getParentSpaceIds: () => [],
    }
    const full = buildSpaceUnreadById(baseOptions)
    const roomMap = buildRoomIdToSpaceIdsMap(
      [spaceA, spaceB],
      baseOptions,
    )
    const affected = collectSpaceIdsForChangedRooms(
      ['!ch-b:example.org'],
      roomMap,
    )
    affected.should.deep.equal([spaceB])
    const bumped = {
      ...baseOptions,
      unreadByRoomId: {
        ...baseOptions.unreadByRoomId,
        '!ch-b:example.org': {
          hasUnread: true,
          totalCount: 4,
          highlightCount: 0,
          hasMentionUnread: false,
        },
      },
    }
    const patched = patchSpaceUnreadById(full, [spaceB], bumped)
    patched[spaceA]!.totalCount.should.equal(1)
    patched[spaceB]!.totalCount.should.equal(4)
  })
})
