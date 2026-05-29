import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatRoomThreadListPanel from '~/components/Chat/ChatRoomThreadListPanel.vue'

const UButtonStub = {
  template: '<button type="button"><slot /></button>',
}

describe('ChatRoomThreadListPanel', () => {
  it('shows mention unread indicator on thread rows', () => {
    const wrapper = mount(ChatRoomThreadListPanel, {
      props: {
        threads: [
          {
            rootEventId: '$thread:example.org',
            title: 'Design review',
            replyCount: 3,
            lastActivityTs: Date.now(),
            hasMentionUnread: true,
          },
        ],
      },
      global: {
        stubs: {
          UButton: UButtonStub,
        },
      },
    })

    const threadButton = wrapper.find(
      'button[data-thread-root-id="$thread:example.org"]',
    )
    threadButton.attributes('data-mention-unread').should.equal('true')
    threadButton.attributes('aria-label')
      ?.should.include('Mentioned in thread Design review')
    wrapper.find('span.rounded-full.bg-red-500').exists().should.equal(true)
  })
})
