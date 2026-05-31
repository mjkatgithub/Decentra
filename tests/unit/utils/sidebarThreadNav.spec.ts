import { describe, it } from 'vitest'
import {
  buildSidebarThreadNavByRoomId,
  collectVisibleSidebarRoomIds,
} from '~/utils/sidebarThreadNav'

describe('sidebarThreadNav', () => {
  it('collectVisibleSidebarRoomIds maps room ids', () => {
    const ids = collectVisibleSidebarRoomIds([
      { roomId: '!a:example.org' },
      { roomId: '!b:example.org' },
    ])
    ids.should.deep.equal(['!a:example.org', '!b:example.org'])
  })

  it('buildSidebarThreadNavByRoomId only processes visible rooms', () => {
    const visited: string[] = []
    const result = buildSidebarThreadNavByRoomId({
      visibleRoomIds: ['!visible:example.org'],
      getJoinedRoom: (roomId) => {
        visited.push(roomId)
        return null
      },
    })
    visited.should.deep.equal(['!visible:example.org'])
    result.should.deep.equal({})
  })
})
