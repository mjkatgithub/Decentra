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
    rooms: Array<{ roomId: string; name: string; hasUnread?: boolean }>
  }>,
) {
  return mount(ChatRoomCategoryList, {
    props: {
      selectedSpaceName: 'Home',
      categories,
      selectedRoomId: null,
      canReorderCategories: false,
      selectedRootSpaceId: null,
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
    roomButton.attributes('aria-label')
      ?.should.include('Unread messages in Alerts')
    wrapper.find('span.rounded-full.bg-primary-500').exists()
      .should.equal(true)
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
    wrapper.find('span.rounded-full.bg-primary-500').exists()
      .should.equal(false)
  })
})
