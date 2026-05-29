import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatRoomCategoryList from '~/components/Chat/RoomCategoryList.vue'

const UButtonStub = {
  template: '<button type="button"><slot /></button>',
}

const VueDraggableStub = {
  props: ['modelValue'],
  template: '<motion-div class="draggable-stub"><slot /></motion-div>',
}

function mountCategoryList(
  categories: Array<{
    id: string
    name: string
    canReorderRooms: boolean
    rooms: Array<{
      roomId: string
      name: string
      hasUnread?: boolean
      hasMentionUnread?: boolean
    }>
  }>,
  extraProps: Record<string, unknown> = {},
) {
  return mount(ChatRoomCategoryList, {
    props: {
      selectedSpaceName: 'Home',
      categories,
      selectedRoomId: null,
      canReorderCategories: false,
      selectedRootSpaceId: null,
      ...extraProps,
    },
    global: {
      stubs: {
        UButton: UButtonStub,
        VueDraggable: VueDraggableStub,
        UIcon: true,
      },
    },
  })
}

describe('RoomCategoryList', () => {
  it('shows unread dot and aria label for unread channels', () => {
    const wrapper = mountCategoryList([
      {
        id: 'general',
        name: 'General',
        canReorderRooms: false,
        rooms: [
          {
            roomId: '!unread:example.org',
            name: 'Alerts',
            hasUnread: true,
          },
        ],
      },
    ])

    const roomButton = wrapper.find(
      'button[data-room-id="!unread:example.org"]',
    )
    roomButton.exists().should.equal(true)
    roomButton.attributes('data-unread').should.equal('true')
    roomButton.attributes('data-mention-unread').should.equal('false')
    roomButton.attributes('aria-label')
      ?.should.include('Unread messages in Alerts')
    wrapper.find('span.rounded-full.bg-primary-500').exists()
      .should.equal(true)
  })

  it('shows red mention dot and aria label for mention-unread channels', () => {
    const wrapper = mountCategoryList([
      {
        id: 'general',
        name: 'General',
        canReorderRooms: false,
        rooms: [
          {
            roomId: '!mention:example.org',
            name: 'Pings',
            hasUnread: true,
            hasMentionUnread: true,
          },
        ],
      },
    ])

    const roomButton = wrapper.find(
      'button[data-room-id="!mention:example.org"]',
    )
    roomButton.attributes('data-mention-unread').should.equal('true')
    roomButton.attributes('aria-label')
      ?.should.include('Mentioned in Pings')
    wrapper.find('span.rounded-full.bg-red-500').exists().should.equal(true)
  })

  it('marks read channels without unread styling', () => {
    const wrapper = mountCategoryList([
      {
        id: 'general',
        name: 'General',
        canReorderRooms: false,
        rooms: [
          {
            roomId: '!read:example.org',
            name: 'Calm',
            hasUnread: false,
          },
        ],
      },
    ])

    const roomButton = wrapper.find(
      'button[data-room-id="!read:example.org"]',
    )
    roomButton.attributes('data-unread').should.equal('false')
    roomButton.attributes('data-mention-unread').should.equal('false')
    wrapper.find('span.rounded-full.bg-primary-500').exists()
      .should.equal(false)
  })

  it('shows mention indicator on thread rows', () => {
    const wrapper = mountCategoryList(
      [
        {
          id: 'general',
          name: 'General',
          canReorderRooms: false,
          rooms: [
            {
              roomId: '!room:example.org',
              name: 'General',
              hasUnread: false,
            },
          ],
        },
      ],
      {
        threadsByRoomId: {
          '!room:example.org': [
            {
              rootEventId: '$thread:example.org',
              title: 'Thread topic',
              replyCount: 2,
              lastActivityTs: Date.now(),
              hasMentionUnread: true,
            },
          ],
        },
      },
    )

    const threadButton = wrapper.find(
      'button[data-thread-root-id="$thread:example.org"]',
    )
    threadButton.attributes('data-mention-unread').should.equal('true')
    wrapper.find('span.rounded-full.bg-red-500').exists().should.equal(true)
  })
})
