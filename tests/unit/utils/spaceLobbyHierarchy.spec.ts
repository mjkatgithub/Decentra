import { describe, expect, it, vi } from 'vitest'
import {
  applyLobbyHierarchyNames,
  buildLobbyCategoriesFromHierarchy,
  fetchSpaceHierarchyLobby,
  fetchSpaceHierarchyRoomNames,
} from '~/utils/spaceLobbyHierarchy'

function mockStateEvent(
  stateKey: string,
  content: Record<string, unknown> = {},
) {
  return {
    type: 'm.space.child',
    state_key: stateKey,
    content,
  }
}

describe('spaceLobbyHierarchy', () => {
  it('fetchSpaceHierarchyRoomNames maps room ids to names', async () => {
    const matrixClient = {
      getRoomHierarchy: vi.fn()
        .mockResolvedValueOnce({
          rooms: [
            { room_id: '!a:example.org', name: 'General' },
            { room_id: '!b:example.org', name: 'Random' },
          ],
          next_batch: 'token-1',
        })
        .mockResolvedValueOnce({
          rooms: [
            { room_id: '!c:example.org', name: 'Deep' },
          ],
        }),
    }

    const names = await fetchSpaceHierarchyRoomNames(
      matrixClient as never,
      '!root:example.org',
    )

    expect(names).toEqual({
      '!a:example.org': 'General',
      '!b:example.org': 'Random',
      '!c:example.org': 'Deep',
    })
    expect(matrixClient.getRoomHierarchy).toHaveBeenCalledTimes(2)
  })

  it('applyLobbyHierarchyNames replaces fallback names', () => {
    const categories = applyLobbyHierarchyNames(
      [
        {
          id: 'rooms',
          name: 'Rooms',
          kind: 'root',
          rootChildAnchorIds: ['!a:example.org'],
          canReorderRooms: false,
          rooms: [
            {
              roomId: '!a:example.org',
              name: 'abc123',
              isJoined: false,
            },
          ],
        },
      ],
      { '!a:example.org': 'General' },
    )

    expect(categories[0]!.rooms[0]!.name).toBe('General')
  })

  it('buildLobbyCategoriesFromHierarchy nests subspaces deeply', () => {
    const rootId = '!root:example.org'
    const subId = '!sub:example.org'
    const nestedSubId = '!nested:example.org'
    const roomRootId = '!room-root:example.org'
    const roomNestedId = '!room-nested:example.org'

    const categories = buildLobbyCategoriesFromHierarchy(
      rootId,
      [
        {
          room_id: rootId,
          name: 'Open Space',
          children_state: [
            mockStateEvent(roomRootId, { order: '0' }),
            mockStateEvent(subId, { order: '1' }),
          ],
        },
        {
          room_id: roomRootId,
          name: 'General',
          room_type: 'm.room',
          num_joined_members: 2,
          children_state: [],
        },
        {
          room_id: subId,
          name: 'Sub A',
          room_type: 'm.space',
          avatar_url: 'mxc://example.org/subavatar',
          children_state: [
            mockStateEvent(nestedSubId, { order: '0' }),
          ],
        },
        {
          room_id: nestedSubId,
          name: 'Sub B',
          room_type: 'm.space',
          children_state: [
            mockStateEvent(roomNestedId, { order: '0' }),
          ],
        },
        {
          room_id: roomNestedId,
          name: 'Deep Room',
          room_type: 'm.room',
          children_state: [],
        },
      ],
      {
        generalCategoryLabel: 'Rooms',
        resolveAvatarUrl: (mxc) => (mxc ? `https://avatar/${mxc}` : undefined),
        isRoomJoined: () => false,
      },
    )

    expect(categories.length).to.equal(3)
    expect(categories[0]!.kind).to.equal('root')
    expect(categories[0]!.rooms[0]!.name).to.equal('General')
    expect(categories[1]!.kind).to.equal('subspace')
    expect(categories[1]!.nestingDepth).to.equal(1)
    expect(categories[1]!.subspaceAvatarUrl)
      .to.equal('https://avatar/mxc://example.org/subavatar')
    expect(categories[2]!.kind).to.equal('subspace')
    expect(categories[2]!.nestingDepth).to.equal(2)
    expect(categories[2]!.parentSubspaceId).to.equal(subId)
    expect(categories[2]!.rooms[0]!.name).to.equal('Deep Room')
  })

  it('fetchSpaceHierarchyLobby builds categories from API', async () => {
    const matrixClient = {
      getRoomHierarchy: vi.fn().mockResolvedValue({
        rooms: [
          {
            room_id: '!root:example.org',
            name: 'Root',
            children_state: [
              mockStateEvent('!child:example.org'),
            ],
          },
          {
            room_id: '!child:example.org',
            name: 'Child',
            room_type: 'm.room',
            children_state: [],
          },
        ],
      }),
    }

    const categories = await fetchSpaceHierarchyLobby(
      matrixClient as never,
      '!root:example.org',
      {
        generalCategoryLabel: 'Rooms',
        isRoomJoined: () => true,
      },
    )

    expect(categories.length).to.equal(1)
    expect(categories[0]!.rooms[0]!.name).to.equal('Child')
    expect(categories[0]!.rooms[0]!.isJoined).to.equal(true)
  })
})
