import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import SignupPage from '~/pages/signup.vue'
import AuthMaskedSecretInput from '~/components/auth/MaskedSecretInput.vue'

vi.mock('~/composables/matrix/matrixOidcNative', () => {
  return {
    fetchMatrixDelegatedClientHints: vi.fn(async () => {
      throw new Error('MATRIX_OIDC_NO_DELEGATED_AUTH')
    }),
    resolveTrustedAppHttpsOrigin: vi.fn(() => '')
  }
})

const {
  navigateToMock,
  startEmailRegistrationMock,
  submitSignupRecaptchaMock,
  mockResolveHomeserverBaseUrlForClient,
  PENDING_KEY
} = vi.hoisted(() => {
  function mockResolveHomeserverBaseUrlForClient(input: string): string {
    const trimmed = input.trim()
    const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    try {
      return new URL(withScheme).origin
    } catch {
      return ''
    }
  }
  return {
    navigateToMock: vi.fn(async () => undefined),
    startEmailRegistrationMock: vi.fn(async () => undefined),
    submitSignupRecaptchaMock: vi.fn(async () => undefined),
    mockResolveHomeserverBaseUrlForClient,
    PENDING_KEY: 'decentra.signup.pending.v1'
  }
})

function mockExtractRecaptchaFromParams(
  params?: Record<string, unknown>
): { siteKey: string; version: 'v2' | 'v3' } | null {
  if (!params || typeof params !== 'object') {
    return null
  }
  const blockUnknown = params['m.login.recaptcha']
  if (!blockUnknown || typeof blockUnknown !== 'object') {
    return null
  }
  const block = blockUnknown as Record<string, unknown>
  const publicKey = block.public_key
  if (typeof publicKey !== 'string' || !publicKey.trim()) {
    return null
  }
  let version: 'v2' | 'v3' = 'v2'
  const rawVersion = block.version
  if (rawVersion === 'v3' || rawVersion === 3) {
    version = 'v3'
  }
  return { siteKey: publicKey.trim(), version }
}

