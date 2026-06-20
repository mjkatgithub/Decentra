import { describe, expect, it } from 'vitest'
import {
  isHomeGroupChatFromCounts,
  isPersonalChatFromCounts,
} from '~/utils/homeRoomCategories'

describe('homeRoomCategories', () => {
  it('treats a 1-member non-DM room as a group', () => {
    expect(
      isHomeGroupChatFromCounts({
        parentSpaceIds: [],
        joinedMemberCount: 1,
        isDirectMessage: false,
      }),
    ).toBe(true)
    expect(
      isPersonalChatFromCounts({
        parentSpaceIds: [],
        joinedMemberCount: 1,
        isDirectMessage: false,
      }),
    ).toBe(false)
  })

  it('treats a 2-member DM as personal only', () => {
    expect(
      isPersonalChatFromCounts({
        parentSpaceIds: [],
        joinedMemberCount: 2,
        isDirectMessage: true,
      }),
    ).toBe(true)
    expect(
      isHomeGroupChatFromCounts({
        parentSpaceIds: [],
        joinedMemberCount: 2,
        isDirectMessage: true,
      }),
    ).toBe(false)
  })

  it('treats a 2-member non-DM room as a group', () => {
    expect(
      isHomeGroupChatFromCounts({
        parentSpaceIds: [],
        joinedMemberCount: 2,
        isDirectMessage: false,
      }),
    ).toBe(true)
  })

  it('ignores rooms linked to a space', () => {
    expect(
      isHomeGroupChatFromCounts({
        parentSpaceIds: ['!space:example.org'],
        joinedMemberCount: 5,
        isDirectMessage: false,
      }),
    ).toBe(false)
  })
})
