import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import VerifyPage from '~/pages/signup/verify-email.vue'

const {
  navigateToMock,
  finalizeMock,
  readSignupPendingPublicMock,
  extractRecaptchaFromParamsMock,
  PENDING_KEY
} = vi.hoisted(() => {
  return {
    navigateToMock: vi.fn(async () => undefined),
    finalizeMock: vi.fn(async () => undefined),
    readSignupPendingPublicMock: vi.fn(() => null as Record<
      string,
      unknown
    > | null),
    extractRecaptchaFromParamsMock: vi.fn(() => null as {
      siteKey: string
      version: 'v2' | 'v3'
    } | null),
    PENDING_KEY: 'decentra.signup.pending.v1'
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
          'auth.signUpRegisterApiClosed': 'Register API closed hint',
          'auth.homeserverConnectionHint': 'Hint',
          'auth.signUpUnsupportedAuthStage': 'Unsupported',
          'auth.signUpSessionExpired': 'Expired',
          'auth.signUpCaptchaTitle': 'Verify you are human',
          'auth.signUpRecaptchaFailed': 'reCAPTCHA failed',
          'auth.signUpRecaptchaRequired': 'reCAPTCHA required',
          'auth.signUpRecaptchaMissingSiteKey': 'Missing site key',
          'auth.signUpRegistrationTokenRequired': 'Token needed',
          'auth.signUpRegistrationTokenPlaceholder': 'Token placeholder',
          'auth.signUpRegistrationTokenSubmit': 'Continue token',
          'auth.signUpRegistrationTokenTitle': 'Token title',
          'auth.signUpTermsTitle': 'Terms title',
          'auth.signUpTermsAcceptCheckbox': 'Terms accept',
          'auth.signUpTermsContinue': 'Terms go',
          'auth.signUpTermsEmptyPolicies': 'No policy links'
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
    SIGNUP_REGISTER_API_CLOSED_ERROR: 'SIGNUP_REGISTER_API_CLOSED',
    HOMESERVER_CONNECTION_HINT_ERROR: 'HOMESERVER_CONNECTION_HINT',
    SIGNUP_REGISTRATION_UNSUPPORTED_STAGE:
      'SIGNUP_REGISTRATION_UNSUPPORTED_STAGE',
    SIGNUP_RECAPTCHA_FAILED: 'SIGNUP_RECAPTCHA_FAILED',
    SIGNUP_RECAPTCHA_TOKEN_REQUIRED: 'SIGNUP_RECAPTCHA_TOKEN_REQUIRED',
    SIGNUP_REGISTRATION_TOKEN_REQUIRED:
      'SIGNUP_REGISTRATION_TOKEN_REQUIRED',
    SIGNUP_REGISTRATION_TOKEN_REJECTED:
      'SIGNUP_REGISTRATION_TOKEN_REJECTED',
    SIGNUP_TERMS_ACCEPTANCE_REQUIRED:
      'SIGNUP_TERMS_ACCEPTANCE_REQUIRED',
    SIGNUP_MSISDN_NOT_SUPPORTED: 'SIGNUP_MSISDN_NOT_SUPPORTED',
    SIGNUP_SSO_USE_WEB_CLIENT: 'SIGNUP_SSO_USE_WEB_CLIENT',
    SIGNUP_PENDING_STORAGE_KEY: PENDING_KEY,
    readSignupPendingPublic: readSignupPendingPublicMock,
    extractRecaptchaFromParams: extractRecaptchaFromParamsMock,
    hydrateTermsPoliciesForPending: vi.fn(() => []),
    submitSignupRegistrationToken: vi.fn(async () => undefined),
    submitSignupTermsAcceptance: vi.fn(async () => undefined),
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

const SignupRecaptchaStepStub = {
  props: ['siteKey', 'version'],
  emits: ['verified'],
  template:
    '<button type="button" class="mock-verify" @click="$emit(\'verified\', \'tok\')">Verify captcha</button>'
}

const SignupTermsStepStub = {
  props: ['policies'],
  emits: ['continue'],
  template:
    '<button type="button" class="mock-terms" @click="$emit(\'continue\')">' +
    'Accept terms</button>'
}

const UInputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `
    <input
      class="mock-reg-input"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    >
  `
}

const UFormFieldStub = {
  template: '<div><slot /></div>'
}

describe('signup verify-email page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    finalizeMock.mockResolvedValue(undefined)
    readSignupPendingPublicMock.mockReturnValue(null)
    extractRecaptchaFromParamsMock.mockReturnValue(null)
    ;(globalThis as Record<string, unknown>).navigateTo = navigateToMock
  })

  function mountVerify() {
    return mount(VerifyPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UAlert: UAlertStub,
          UButton: UButtonStub,
          NuxtLink: NuxtLinkStub,
          UInput: UInputStub,
          UFormField: UFormFieldStub,
          SignupRecaptchaStep: SignupRecaptchaStepStub,
          SignupTermsStep: SignupTermsStepStub
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
    const retry = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Retry'))
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

  it('shows captcha when finalize requires token', async () => {
    readSignupPendingPublicMock.mockReturnValue({
      recaptchaSiteKey: 'site-x',
      recaptchaVersion: 'v2'
    })
    finalizeMock.mockRejectedValueOnce(
      new Error('SIGNUP_RECAPTCHA_TOKEN_REQUIRED')
    )
    const wrapper = mountVerify()
    await flushPromises()
    expect(wrapper.text().includes('Verify you are human')).toBe(true)
    const captchaBtn = wrapper.find('.mock-verify')
    expect(captchaBtn.exists()).toBe(true)
    finalizeMock.mockResolvedValueOnce(undefined)
    await captchaBtn.trigger('click')
    await flushPromises()
    expect(finalizeMock).toHaveBeenLastCalledWith({
      recaptchaResponse: 'tok',
      registrationToken: null
    })
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/login',
      query: { signup: 'success' }
    })
  })

  it('shows error when captcha needed but site key missing', async () => {
    readSignupPendingPublicMock.mockReturnValue({})
    extractRecaptchaFromParamsMock.mockReturnValue(null)
    finalizeMock.mockRejectedValueOnce(
      new Error('SIGNUP_RECAPTCHA_TOKEN_REQUIRED')
    )
    const wrapper = mountVerify()
    await flushPromises()
    expect(wrapper.text().includes('Missing site key')).toBe(true)
  })
})
