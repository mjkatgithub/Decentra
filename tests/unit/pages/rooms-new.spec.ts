import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import RoomsNewPage from '~/pages/rooms/new.vue'

const navigateToMock = vi.fn(async () => undefined)
const createGroupRoomMock = vi.fn(async () => '!created:example.org')
const createMatrixSpaceMock = vi.fn(async () => '!created-subspace:example.org')
const searchUsersDirectoryMock = vi.fn(async () => [])

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
      userId: ref('@self:example.org'),
      createGroupRoom: createGroupRoomMock,
      createMatrixSpace: createMatrixSpaceMock,
      searchUsersDirectory: searchUsersDirectoryMock,
    }),
  }
})

vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useRoute', () => ({ query: {} }))

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
const UTextareaStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `
    <textarea
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
}
const UAlertStub = { props: ['title'], template: '<p>{{ title }}</p>' }
const UButtonStub = {
  props: ['to', 'disabled', 'loading'],
  template: '<button><slot /></button>',
}

describe('rooms/new page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as Record<string, unknown>).ref = ref
  })

  it('creates room and navigates to chat with room query', async () => {
    const wrapper = mount(RoomsNewPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UFormField: UFormFieldStub,
          UInput: UInputStub,
          UTextarea: UTextareaStub,
          UAlert: UAlertStub,
          UButton: UButtonStub,
        },
      },
    })
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('Team standup')
    const submitButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'rooms.createSubmit')
    expect(submitButton).toBeDefined()
    await submitButton!.trigger('click')
    await Promise.resolve()

    expect(createGroupRoomMock).toHaveBeenCalledWith({
      name: 'Team standup',
      topic: '',
      visibility: 'private',
    })
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/chat',
      query: { room: '!created:example.org' },
    })
  })

  it('passes inviteUserIds when invite field is filled', async () => {
    const wrapper = mount(RoomsNewPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UFormField: UFormFieldStub,
          UInput: UInputStub,
          UTextarea: UTextareaStub,
          UAlert: UAlertStub,
          UButton: UButtonStub,
        },
      },
    })
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('Party')
    const textarea = wrapper.find('textarea')
    await textarea.setValue('@guest:example.org')
    const submitButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'rooms.createSubmit')
    await submitButton!.trigger('click')
    await Promise.resolve()

    expect(createGroupRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Party',
        inviteUserIds: ['@guest:example.org'],
      }),
    )
  })

  it('creates subspace and navigates with room and root query', async () => {
    vi.stubGlobal('useRoute', () => ({
      query: {
        kind: 'space',
        parent: '!parent:example.org',
        root: '!parent:example.org',
      },
    }))
    const wrapper = mount(RoomsNewPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UFormField: UFormFieldStub,
          UInput: UInputStub,
          UTextarea: UTextareaStub,
          UAlert: UAlertStub,
          UButton: UButtonStub,
        },
      },
    })
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('Nested Space')
    const submitButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'rooms.createSpaceSubmit')
    expect(submitButton).toBeDefined()
    await submitButton!.trigger('click')
    await Promise.resolve()

    expect(createMatrixSpaceMock).toHaveBeenCalledWith({
      name: 'Nested Space',
      topic: '',
      visibility: 'private',
      parentSpaceId: '!parent:example.org',
    })
    expect(createGroupRoomMock).not.toHaveBeenCalled()
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/chat',
      query: {
        room: '!created-subspace:example.org',
        root: '!parent:example.org',
      },
    })
    vi.stubGlobal('useRoute', () => ({ query: {} }))
  })
})
