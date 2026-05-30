import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatRoomCategoryList from '~/components/Chat/RoomCategoryList.vue'

const UButtonStub = {
  props: ['icon', 'ariaLabel'],
  template:
    '<button type="button" :data-icon="icon" :aria-label="ariaLabel">' +
    '<slot /></button>',
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

  it('uses notification bell icons per room level', () => {
    const wrapper = mountCategoryList(
      [
        {
          id: 'general',
          name: 'General',
          canReorderRooms: false,
          rooms: [
            { roomId: '!default:example.org', name: 'Default' },
            { roomId: '!all:example.org', name: 'All' },
            { roomId: '!mentions:example.org', name: 'Mentions' },
            { roomId: '!mute:example.org', name: 'Muted' },
          ],
        },
      ],
      {
        roomNotificationLevels: {
          '!default:example.org': 'default',
          '!all:example.org': 'all',
          '!mentions:example.org': 'mentions',
          '!mute:example.org': 'mute',
        },
      },
    )

    wrapper
      .find('button[data-room-notification="!default:example.org"]')
      .attributes('data-icon')
      .should.equal('i-lucide-bell')
    wrapper
      .find('button[data-room-notification="!all:example.org"]')
      .attributes('data-icon')
      .should.equal('i-lucide-bell-ring')
    wrapper
      .find('button[data-room-notification="!mentions:example.org"]')
      .attributes('data-icon')
      .should.equal('i-lucide-at-sign')
    wrapper
      .find('button[data-room-notification="!mute:example.org"]')
      .attributes('data-icon')
      .should.equal('i-lucide-bell-off')
  })

  it('shows room actions in an ellipsis menu', () => {
    const wrapper = mountCategoryList(
      [
        {
          id: 'general',
          name: 'General',
          canReorderRooms: false,
          rooms: [{ roomId: '!room:example.org', name: 'General' }],
        },
      ],
      {
        canInviteToRoom: () => true,
        canOpenRoomSettings: () => true,
      },
    )

    wrapper.find('button[data-room-actions="!room:example.org"]').exists()
      .should.equal(true)
    wrapper.find('button[data-room-notification="!room:example.org"]').exists()
      .should.equal(true)
    wrapper.find('button[aria-label="Invite to channel"]').exists()
      .should.equal(false)
  })
})
