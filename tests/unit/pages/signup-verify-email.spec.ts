import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import VerifyPage from '~/pages/signup/verify-email.vue'

const { navigateToMock, finalizeMock } = vi.hoisted(() => {
  return {
    navigateToMock: vi.fn(async () => undefined),
    finalizeMock: vi.fn(async () => undefined)
  }
})

vi.mock('~/composables/useAppI18n', () => {
  return {
    useAppI18n: () => ({
      translateText: (key: string) => {
        const messages: Record<string, string> = {
          'auth.signUp': 'Sign up',
          'auth.signUpEmailVerifyingTitle': 'Verifying',
          'auth.signUpEmailNotConfirmedYet': 'Not confirmed yet',
          'auth.signUpPendingMissing': 'No pending',
          'auth.signUpFailed': 'Failed',
          'auth.signUpRetry': 'Retry',
          'auth.signUpBackToForm': 'Back',
          'auth.signUpEmailVerificationRequired': 'Email required',
          'auth.signUpUnavailable': 'Unavailable',
          'auth.homeserverConnectionHint': 'Hint',
          'auth.signUpUnsupportedAuthStage': 'Unsupported',
          'auth.signUpSessionExpired': 'Expired'
        }
        return messages[key] ?? key
      }
    })
  }
})

vi.mock('~/composables/useMatrixClient', () => {
  return {
    SIGNUP_EMAIL_NOT_CONFIRMED_YET: 'SIGNUP_EMAIL_NOT_CONFIRMED_YET',
    SIGNUP_PENDING_MISSING: 'SIGNUP_PENDING_MISSING',
    SIGNUP_SESSION_EXPIRED: 'SIGNUP_SESSION_EXPIRED',
    SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR:
      'SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    SIGNUP_UNAVAILABLE_ERROR: 'SIGNUP_UNAVAILABLE',
    HOMESERVER_CONNECTION_HINT_ERROR: 'HOMESERVER_CONNECTION_HINT',
    SIGNUP_REGISTRATION_UNSUPPORTED_STAGE:
      'SIGNUP_REGISTRATION_UNSUPPORTED_STAGE',
    useMatrixClient: () => ({ isLoggedIn: ref(false) }),
    finalizeEmailRegistration: finalizeMock
  }
})

const UCardStub = {
  template: '<div><slot /><slot name="header" /></div>'
}

const UAlertStub = {
  props: ['title'],
  template: '<p class="alert">{{ title }}</p>'
}

const UButtonStub = {
  props: ['to', 'type'],
  template: `
    <button :type="type || 'button'" @click="$emit('click')">
      <slot />
    </button>
  `
}

const NuxtLinkStub = {
  props: ['to'],
  template: '<a><slot /></a>'
}

describe('signup verify-email page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    finalizeMock.mockResolvedValue(undefined)
    ;(globalThis as Record<string, unknown>).navigateTo = navigateToMock
  })

  function mountVerify() {
    return mount(VerifyPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UAlert: UAlertStub,
          UButton: UButtonStub,
          NuxtLink: NuxtLinkStub
        }
      }
    })
  }

  it('finalizes and redirects to login with success query', async () => {
    mountVerify()
    await flushPromises()
    expect(finalizeMock).toHaveBeenCalled()
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/login',
      query: { signup: 'success' }
    })
  })

  it('shows not-confirmed message and retry calls finalize again', async () => {
    finalizeMock
      .mockRejectedValueOnce(new Error('SIGNUP_EMAIL_NOT_CONFIRMED_YET'))
      .mockResolvedValueOnce(undefined)
    const wrapper = mountVerify()
    await flushPromises()
    expect(wrapper.text().includes('Not confirmed yet')).toBe(true)
    const retry = wrapper.findAll('button').find((b) => b.text().includes('Retry'))
    expect(retry).toBeDefined()
    const beforeRetry = finalizeMock.mock.calls.length
    await retry!.trigger('click')
    await flushPromises()
    expect(finalizeMock.mock.calls.length).toBeGreaterThan(beforeRetry)
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/login',
      query: { signup: 'success' }
    })
  })

  it('shows pending missing and back to sign-up', async () => {
    finalizeMock.mockRejectedValueOnce(new Error('SIGNUP_PENDING_MISSING'))
    const wrapper = mountVerify()
    await flushPromises()
    expect(wrapper.text().includes('No pending')).toBe(true)
  })
})
