import { describe, it } from 'vitest'
import {
  assignLexOrdersForSiblingCount,
  buildSpaceLobbyCategories,
  buildSpaceRoomCategories,
  getJoinedSpaceIdsListedAsChild,
  getJoinedSpaceRoomIds,
  isRootSpaceRoom,
  isRoomUnderAncestorSpace,
  isTopLevelSpaceForRail,
  parseSpaceChildEvents,
  sortParsedSpaceChildren,
  viaServersFromRoomId,
} from '~/utils/spaceRoomCategories'

function mockStateEvent(
  stateKey: string,
  content: Record<string, unknown>,
): {
  getStateKey: () => string
  getContent: () => Record<string, unknown>
} {
  return {
    getStateKey: () => stateKey,
    getContent: () => content,
  }
}

describe('spaceRoomCategories', () => {
  it('parses m.space.child state keys and order', () => {
    const parentRoom = {
      roomId: '!root:example.org',
      currentState: {
        getStateEvents: () => [
          mockStateEvent('!b:example.org', {
            order: 'b',
            via: ['example.org'],
          }),
          mockStateEvent('!a:example.org', {
            order: 'a',
            via: ['example.org'],
          }),
        ],
      },
    }
    const parsed = parseSpaceChildEvents(parentRoom)
    parsed.length.should.equal(2)
    parsed[0]!.childRoomId.should.equal('!b:example.org')
    parsed[1]!.childRoomId.should.equal('!a:example.org')
  })

  it('sorts children lexicographically by order then name', () => {
    const sorted = sortParsedSpaceChildren(
      [
        { childRoomId: '!z:example.org', orderKey: '' },
        { childRoomId: '!a:example.org', orderKey: '2' },
        { childRoomId: '!b:example.org', orderKey: '10' },
      ],
      () => 'Room',
    )
    sorted.map((entry) => entry.childRoomId).should.deep.equal([
      '!z:example.org',
      '!b:example.org',
      '!a:example.org',
    ])
  })

  it('detects root spaces vs joined subspaces', () => {
    const joined = new Set(['!parent:example.org', '!child:example.org'])
    const rootSpace = {
      roomId: '!parent:example.org',
      getType: () => 'm.space' as const,
    }
    const subSpace = {
      roomId: '!child:example.org',
      getType: () => 'm.space' as const,
    }
    const getParents = (room: unknown) =>
      room === subSpace ? ['!parent:example.org'] : []

    isRootSpaceRoom(rootSpace, joined, getParents).should.equal(true)
    isRootSpaceRoom(subSpace, joined, getParents).should.equal(false)
  })

  it('builds categories from root children (general + subspace)', () => {
    const rootId = '!root:example.org'
    const subId = '!sub:example.org'
    const roomGeneralId = '!gen:example.org'
    const roomUnderSubId = '!under:example.org'

    const matrixRooms = [
      {
        roomId: rootId,
        name: 'Root',
        getType: () => 'm.space',
        currentState: {
          getStateEvents: (eventType: string) => {
            if (eventType !== 'm.space.child') {
              return []
            }
            return [
              mockStateEvent(roomGeneralId, {
                order: '1',
                via: ['example.org'],
              }),
              mockStateEvent(subId, { order: '2', via: ['example.org'] }),
            ]
          },
        },
      },
      {
        roomId: subId,
        name: 'Subspace',
        getType: () => 'm.space',
        currentState: {
          getStateEvents: (eventType: string) => {
            if (eventType !== 'm.space.child') {
              return []
            }
            return [
              mockStateEvent(roomUnderSubId, {
                order: '1',
                via: ['example.org'],
              }),
            ]
          },
        },
      },
      {
        roomId: roomGeneralId,
        name: 'Lobby',
        getType: () => undefined,
      },
      {
        roomId: roomUnderSubId,
        name: 'Inside',
        getType: () => undefined,
      },
    ]

    const categories = buildSpaceRoomCategories({
      rootSpaceId: rootId,
      matrixRooms,
      getRoomType: (room: unknown) =>
        (room as { getType?: () => string }).getType?.(),
      getRoomId: (room: unknown) => (room as { roomId: string }).roomId,
      getRoomDisplayName: (room: unknown) =>
        String((room as { name?: string }).name ?? ''),
      generalCategoryLabel: 'General',
    })

    categories.length.should.equal(2)
    categories[0]!.kind.should.equal('root')
    categories[0]!.rootChildAnchorIds.should.deep.equal([roomGeneralId])
    categories[0]!.rooms.map((room) => room.roomId).should.deep.equal([
      roomGeneralId,
    ])
    categories[1]!.kind.should.equal('subspace')
    categories[1]!.subspaceRoomId.should.equal(subId)
    categories[1]!.rootChildAnchorIds.should.deep.equal([subId])
    categories[1]!.rooms.map((room) => room.roomId).should.deep.equal([
      roomUnderSubId,
    ])
  })

  it('merges all root-level rooms into one block (Cinny-style)', () => {
    const rootId = '!root:example.org'
    const subId = '!sub:example.org'
    const roomBeforeId = '!before:example.org'
    const roomAfterId = '!after:example.org'
    const roomUnderSubId = '!under:example.org'

    const matrixRooms = [
      {
        roomId: rootId,
        name: 'Root',
        getType: () => 'm.space',
        currentState: {
          getStateEvents: (eventType: string) => {
            if (eventType !== 'm.space.child') {
              return []
            }
            return [
              mockStateEvent(roomBeforeId, {
                order: '1',
                via: ['example.org'],
              }),
              mockStateEvent(subId, { order: '2', via: ['example.org'] }),
              mockStateEvent(roomAfterId, { order: '3', via: ['example.org'] }),
            ]
          },
        },
      },
      {
        roomId: subId,
        name: 'Sub',
        getType: () => 'm.space',
        currentState: {
          getStateEvents: (eventType: string) => {
            if (eventType !== 'm.space.child') {
              return []
            }
            return [
              mockStateEvent(roomUnderSubId, {
                order: '1',
                via: ['example.org'],
              }),
            ]
          },
        },
      },
      { roomId: roomBeforeId, name: 'Before', getType: () => undefined },
      { roomId: roomAfterId, name: 'After', getType: () => undefined },
      { roomId: roomUnderSubId, name: 'Under', getType: () => undefined },
    ]

    const categories = buildSpaceRoomCategories({
      rootSpaceId: rootId,
      matrixRooms,
      getRoomType: (room: unknown) =>
        (room as { getType?: () => string }).getType?.(),
      getRoomId: (room: unknown) => (room as { roomId: string }).roomId,
      getRoomDisplayName: (room: unknown) =>
        String((room as { name?: string }).name ?? ''),
      generalCategoryLabel: 'Rooms',
    })

    const rootBlocks = categories.filter((entry) => entry.kind === 'root')
    rootBlocks.length.should.equal(1)
    rootBlocks[0]!.rooms.map((room) => room.roomId).should.deep.equal([
      roomBeforeId,
      roomAfterId,
    ])
    categories.filter((entry) => entry.kind === 'subspace').length.should.equal(
      1,
    )
  })

  it('detects nested parent association with ancestor space', () => {
    const rootId = '!root:example.org'
    const subId = '!sub:example.org'
    const roomsById = new Map<string, unknown>([
      [
        subId,
        {
          getType: () => 'm.space',
          roomId: subId,
        },
      ],
    ])
    const ok = isRoomUnderAncestorSpace({
      roomParentIds: [subId],
      ancestorSpaceId: rootId,
      roomsById,
      getRoomType: (room: unknown) =>
        (room as { getType?: () => string }).getType?.(),
      getParentSpaceIds: (room: unknown) =>
        room === roomsById.get(subId) ? [rootId] : [],
    })
    ok.should.equal(true)
  })

  it('assigns lex orders for sibling lists', () => {
    assignLexOrdersForSiblingCount(3).should.deep.equal([
      '0000',
      '0001',
      '0002',
    ])
  })

  it('extracts via server from room id', () => {
    viaServersFromRoomId('!abc:matrix.org').should.deep.equal(['matrix.org'])
  })

  it('collects joined space ids', () => {
    const ids = getJoinedSpaceRoomIds([
      { roomId: '!s:example.org', getType: () => 'm.space' },
      { roomId: '!r:example.org', getType: () => undefined },
    ])
    ids.has('!s:example.org').should.equal(true)
    ids.has('!r:example.org').should.equal(false)
  })

  it('excludes subspaces listed as m.space.child from rail', () => {
    const parentId = '!parent:example.org'
    const childId = '!child:example.org'
    const matrixRooms = [
      {
        roomId: parentId,
        getType: () => 'm.space',
        currentState: {
          getStateEvents: (eventType: string) => {
            if (eventType !== 'm.space.child') {
              return []
            }
            return [
              mockStateEvent(childId, { order: '1', via: ['example.org'] }),
            ]
          },
        },
      },
      { roomId: childId, getType: () => 'm.space' },
    ]
    const joined = getJoinedSpaceRoomIds(
      matrixRooms.map((room) => ({
        roomId: room.roomId,
        getType: room.getType,
      })),
    )
    const listedAsChild = getJoinedSpaceIdsListedAsChild(
      matrixRooms,
      (room) => (room as { getType: () => string }).getType(),
      (room) => (room as { roomId: string }).roomId,
    )
    isTopLevelSpaceForRail(parentId, joined, listedAsChild).should.equal(true)
    isTopLevelSpaceForRail(childId, joined, listedAsChild).should.equal(false)
  })

  it('builds nested subspace categories depth-first', () => {
    const rootId = '!root:example.org'
    const subId = '!sub:example.org'
    const nestedSubId = '!nested:example.org'
    const roomRootId = '!rootRoom:example.org'
    const roomSubId = '!subRoom:example.org'
    const roomNestedId = '!nestedRoom:example.org'

    const matrixRooms = [
      {
        roomId: rootId,
        name: 'Open',
        getType: () => 'm.space',
        currentState: {
          getStateEvents: (eventType: string) => {
            if (eventType !== 'm.space.child') {
              return []
            }
            return [
              mockStateEvent(roomRootId, {
                order: '1',
                via: ['example.org'],
              }),
              mockStateEvent(subId, { order: '2', via: ['example.org'] }),
            ]
          },
        },
      },
      {
        roomId: subId,
        name: 'Sub A',
        getType: () => 'm.space',
        currentState: {
          getStateEvents: (eventType: string) => {
            if (eventType !== 'm.space.child') {
              return []
            }
            return [
              mockStateEvent(roomSubId, {
                order: '1',
                via: ['example.org'],
              }),
              mockStateEvent(nestedSubId, {
                order: '2',
                via: ['example.org'],
              }),
            ]
          },
        },
      },
      {
        roomId: nestedSubId,
        name: 'Sub B',
        getType: () => 'm.space',
        currentState: {
          getStateEvents: (eventType: string) => {
            if (eventType !== 'm.space.child') {
              return []
            }
            return [
              mockStateEvent(roomNestedId, {
                order: '1',
                via: ['example.org'],
              }),
            ]
          },
        },
      },
      { roomId: roomRootId, name: 'Lobby', getType: () => undefined },
      { roomId: roomSubId, name: 'In A', getType: () => undefined },
      { roomId: roomNestedId, name: 'In B', getType: () => undefined },
    ]

    const categories = buildSpaceRoomCategories({
      rootSpaceId: rootId,
      matrixRooms,
      getRoomType: (room: unknown) =>
        (room as { getType?: () => string }).getType?.(),
      getRoomId: (room: unknown) => (room as { roomId: string }).roomId,
      getRoomDisplayName: (room: unknown) =>
        String((room as { name?: string }).name ?? ''),
      generalCategoryLabel: 'General',
    })

    categories.length.should.equal(3)
    categories[0]!.kind.should.equal('root')
    categories[0]!.rooms.map((room) => room.roomId).should.deep.equal([
      roomRootId,
    ])
    categories[1]!.kind.should.equal('subspace')
    categories[1]!.subspaceRoomId.should.equal(subId)
    categories[1]!.rootChildAnchorIds.should.deep.equal([subId])
    categories[1]!.rooms.map((room) => room.roomId).should.deep.equal([
      roomSubId,
    ])
    categories[2]!.kind.should.equal('subspace')
    categories[2]!.subspaceRoomId.should.equal(nestedSubId)
    categories[1]!.nestingDepth.should.equal(1)
    categories[2]!.nestingDepth.should.equal(2)
    categories[2]!.parentSubspaceId.should.equal(subId)
    categories[2]!.rootChildAnchorIds.should.deep.equal([])
    categories[2]!.rooms.map((room) => room.roomId).should.deep.equal([
      roomNestedId,
    ])
  })

  it('buildSpaceLobbyCategories includes unjoined m.space.child rooms', () => {
    const rootId = '!root:example.org'
    const joinedRoomId = '!joined:example.org'
    const unjoinedRoomId = '!unjoined:example.org'

    const matrixRooms = [
      {
        roomId: rootId,
        name: 'Root',
        getType: () => 'm.space' as const,
        getMyMembership: () => 'join',
        currentState: {
          getStateEvents: () => [
            mockStateEvent(joinedRoomId, { order: '0' }),
            mockStateEvent(unjoinedRoomId, { order: '1' }),
          ],
        },
      },
      {
        roomId: joinedRoomId,
        name: 'Joined',
        getType: () => undefined,
        getMyMembership: () => 'join',
      },
    ]

    const categories = buildSpaceLobbyCategories({
      rootSpaceId: rootId,
      matrixRooms,
      getRoomType: (room: unknown) =>
        (room as { getType?: () => string }).getType?.(),
      getRoomId: (room: unknown) => (room as { roomId: string }).roomId,
      getRoomDisplayName: (room: unknown) =>
        String((room as { name?: string }).name ?? ''),
      generalCategoryLabel: 'Rooms',
    })

    categories.length.should.equal(1)
    categories[0]!.rooms.length.should.equal(2)
    categories[0]!.rooms[0]!.isJoined.should.equal(true)
    categories[0]!.rooms[1]!.isJoined.should.equal(false)
    categories[0]!.rooms[1]!.roomId.should.equal(unjoinedRoomId)
  })
})
