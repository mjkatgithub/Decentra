import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import SignupPage from '~/pages/signup.vue'

const {
  navigateToMock,
  startEmailRegistrationMock,
  PENDING_KEY
} = vi.hoisted(() => {
  return {
    navigateToMock: vi.fn(async () => undefined),
    startEmailRegistrationMock: vi.fn(async () => undefined),
    PENDING_KEY: 'decentra.signup.pending.v1'
  }
})

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
          'auth.signUpEmailVerificationRequired':
            'Sign-up requires email verification on this homeserver',
          'auth.homeserverConnectionHint': 'Connection hint',
          'auth.signUpEmailSentTitle': 'Check your email',
          'auth.signUpEmailSentBody': 'We sent a link to {email}.',
          'auth.signUpEmailKeepTabOpen': 'Keep tab open',
          'auth.signUpCancel': 'Start over',
          'auth.signUpEmailNotConfirmedYet': 'Not confirmed',
          'auth.signUpPendingMissing': 'No pending',
          'auth.signUpSessionExpired': 'Session expired',
          'auth.signUpUnsupportedAuthStage': 'Unsupported'
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
    SIGNUP_PENDING_STORAGE_KEY: PENDING_KEY,
    clearSignupPending: vi.fn(() => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(PENDING_KEY)
      }
    }),
    useMatrixClient: () => ({
      isLoggedIn: ref(false)
    }),
    startEmailRegistration: startEmailRegistrationMock
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
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
    startEmailRegistrationMock.mockImplementation(async () => undefined)
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

  it('redirects to login when registration completes without pending email UIA', async () => {
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

    expect(startEmailRegistrationMock).toHaveBeenCalledWith(
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

  it('shows email-sent panel when pending state exists after start', async () => {
    startEmailRegistrationMock.mockImplementation(async () => {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ v: 1, baseUrl: 'x' })
      )
    })
    const wrapper = mountSignupPage()
    const inputElements = wrapper.findAll('input')
    const [
      emailInput,
      homeserverInput,
      usernameInput,
      passwordInput
    ] = inputElements
    await emailInput!.setValue('alice@example.org')
    await homeserverInput!.setValue('https://matrix.example.org')
    await usernameInput!.setValue('alice')
    await passwordInput!.setValue('secret')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.text().includes('Check your email'))
      .toBe(true)
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('Start over clears pending and returns to the form', async () => {
    startEmailRegistrationMock.mockImplementation(async () => {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ v: 1, baseUrl: 'x' })
      )
    })
    const { clearSignupPending } = await import('~/composables/useMatrixClient')
    const clearSpy = vi.mocked(clearSignupPending)
    const wrapper = mountSignupPage()
    for (const input of wrapper.findAll('input')) {
      await input.setValue('x')
    }
    await wrapper.find('form').trigger('submit.prevent')
    const buttons = wrapper.findAll('button')
    const startOver = buttons.find((b) => b.text().includes('Start over'))
    expect(startOver).toBeDefined()
    await startOver!.trigger('click')
    expect(clearSpy).toHaveBeenCalled()
    expect(wrapper.text().includes('Decentra'))
      .toBe(true)
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('shows translated error when signup is unavailable', async () => {
    startEmailRegistrationMock.mockRejectedValueOnce(
      new Error('SIGNUP_UNAVAILABLE')
    )
    const wrapper = mountSignupPage()

    await wrapper.find('form').trigger('submit.prevent')

    expect(
      wrapper.text().includes('Sign-up is not available on this homeserver')
    )
      .toBe(true)
  })

  it('shows translated error when email verification is required (legacy path)', async () => {
    startEmailRegistrationMock.mockRejectedValueOnce(
      new Error('SIGNUP_EMAIL_VERIFICATION_REQUIRED')
    )
    const wrapper = mountSignupPage()

    await wrapper.find('form').trigger('submit.prevent')

    expect(
      wrapper
        .text()
        .includes('Sign-up requires email verification on this homeserver')
    )
      .toBe(true)
  })
})
