import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessageActionBar from '~/components/Chat/MessageActionBar.vue'

const UButtonStub = {
  props: ['ariaExpanded'],
  template: `
    <button type="button" :aria-expanded="ariaExpanded">
      <slot />
    </button>
  `
}

const ChatReactionEmojiPickerStub = {
  emits: ['select'],
  template: '<div data-emoji-picker />'
}

describe('MessageActionBar', () => {
  it('shows the bar when visible is true without hover classes', () => {
    const wrapper = mount(ChatMessageActionBar, {
      props: {
        visible: true
      },
      global: {
        stubs: {
          UButton: UButtonStub,
          ChatReactionEmojiPicker: ChatReactionEmojiPickerStub
        }
      }
    })

    const root = wrapper.get('[data-message-action-bar]')
    root.classes().should.include('opacity-100')
    root.classes().should.include('pointer-events-auto')
    root.classes().should.not.include('group-hover:opacity-100')
  })

  it('sets aria-expanded on the reaction button when picker is open', async () => {
    const wrapper = mount(ChatMessageActionBar, {
      props: {
        visible: true
      },
      global: {
        stubs: {
          UButton: UButtonStub,
          ChatReactionEmojiPicker: ChatReactionEmojiPickerStub
        }
      }
    })

    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click')
    await wrapper.vm.$nextTick()
    buttons[0]!.attributes('aria-expanded').should.equal('true')
  })
})
