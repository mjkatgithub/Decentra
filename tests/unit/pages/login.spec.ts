import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import LoginPage from '~/pages/login.vue'
import AuthMaskedSecretInput from '~/components/auth/MaskedSecretInput.vue'

const { navigateToMock, loginMock } = vi.hoisted(() => ({
  navigateToMock: vi.fn(async () => undefined),
  loginMock: vi.fn(async () => undefined)
}))

vi.mock('~/composables/useAppI18n', () => ({
  useAppI18n: () => ({
    translateText: (key: string) => {
      const messages: Record<string, string> = {
        'auth.signIn': 'Sign in',
        'auth.signUp': 'Sign up',
        'auth.homeserver': 'Homeserver',
        'auth.username': 'Username',
        'auth.password': 'Password',
        cancel: 'Cancel'
      }
      return messages[key] ?? key
    }
  })
}))

vi.mock('~/composables/useMatrixClient', () => ({
  HOMESERVER_CONNECTION_HINT_ERROR: 'HOMESERVER_CONNECTION_HINT',
  useMatrixClient: () => ({
    login: loginMock,
    isLoggedIn: ref(false)
  })
}))

vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useRoute', () => ({ query: {} }))

const UCardStub = {
  template: '<div><slot name="header" /><slot /></div>'
}
const UFormFieldStub = {
  props: ['label'],
  template: '<label><span>{{ label }}</span><slot /></label>'
}
const UButtonStub = {
  props: ['type', 'loading', 'disabled'],
  template:
    '<button :type="type || \'button\'" :disabled="disabled"><slot /></button>'
}
const UAlertStub = { template: '<div />' }
const UIconStub = {
  props: ['name'],
  template: '<span class="icon-stub" />'
}
const NuxtLinkStub = { template: '<a><slot /></a>' }
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

describe('login page', () => {
  beforeEach(() => {
    loginMock.mockClear()
    navigateToMock.mockClear()
  })

  function mountLogin() {
    return mount(LoginPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UFormField: UFormFieldStub,
          UInput: UInputStub,
          UButton: UButtonStub,
          UAlert: UAlertStub,
          UIcon: UIconStub,
          NuxtLink: NuxtLinkStub
        },
        components: {
          AuthMaskedSecretInput
        }
      }
    })
  }

  it('submits login with password from masked field', async () => {
    const wrapper = mountLogin()
    const inputs = wrapper.findAll('input')
    const passwordInput = inputs[2]
    await inputs[0]!.setValue('https://matrix.example.org')
    await inputs[1]!.setValue('@alice:example.org')
    await passwordInput!.setValue('secret')
    await wrapper.find('form').trigger('submit.prevent')

    expect(loginMock).toHaveBeenCalledWith(
      'https://matrix.example.org',
      '@alice:example.org',
      'secret'
    )
    expect(navigateToMock).toHaveBeenCalledWith('/chat')
  })
})
