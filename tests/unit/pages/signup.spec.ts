import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import SignupPage from '~/pages/signup.vue'

const navigateToMock = vi.fn(async () => undefined)
const registerMock = vi.fn(async () => undefined)

vi.mock('~/composables/useAppI18n', () => {
  return {
    useAppI18n: () => ({
      translateText: (key: string) => {
        const messages: Record<string, string> = {
          'auth.signIn': 'Sign in',
          'auth.signUp': 'Sign up',
          'auth.email': 'Email',
          'auth.homeserver': 'Homeserver',
          'auth.username': 'Username',
          'auth.password': 'Password',
          'auth.signUpFailed': 'Sign up failed',
          'auth.signUpUnavailable': 'Sign-up is not available on this homeserver',
          'auth.signUpEmailVerificationRequired': 'Sign-up requires email verification on this homeserver'
        }
        return messages[key] ?? key
      }
    })
  }
})

vi.mock('~/composables/useMatrixClient', () => {
  return {
    SIGNUP_UNAVAILABLE_ERROR: 'SIGNUP_UNAVAILABLE',
    SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR:
      'SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    useMatrixClient: () => ({
      register: registerMock,
      isLoggedIn: ref(false)
    })
  }
})

const UCardStub = {
  template: '<div><slot /><slot name="header" /></div>'
}

const UFormFieldStub = {
  template: '<label><slot /></label>'
}

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

const UAlertStub = {
  props: ['title'],
  template: '<p>{{ title }}</p>'
}

const UButtonStub = {
  props: ['type'],
  template: `
    <button :type="type || 'button'">
      <slot />
    </button>
  `
}

const NuxtLinkStub = {
  template: '<a><slot /></a>'
}

describe('signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as Record<string, unknown>).navigateTo = navigateToMock
  })

  function mountSignupPage() {
    return mount(SignupPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UFormField: UFormFieldStub,
          UInput: UInputStub,
          UAlert: UAlertStub,
          UButton: UButtonStub,
          NuxtLink: NuxtLinkStub
        }
      }
    })
  }

  it('submits registration and redirects to login success state', async () => {
    const wrapper = mountSignupPage()
    const inputElements = wrapper.findAll('input')
    expect(inputElements).toHaveLength(4)
    const [
      emailInput,
      homeserverInput,
      usernameInput,
      passwordInput
    ] = inputElements

    await emailInput!.setValue('alice@example.org')
    await homeserverInput!.setValue('https://matrix.example.org')
    await usernameInput!.setValue('@alice:example.org')
    await passwordInput!.setValue('secret')
    await wrapper.find('form').trigger('submit.prevent')

    expect(registerMock).toHaveBeenCalledWith(
      'https://matrix.example.org',
      '@alice:example.org',
      'secret',
      'alice@example.org'
    )
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/login',
      query: { signup: 'success' }
    })
  })

  it('shows translated error when signup is unavailable', async () => {
    registerMock.mockRejectedValueOnce(new Error('SIGNUP_UNAVAILABLE'))
    const wrapper = mountSignupPage()

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text().includes('Sign-up is not available on this homeserver'))
      .toBe(true)
  })

  it('shows translated error when email verification is required', async () => {
    registerMock.mockRejectedValueOnce(
      new Error('SIGNUP_EMAIL_VERIFICATION_REQUIRED')
    )
    const wrapper = mountSignupPage()

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text().includes('Sign-up requires email verification on this homeserver'))
      .toBe(true)
  })
})
