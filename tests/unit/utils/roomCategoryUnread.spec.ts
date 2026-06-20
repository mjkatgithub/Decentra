import { describe, it } from 'vitest'
import { applyUnreadToRoomCategories } from '~/utils/roomCategoryUnread'

describe('roomCategoryUnread', () => {
  it('patches unread flags when includeUnread is true', () => {
    const patched = applyUnreadToRoomCategories(
      [
        {
          id: 'root',
          rooms: [{ roomId: '!a:example.org', name: 'A' }],
        },
      ],
      {
        '!a:example.org': {
          hasUnread: true,
          hasMentionUnread: true,
          totalCount: 1,
          highlightCount: 1,
        },
      },
      true,
    )
    patched[0]!.rooms[0]!.hasUnread.should.equal(true)
    patched[0]!.rooms[0]!.hasMentionUnread.should.equal(true)
  })

  it('clears unread flags when includeUnread is false', () => {
    const patched = applyUnreadToRoomCategories(
      [
        {
          id: 'root',
          rooms: [{ roomId: '!a:example.org', name: 'A' }],
        },
      ],
      {
        '!a:example.org': {
          hasUnread: true,
          hasMentionUnread: true,
          totalCount: 1,
          highlightCount: 1,
        },
      },
      false,
    )
    patched[0]!.rooms[0]!.hasUnread.should.equal(false)
    patched[0]!.rooms[0]!.hasMentionUnread.should.equal(false)
  })
})
