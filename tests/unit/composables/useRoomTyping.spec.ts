import { ref } from 'vue'
import { describe, it, vi } from 'vitest'
import { RoomMemberEvent } from 'matrix-js-sdk'
import { useRoomTyping } from '~/composables/useRoomTyping'

vi.mock('~/composables/useAppI18n', () => ({
  useAppI18n: () => ({
    translateText: (key: string, placeholders?: Record<string, string>) => {
      if (key === 'chat.typingOne') {
        return `${placeholders?.name} is typing…`
      }
      return key
    },
  }),
}))

function mockRoom(members: Array<Record<string, unknown>>) {
  return {
    getMembers: () => members,
  }
}

describe('useRoomTyping', () => {
  it('updates label when RoomMemberEvent.Typing fires', () => {
    const handlers: Record<string, (event: unknown, member: unknown) => void> =
      {}
    let bobIsTyping = false
    const matrixClient = {
      getRoom: vi.fn(() =>
        mockRoom([
          {
            userId: '@bob:example.org',
            name: 'Bob',
            get typing() {
              return bobIsTyping
            },
            membership: 'join',
          },
        ]),
      ),
      on: vi.fn((eventName: string, handler: typeof handlers[string]) => {
        handlers[eventName] = handler
      }),
      off: vi.fn(),
    }

    const client = ref(matrixClient as never)
    const selectedRoomId = ref('!room:example.org')
    const userId = ref('@alice:example.org')

    const { typingLabel } = useRoomTyping({
      client,
      selectedRoomId,
      userId,
    })

    ;(typingLabel.value === null).should.equal(true)

    bobIsTyping = true
    handlers[RoomMemberEvent.Typing]?.(null, {
      roomId: '!room:example.org',
    })

    String(typingLabel.value).should.equal('Bob is typing…')
  })

  it('ignores typing events for other rooms', () => {
    const handlers: Record<string, (event: unknown, member: unknown) => void> =
      {}
    const matrixClient = {
      getRoom: vi.fn(() => mockRoom([])),
      on: vi.fn((eventName: string, handler: typeof handlers[string]) => {
        handlers[eventName] = handler
      }),
      off: vi.fn(),
    }

    const client = ref(matrixClient as never)
    const selectedRoomId = ref('!room:example.org')
    const userId = ref('@alice:example.org')

    const { typingLabel } = useRoomTyping({
      client,
      selectedRoomId,
      userId,
    })

    handlers[RoomMemberEvent.Typing]?.(null, {
      roomId: '!other:example.org',
    })

    ;(typingLabel.value === null).should.equal(true)
  })
})
