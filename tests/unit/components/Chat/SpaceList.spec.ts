import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatSpaceList from '~/components/Chat/SpaceList.vue'

const UButtonStub = {
  template: '<button type="button"><slot /></button>',
}

describe('SpaceList', () => {
  it('shows mention badge on collapsed space avatar button', () => {
    const wrapper = mount(ChatSpaceList, {
      props: {
        spaces: [
          {
            id: '!space:example.org',
            name: 'Team',
            hasUnread: true,
            hasMentionUnread: true,
            totalCount: 3,
            highlightCount: 1,
          },
        ],
        selectedSpaceId: null,
        expanded: false,
      },
      global: {
        stubs: {
          UButton: UButtonStub,
        },
      },
    })

    const spaceButton = wrapper.find(
      'button[data-space-id="!space:example.org"]',
    )
    spaceButton.attributes('data-mention-unread').should.equal('true')
    spaceButton.attributes('aria-label')
      ?.should.include('3 mentions in space Team')
    wrapper.find('[data-space-unread-count="3"]').text().should.equal('3')
    wrapper.find('span.rounded-full.bg-red-500').exists().should.equal(true)
  })

  it('shows normal unread count on expanded space label button', () => {
    const wrapper = mount(ChatSpaceList, {
      props: {
        spaces: [
          {
            id: '!space:example.org',
            name: 'Team',
            hasUnread: true,
            hasMentionUnread: false,
            totalCount: 12,
          },
        ],
        selectedSpaceId: null,
        expanded: true,
      },
      global: {
        stubs: {
          UButton: UButtonStub,
        },
      },
    })

    const expandedButtons = wrapper.findAll(
      'button[data-space-id="!space:example.org"]',
    )
    expandedButtons.length.should.be.at.least(2)
    const labelButton = expandedButtons[1]!
    labelButton.attributes('data-unread').should.equal('true')
    labelButton.attributes('data-mention-unread').should.equal('false')
    labelButton.find('[data-space-unread-count="12"]').text().should.equal('12')
    labelButton.find('span.rounded-full.bg-primary-500').exists()
      .should.equal(true)
  })
})