function mockReadSignupPendingPublic(): Record<string, unknown> | null {
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  const raw = sessionStorage.getItem(PENDING_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

vi.mock('~/composables/useAppI18n', () => {
  return {
    useAppI18n: () => ({
      translateText: (
        key: string,
        placeholders?: Record<string, string>
      ) => {
        const messages: Record<string, string> = {
          'auth.signIn': 'Sign in',
          'auth.signUp': 'Sign up',
          'auth.email': 'Email',
          'auth.homeserver': 'Homeserver',
          'auth.username': 'Username',
          'auth.password': 'Password',
          'auth.signUpFailed': 'Sign up failed',
          'auth.signUpUnavailable':
            'Sign-up is not available on this homeserver',
          'auth.signUpRegisterApiClosed':
            'REGISTER_CLOSED_MSG {homeserverPortal}',
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
          'auth.signUpUnsupportedAuthStage': 'Unsupported',
          'auth.signUpCaptchaTitle': 'Verify you are human',
          'auth.signUpRecaptchaMissingSiteKey': 'Missing site key',
          'auth.signUpRecaptchaFailed': 'reCAPTCHA failed',
          'auth.signUpCaptchaConsentLead': 'Consent lead',
          'auth.signUpHomeserverPrivacyNotice': 'Homeserver notice',
          'auth.signUpPrivacyPolicyLink': 'Privacy',
          'auth.signUpCookieSettings': 'Cookies',
          'auth.signUpAgreeLoadRecaptcha': 'Agree load',
          'auth.signUpRunRecaptchaCheck': 'Run check',
          'cancel': 'Cancel',
          'auth.signUpRegistrationTokenRequired': 'Registration token hint',
          'auth.signUpRegistrationTokenPlaceholder':
            'Paste registration token',
          'auth.signUpRegistrationTokenSubmit': 'Continue',
          'auth.signUpRegistrationTokenTitle': 'Registration token',
          'auth.signUpTermsTitle': 'Policies',
          'auth.signUpSsoUseWebClient': 'Use operator SSO web sign-up',
          'auth.signUpMsisdnUnsupported': 'SMS signup unsupported'
        }
        let text = messages[key] ?? key
        if (placeholders) {
          for (const [ph, value] of Object.entries(placeholders)) {
            text = text.replaceAll(`{${ph}}`, value)
          }
        }
        return text
      }
    })
  }
})

vi.mock('~/composables/useMatrixClient', () => {
  return {
    SIGNUP_UNAVAILABLE_ERROR: 'SIGNUP_UNAVAILABLE',
    SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR:
      'SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    SIGNUP_PENDING_MISSING: 'SIGNUP_PENDING_MISSING',
    SIGNUP_RECAPTCHA_FAILED: 'SIGNUP_RECAPTCHA_FAILED',
    SIGNUP_RECAPTCHA_TOKEN_REQUIRED: 'SIGNUP_RECAPTCHA_TOKEN_REQUIRED',
    SIGNUP_PENDING_STORAGE_KEY: PENDING_KEY,
    HOMESERVER_CONNECTION_HINT_ERROR: 'HOMESERVER_CONNECTION_HINT',
    SIGNUP_EMAIL_NOT_CONFIRMED_YET: 'SIGNUP_EMAIL_NOT_CONFIRMED_YET',
    SIGNUP_REGISTRATION_UNSUPPORTED_STAGE:
      'SIGNUP_REGISTRATION_UNSUPPORTED_STAGE',
    SIGNUP_REGISTRATION_TOKEN_REJECTED:
      'SIGNUP_REGISTRATION_TOKEN_REJECTED',
    SIGNUP_REGISTRATION_TOKEN_REQUIRED:
      'SIGNUP_REGISTRATION_TOKEN_REQUIRED',
    SIGNUP_TERMS_ACCEPTANCE_REQUIRED:
      'SIGNUP_TERMS_ACCEPTANCE_REQUIRED',
    SIGNUP_MSISDN_NOT_SUPPORTED: 'SIGNUP_MSISDN_NOT_SUPPORTED',
    SIGNUP_SSO_USE_WEB_CLIENT: 'SIGNUP_SSO_USE_WEB_CLIENT',
    SIGNUP_SESSION_EXPIRED: 'SIGNUP_SESSION_EXPIRED',
    SIGNUP_REGISTER_API_CLOSED_ERROR: 'SIGNUP_REGISTER_API_CLOSED',
    resolveHomeserverBaseUrlForClient: mockResolveHomeserverBaseUrlForClient,
    extractRecaptchaFromParams: mockExtractRecaptchaFromParams,
    readSignupPendingPublic: mockReadSignupPendingPublic,
    clearSignupPending: vi.fn(() => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(PENDING_KEY)
      }
    }),
    MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR:
      'MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED',
    useMatrixClient: () => ({
      isLoggedIn: ref(false),
      startDelegatedMatrixNativeOidcAuth: vi.fn(async () => undefined)
    }),
    startEmailRegistration: startEmailRegistrationMock,
    submitSignupRecaptcha: submitSignupRecaptchaMock,
    submitSignupRegistrationToken: vi.fn(async () => undefined),
    submitSignupTermsAcceptance: vi.fn(async () => undefined),
    hydrateTermsPoliciesForPending: vi.fn(() => [])
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
  props: ['type', 'disabled', 'loading', 'to'],
  template: `
    <button :type="type || 'button'" :disabled="disabled">
      <slot />
    </button>
  `
}

const NuxtLinkStub = {
  template: '<a><slot /></a>'
}

const UIconStub = {
  props: ['name'],
  template: '<span class="icon-stub" />'
}

const ClientOnlyStub = {
  template: '<span><slot /></span>'
}

const SignupRecaptchaStepStub = {
  props: ['siteKey', 'version'],
  template: '<div class="recaptcha-stub">stub</div>'
}

const SignupTermsStepStub = {
  template: '<div class="terms-stub"></div>'
}

describe('signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
    startEmailRegistrationMock.mockImplementation(async () => undefined)
    submitSignupRecaptchaMock.mockImplementation(async () => undefined)
    ;(globalThis as Record<string, unknown>).navigateTo = navigateToMock
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        siteUrl: '',
        matrixOidcClientId: '',
        iubendaSiteId: '',
        iubendaCookiePolicyId: '',
        iubendaLang: 'de',
        iubendaRecaptchaPurposeIds: '',
        iubendaPrivacyPolicyUrl: ''
      }
    }))
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
          UIcon: UIconStub,
          NuxtLink: NuxtLinkStub,
          ClientOnly: ClientOnlyStub,
          SignupRecaptchaStep: SignupRecaptchaStepStub,
          SignupTermsStep: SignupTermsStepStub
        },
        components: {
          AuthMaskedSecretInput
        }
      }
    })
  }

  it('redirects to login when registration completes without pending email UIA', async () => {
    const wrapper = mountSignupPage()
    const inputElements = wrapper.findAll('input')
    expect(inputElements).toHaveLength(4)
    const [
      homeserverInput,
      emailInput,
      usernameInput,
      passwordInput
    ] = inputElements

    await emailInput!.setValue('alice@example.org')
    await homeserverInput!.setValue('https://matrix.example.org')
    await usernameInput!.setValue('@alice:example.org')
    await passwordInput!.setValue('secret')
    expect((passwordInput!.element as HTMLInputElement).value).toBe('******')
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
      homeserverInput,
      emailInput,
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

  it('shows captcha panel when homeserver requires captcha before email', async () => {
    startEmailRegistrationMock.mockImplementation(async () => {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          v: 1,
          baseUrl: 'https://matrix.example.org',
          needsRecaptchaBeforeEmail: true,
          recaptchaSiteKey: 'test-site-key',
          recaptchaVersion: 'v2'
        })
      )
    })
    const wrapper = mountSignupPage()
    const inputElements = wrapper.findAll('input')
    const [
      homeserverInput,
      emailInput,
      usernameInput,
      passwordInput
    ] = inputElements
    await emailInput!.setValue('alice@example.org')
    await homeserverInput!.setValue('https://matrix.example.org')
    await usernameInput!.setValue('alice')
    await passwordInput!.setValue('secret')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.text().includes('Verify you are human'))
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

  it('shows register-API-closed hint when HS blocks client /register', async () => {
    startEmailRegistrationMock.mockRejectedValueOnce(
      new Error('SIGNUP_REGISTER_API_CLOSED')
    )
    const wrapper = mountSignupPage()

    await wrapper.find('form').trigger('submit.prevent')

    expect(
      wrapper.text().includes(
        'REGISTER_CLOSED_MSG https://matrix.org'
      )
    ).toBe(true)
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
