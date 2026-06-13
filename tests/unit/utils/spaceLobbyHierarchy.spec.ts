import { describe, expect, it, vi } from 'vitest'
import {
  applyLobbyHierarchyNames,
  fetchSpaceHierarchyRoomNames,
} from '~/utils/spaceLobbyHierarchy'

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
})
