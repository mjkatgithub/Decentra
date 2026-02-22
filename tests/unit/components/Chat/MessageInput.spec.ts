import { describe, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessageInput from '~/components/Chat/MessageInput.vue'

const UInputStub = {
  props: ['modelValue', 'placeholder', 'disabled'],
  emits: ['update:modelValue', 'paste', 'keydown'],
  template: `
    <input
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
      @paste="$emit('paste', $event)"
      @keydown="$emit('keydown', $event)"
    >
  `
}

const UButtonStub = {
  props: ['type', 'disabled'],
  emits: ['click'],
  template: `
    <button :type="type || 'button'" :disabled="disabled" @click="$emit('click')">
      <slot />
    </button>
  `
}

function mountInput() {
  return mount(ChatMessageInput, {
    props: {
      roomId: '!room:example.org',
      disabled: false
    },
    global: {
      stubs: {
        UInput: UInputStub,
        UButton: UButtonStub
      }
    }
  })
}

describe('MessageInput', () => {
  it('sends image from file picker', async () => {
    const sendImageMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () => ({
      sendMessage,
      sendImageMessage
    })

    const wrapper = mountInput()
    const imageFile = new File(['img-data'], 'picked.png', {
      type: 'image/png'
    })
    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [imageFile],
      configurable: true
    })

    await fileInput.trigger('change')

    sendImageMessage.mock.calls.length.should.equal(1)
    sendImageMessage.mock.calls[0]?.[0].should.equal('!room:example.org')
    sendImageMessage.mock.calls[0]?.[2].should.equal('picked.png')
  })

  it('sends image from clipboard paste', async () => {
    const sendImageMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () => ({
      sendMessage,
      sendImageMessage
    })

    const wrapper = mountInput()
    const pastedFile = new File(['img-data'], 'pasted.png', {
      type: 'image/png'
    })
    const preventDefault = vi.fn()
    const input = wrapper.find('input[type="text"]')

    await input.trigger('paste', {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => pastedFile
          }
        ]
      },
      preventDefault
    })

    sendImageMessage.mock.calls.length.should.equal(1)
    preventDefault.mock.calls.length.should.equal(1)
    sendImageMessage.mock.calls[0]?.[2].should.equal('pasted.png')
  })

  it('ignores non-image clipboard data', async () => {
    const sendImageMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () => ({
      sendMessage,
      sendImageMessage
    })

    const wrapper = mountInput()
    const input = wrapper.find('input[type="text"]')

    await input.trigger('paste', {
      clipboardData: {
        items: [
          {
            type: 'text/plain',
            getAsFile: () => null
          }
        ]
      },
      preventDefault: vi.fn()
    })

    sendImageMessage.mock.calls.length.should.equal(0)
  })
})
