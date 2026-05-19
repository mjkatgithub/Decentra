import { beforeEach, describe, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ChatMessageItem from '~/components/Chat/MessageItem.vue'

const canUseHover = ref(true)

vi.mock('~/composables/useHoverCapable', () => ({
  useHoverCapable: () => ({ canUseHover })
}))

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
  beforeEach(() => {
    canUseHover.value = true
  })

  it('exposes selected state for accessibility', () => {
    const wrapper = mount(ChatMessageItem, {
      props: {
        message: createMessage(),
        isSelected: true
      },
      global: {
        stubs: {
          ChatMessageActionBar: ChatMessageActionBarStub
        }
      }
    })

    const row = wrapper.get('[data-message-id="evt-message"]')
    row.attributes('aria-selected').should.equal('true')
    row.attributes('data-message-selected').should.equal('true')
    row.classes().should.include('bg-gray-100')
  })

  it('emits activate on touch pointerup within tap threshold', async () => {
    canUseHover.value = false
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

    const row = wrapper.get('[data-message-id="evt-message"]')
    await row.trigger('pointerdown', { clientX: 4, clientY: 4 })
    await row.trigger('pointerup', { clientX: 6, clientY: 5 })

    const activateEvents = wrapper.emitted('activate') ?? []
    activateEvents.length.should.equal(1)
  })

  it('does not emit activate when pointer moves beyond tap threshold', async () => {
    canUseHover.value = false
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

    const row = wrapper.get('[data-message-id="evt-message"]')
    await row.trigger('pointerdown', { clientX: 0, clientY: 0 })
    await row.trigger('pointerup', { clientX: 40, clientY: 0 })

    const activateEvents = wrapper.emitted('activate') ?? []
    activateEvents.length.should.equal(0)
  })

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

  it('shows pinned badge when message is pinned', () => {
    const wrapper = mount(ChatMessageItem, {
      props: {
        message: createMessage(),
        isPinned: true,
      },
      global: {
        stubs: {
          ChatMessageActionBar: ChatMessageActionBarStub,
        },
      },
    })

    wrapper.find('[data-pinned-badge]').exists().should.equal(true)
    wrapper.text().should.include('Pinned message')
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
