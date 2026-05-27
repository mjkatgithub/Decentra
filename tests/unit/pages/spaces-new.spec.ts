import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import SpacesNewPage from '~/pages/spaces/new.vue'

const navigateToMock = vi.fn(async () => undefined)
const createMatrixSpaceMock = vi.fn(async () => '!created-space:example.org')

vi.mock('~/composables/useAppI18n', () => {
  return {
    useAppI18n: () => ({
      translateText: (key: string) => key,
    }),
  }
})

vi.mock('~/composables/useMatrixClient', () => {
  return {
    useMatrixClient: () => ({
      createMatrixSpace: createMatrixSpaceMock,
    }),
  }
})

vi.stubGlobal('navigateTo', navigateToMock)

const UCardStub = {
  template: '<div><slot name="header" /><slot /><slot name="footer" /></div>',
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
  `,
}
const UAlertStub = { props: ['title'], template: '<p>{{ title }}</p>' }
const UButtonStub = {
  props: ['to', 'disabled', 'loading'],
  template: '<button :disabled="disabled"><slot /></button>',
}

describe('spaces/new page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMatrixSpaceMock.mockResolvedValue('!created-space:example.org')
    ;(globalThis as Record<string, unknown>).ref = ref
  })

  function mountPage() {
    return mount(SpacesNewPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UFormField: UFormFieldStub,
          UInput: UInputStub,
          UAlert: UAlertStub,
          UButton: UButtonStub,
        },
      },
    })
  }

  it('creates space and navigates to chat with space query', async () => {
    const wrapper = mountPage()
    const nameInput = wrapper.find('input')
    await nameInput.setValue('My Space')
    const submitButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'spaces.createSubmit')
    expect(submitButton).toBeDefined()
    await submitButton!.trigger('click')
    await Promise.resolve()

    expect(createMatrixSpaceMock).toHaveBeenCalledWith({
      name: 'My Space',
      topic: '',
      visibility: 'private',
    })
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/chat',
      query: { space: '!created-space:example.org' },
    })
  })

  it('disables submit when space name is empty', () => {
    const wrapper = mountPage()
    const submitButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'spaces.createSubmit')
    expect(submitButton?.attributes('disabled')).toBeDefined()
  })

  it('shows error message when createMatrixSpace fails', async () => {
    createMatrixSpaceMock.mockRejectedValueOnce(
      new Error('Could not create space'),
    )
    const wrapper = mountPage()
    const nameInput = wrapper.find('input')
    await nameInput.setValue('Broken Space')
    const submitButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'spaces.createSubmit')
    await submitButton!.trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Could not create space')
  })
})
