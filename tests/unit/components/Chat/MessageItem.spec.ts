import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessageItem from '~/components/Chat/MessageItem.vue'

const ChatMessageActionBarStub = {
  emits: ['reply', 'reaction-pick'],
  template: `
    <div>
      <button class="action-bar-reply" @click="$emit('reply')">Reply</button>
      <button
        class="action-bar-reaction"
        @click="$emit('reaction-pick', '👍')"
      >
        React
      </button>
    </div>
  `
}

function createMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-message',
    kind: 'message',
    senderId: '@alice:example.org',
    senderName: 'Alice',
    body: 'Hello world',
    reactions: [],
    ...overrides
  }
}

describe('MessageItem', () => {
  it('renders reaction chips with count and own-state class', () => {
    const wrapper = mount(ChatMessageItem, {
      props: {
        message: createMessage({
          reactions: [
            {
              emoji: '👍',
              count: 2,
              hasOwnReaction: true,
              ownReactionEventIds: ['reaction-1']
            },
            {
              emoji: '🔥',
              count: 1,
              hasOwnReaction: false,
              ownReactionEventIds: []
            }
          ]
        })
      },
      global: {
        stubs: {
          ChatMessageActionBar: ChatMessageActionBarStub
        }
      }
    })

    const chips = wrapper.findAll('[data-reaction-chip]')
    chips.length.should.equal(2)
    chips[0]!.text().should.include('👍')
    chips[0]!.text().should.include('2')
    chips[0]!.classes().should.include('bg-blue-50')
  })

  it('emits toggleReaction when clicking existing reaction chip', async () => {
    const wrapper = mount(ChatMessageItem, {
      props: {
        message: createMessage({
          reactions: [
            {
              emoji: '👍',
              count: 1,
              hasOwnReaction: true,
              ownReactionEventIds: ['reaction-own']
            }
          ]
        })
      },
      global: {
        stubs: {
          ChatMessageActionBar: ChatMessageActionBarStub
        }
      }
    })

    await wrapper.find('[data-reaction-chip="👍"]').trigger('click')
    const emittedEvents = wrapper.emitted('toggleReaction') ?? []
    emittedEvents.length.should.equal(1)
    const payload = emittedEvents[0]![0] as Record<string, any>
    payload.messageId.should.equal('evt-message')
    payload.emoji.should.equal('👍')
    payload.ownReactionEventIds[0].should.equal('reaction-own')
  })

  it('emits toggleReaction when picker emits reaction-pick', async () => {
    const wrapper = mount(ChatMessageItem, {
      props: {
        message: createMessage()
      },
      global: {
        stubs: {
          ChatMessageActionBar: ChatMessageActionBarStub
        }
      }
    })

    await wrapper.find('.action-bar-reaction').trigger('click')
    const emittedEvents = wrapper.emitted('toggleReaction') ?? []
    emittedEvents.length.should.equal(1)
    const payload = emittedEvents[0]![0] as Record<string, any>
    payload.emoji.should.equal('👍')
    payload.ownReactionEventIds.length.should.equal(0)
  })
})
