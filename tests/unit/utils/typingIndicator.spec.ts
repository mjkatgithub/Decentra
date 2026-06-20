import { describe, it } from 'vitest'
import {
  buildTypingIndicatorLabel,
  getTypingMembers,
  resolveTypingDisplayName,
} from '~/utils/typingIndicator'

function mockMember(overrides: Record<string, unknown> = {}) {
  return {
    userId: '@alice:example.org',
    name: 'Alice',
    typing: true,
    membership: 'join',
    ...overrides,
  }
}

function mockRoom(members: ReturnType<typeof mockMember>[]) {
  return { getMembers: () => members }
}

function translateStub(
  key: string,
  placeholders?: Record<string, string>,
): string {
  if (key === 'chat.typingOne') {
    return `${placeholders?.name} is typing…`
  }
  if (key === 'chat.typingTwo') {
    return `${placeholders?.first} and ${placeholders?.second} are typing…`
  }
  if (key === 'chat.typingManyOneOther') {
    return `${placeholders?.first}, ${placeholders?.second} and 1 other are typing…`
  }
  if (key === 'chat.typingManyOthers') {
    return `${placeholders?.first}, ${placeholders?.second} and ${placeholders?.count} others are typing…`
  }
  return key
}

describe('typingIndicator', () => {
  it('resolves display name from member name or user id', () => {
    resolveTypingDisplayName(mockMember()).should.equal('Alice')
    resolveTypingDisplayName(
      mockMember({ name: undefined }),
    ).should.equal('@alice:example.org')
  })

  it('filters typing members excluding self and non-join', () => {
    const room = mockRoom([
      mockMember({ userId: '@alice:example.org', typing: true }),
      mockMember({
        userId: '@bob:example.org',
        name: 'Bob',
        typing: true,
      }),
      mockMember({
        userId: '@self:example.org',
        typing: true,
      }),
      mockMember({
        userId: '@invite:example.org',
        typing: true,
        membership: 'invite',
      }),
      mockMember({ userId: '@idle:example.org', typing: false }),
    ])
    const members = getTypingMembers(room, '@self:example.org')
    members.length.should.equal(2)
    members[0]!.userId!.should.equal('@alice:example.org')
    members[1]!.userId!.should.equal('@bob:example.org')
  })

  it('builds labels for one, two, and many typers', () => {
    const emptyLabel = buildTypingIndicatorLabel([], translateStub)
    ;(emptyLabel === null).should.equal(true)
    buildTypingIndicatorLabel(
      [mockMember()],
      translateStub,
    ).should.equal('Alice is typing…')
    buildTypingIndicatorLabel(
      [
        mockMember({ name: 'Alice' }),
        mockMember({
          userId: '@bob:example.org',
          name: 'Bob',
        }),
      ],
      translateStub,
    ).should.equal('Alice and Bob are typing…')
    buildTypingIndicatorLabel(
      [
        mockMember({ name: 'Alice' }),
        mockMember({
          userId: '@bob:example.org',
          name: 'Bob',
        }),
        mockMember({
          userId: '@carol:example.org',
          name: 'Carol',
        }),
      ],
      translateStub,
    ).should.equal('Alice, Bob and 1 other are typing…')
    buildTypingIndicatorLabel(
      [
        mockMember({ name: 'Alice' }),
        mockMember({
          userId: '@bob:example.org',
          name: 'Bob',
        }),
        mockMember({
          userId: '@carol:example.org',
          name: 'Carol',
        }),
        mockMember({
          userId: '@dave:example.org',
          name: 'Dave',
        }),
      ],
      translateStub,
    ).should.equal('Alice, Bob and 2 others are typing…')
  })
})
