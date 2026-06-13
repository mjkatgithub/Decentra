import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SpaceHomePanel from '~/components/Chat/SpaceHomePanel.vue'

const UButtonStub = {
  template: '<button type="button"><slot /></button>',
}

const categories = [
  {
    id: 'general',
    name: 'Rooms',
    kind: 'root' as const,
    rootChildAnchorIds: ['!channel:example.org'],
    canReorderRooms: false,
    rooms: [
      { roomId: '!channel:example.org', name: 'General', isJoined: true },
      { roomId: '!other:example.org', name: 'Random', isJoined: false },
    ],
  },
]

function mountSpaceHome(extraProps: Record<string, unknown> = {}) {
  return mount(SpaceHomePanel, {
    props: {
      spaceName: 'Team Space',
      memberCountLabel: '3 members',
      categories,
      canInvite: true,
      ...extraProps,
    },
    global: {
      stubs: {
        UButton: UButtonStub,
        UIcon: true,
      },
    },
  })
}

describe('SpaceHomePanel', () => {
  it('renders welcome header and channel list from categories', () => {
    const wrapper = mountSpaceHome()

    wrapper.find('[data-space-home-panel]').exists().should.equal(true)
    wrapper.text().should.include('Welcome to Team Space')
    wrapper.text().should.include('3 members')
    wrapper.text().should.include('General')
    wrapper.text().should.include('Random')
  })

  it('emits select-room when an joined channel action is clicked', async () => {
    const wrapper = mountSpaceHome()

    const roomButton = wrapper.find(
      'button[data-space-home-room-id="!channel:example.org"]',
    )
    await roomButton.trigger('click')

    const emitted = wrapper.emitted('select-room')
    emitted?.length.should.equal(1)
    emitted?.[0]?.[0].should.equal('!channel:example.org')
  })

  it('emits join-room for unjoined channels', async () => {
    const wrapper = mountSpaceHome()

    const joinButton = wrapper.find(
      'button[data-space-home-room-id="!other:example.org"]',
    )
    await joinButton.trigger('click')

    const emitted = wrapper.emitted('join-room')
    emitted?.length.should.equal(1)
    emitted?.[0]?.[0].should.equal('!other:example.org')
  })

  it('shows invite button only when canInvite is true', () => {
    const withInvite = mountSpaceHome({ canInvite: true })
    withInvite.text().should.include('Invite to space')

    const withoutInvite = mountSpaceHome({ canInvite: false })
    withoutInvite.text().should.not.include('Invite to space')
    withoutInvite.text().should.include('Space settings')
  })

  it('shows empty state when no channels are listed', () => {
    const wrapper = mountSpaceHome({ categories: [] })

    wrapper.text().should.include('No channels joined yet.')
    wrapper.find('[data-space-home-room-id]').exists().should.equal(false)
  })

  it('emits invite and open-settings from action buttons', async () => {
    const wrapper = mountSpaceHome()
    const buttons = wrapper.findAll('button')

    const inviteButton = buttons.find((button) =>
      button.text().includes('Invite to space'),
    )
    const settingsButton = buttons.find((button) =>
      button.text().includes('Space settings'),
    )

    await inviteButton?.trigger('click')
    await settingsButton?.trigger('click')

    wrapper.emitted('invite')?.length.should.equal(1)
    wrapper.emitted('open-settings')?.length.should.equal(1)
  })
})
