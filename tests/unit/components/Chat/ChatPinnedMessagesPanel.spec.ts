import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatPinnedMessagesPanel from '~/components/Chat/ChatPinnedMessagesPanel.vue'

describe('ChatPinnedMessagesPanel', () => {
  it('shows empty state when there are no entries', () => {
    const wrapper = mount(ChatPinnedMessagesPanel, {
      props: { entries: [] },
    })
    wrapper.text().should.include('No pinned messages')
  })

  it('renders entries and emits openMessage', async () => {
    const wrapper = mount(ChatPinnedMessagesPanel, {
      props: {
        entries: [{
          eventId: '$evt',
          senderName: 'Alice',
          snippet: 'Hello pinned',
          pinnedAtTs: Date.now() - 60_000,
        }],
      },
    })

    wrapper.text().should.include('Alice')
    wrapper.text().should.include('Hello pinned')
    const entryButton = wrapper.find('button')
    await entryButton.trigger('click')
    wrapper.emitted('openMessage')?.[0]?.[0].should.equal('$evt')
  })

  it('emits close from header button', async () => {
    const wrapper = mount(ChatPinnedMessagesPanel, {
      props: { entries: [] },
    })
    const closeButton = wrapper.findAll('button').find((button) => {
      return button.attributes('aria-label')?.includes('Close pinned')
    })
    await closeButton?.trigger('click')
    wrapper.emitted('close')?.length.should.equal(1)
  })
})
