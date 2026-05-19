import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatRoomHeaderToolbar from '~/components/Chat/ChatRoomHeaderToolbar.vue'

describe('ChatRoomHeaderToolbar', () => {
  it('emits openPinned when pin button is clicked', async () => {
    const wrapper = mount(ChatRoomHeaderToolbar, {
      props: { pinnedActive: false },
    })
    const pinButton = wrapper.findAll('button').find((button) => {
      return button.attributes('aria-label')?.includes('Open pinned')
    })
    await pinButton?.trigger('click')
    wrapper.emitted('openPinned')?.length.should.equal(1)
  })

  it('marks pin button active when pinnedActive is true', () => {
    const wrapper = mount(ChatRoomHeaderToolbar, {
      props: { pinnedActive: true },
    })
    const pinButton = wrapper.findAll('button').find((button) => {
      return button.attributes('aria-label')?.includes('Close pinned')
    })
    pinButton?.classes().join(' ').should.include('soft')
  })
})
