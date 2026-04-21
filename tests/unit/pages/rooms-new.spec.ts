import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import RoomsNewPage from '~/pages/rooms/new.vue'

const navigateToMock = vi.fn(async () => undefined)
const createGroupRoomMock = vi.fn(async () => '!created:example.org')

vi.mock('~/composables/useAppI18n', () => {
  return {
    useAppI18n: () => ({
      translateText: (key: string) => key
    })
  }
})

vi.mock('~/composables/useMatrixClient', () => {
  return {
    useMatrixClient: () => ({
      createGroupRoom: createGroupRoomMock
    })
  }
})

const UCardStub = {
  template: '<div><slot name="header" /><slot /><slot name="footer" /></div>'
}
const UFormFieldStub = { template: '<div><slot /></div>' }
const UInputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `
    <input
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    >
  `
}
const UAlertStub = { props: ['title'], template: '<p>{{ title }}</p>' }
const UButtonStub = {
  props: ['to', 'disabled', 'loading'],
  template: '<button><slot /></button>'
}

describe('rooms/new page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as Record<string, unknown>).navigateTo = navigateToMock
    ;(globalThis as Record<string, unknown>).ref = ref
  })

  it('creates room and navigates to chat with room query', async () => {
    const wrapper = mount(RoomsNewPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UFormField: UFormFieldStub,
          UInput: UInputStub,
          UAlert: UAlertStub,
          UButton: UButtonStub
        }
      }
    })
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('Team standup')
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    await buttons[0].trigger('click')
    await Promise.resolve()

    expect(createGroupRoomMock).toHaveBeenCalledWith({
      name: 'Team standup',
      topic: '',
      visibility: 'private'
    })
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/chat',
      query: { room: '!created:example.org' }
    })
  })
})
