<script setup lang="ts">
import type { SignupTermsPolicyItem } from '~/composables/matrix/matrixRegistrationUia'
import { computed, onMounted, ref, watch } from 'vue'
import {
  MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR,
  clearSignupPending,
  extractRecaptchaFromParams,
  HOMESERVER_CONNECTION_HINT_ERROR,
  hydrateTermsPoliciesForPending,
  readSignupPendingPublic,
  SIGNUP_EMAIL_NOT_CONFIRMED_YET,
  SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR,
  SIGNUP_MSISDN_NOT_SUPPORTED,
  SIGNUP_PENDING_MISSING,
  SIGNUP_PENDING_STORAGE_KEY,
  SIGNUP_RECAPTCHA_FAILED,
  SIGNUP_RECAPTCHA_TOKEN_REQUIRED,
  SIGNUP_REGISTRATION_UNSUPPORTED_STAGE,
  SIGNUP_REGISTRATION_TOKEN_REJECTED,
  SIGNUP_REGISTRATION_TOKEN_REQUIRED,
  SIGNUP_SESSION_EXPIRED,
  SIGNUP_SSO_USE_WEB_CLIENT,
  SIGNUP_TERMS_ACCEPTANCE_REQUIRED,
  SIGNUP_REGISTER_API_CLOSED_ERROR,
  SIGNUP_UNAVAILABLE_ERROR,
  startEmailRegistration,
  submitSignupRecaptcha,
  submitSignupRegistrationToken,
  submitSignupTermsAcceptance,
  useMatrixClient
} from '~/composables/useMatrixClient'
import {
  fetchMatrixDelegatedClientHints,
  resolveTrustedAppHttpsOrigin
} from '~/composables/matrix/matrixOidcNative'
import { useAppI18n } from '~/composables/useAppI18n'

type SignupStep =
  | 'form'
  | 'registrationToken'
  | 'terms'
  | 'emailSent'
  | 'captcha'

const baseUrl = ref('https://matrix.org')
const email = ref('')
const username = ref('')
const password = ref('')
const registrationTokenInput = ref('')
const error = ref('')
const loading = ref(false)
const step = ref<SignupStep>('form')

const captchaSiteKey = ref('')
const captchaVersion = ref<'v2' | 'v3'>('v2')
const termsPolicies = ref<SignupTermsPolicyItem[]>([])

const delegatedOidcForHomeserver = ref(false)
const runtimeConfig = useRuntimeConfig()
const trustedHttpsOriginReady = computed(() => {
  return !!resolveTrustedAppHttpsOrigin(
    String(runtimeConfig.public.siteUrl ?? '').trim()
  )
})

const {
  isLoggedIn,
  startDelegatedMatrixNativeOidcAuth
} = useMatrixClient()
const { translateText } = useAppI18n()

if (isLoggedIn.value) {
  navigateTo('/chat')
}

function mapSignupError(thrown: unknown): string {
  if (!(thrown instanceof Error) || !thrown.message) {
    return translateText('auth.signUpFailed')
  }
  const message = thrown.message
  if (message === SIGNUP_UNAVAILABLE_ERROR) {
    return translateText('auth.signUpUnavailable')
  }
  if (message === SIGNUP_REGISTER_API_CLOSED_ERROR) {
    return translateText('auth.signUpRegisterApiClosed')
  }
  if (message === MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR) {
    return translateText('auth.matrixOidcNeedsHttpsSiteUrl')
  }
  if (message === SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR) {
    return translateText('auth.signUpEmailVerificationRequired')
  }
  if (message === HOMESERVER_CONNECTION_HINT_ERROR) {
    return translateText('auth.homeserverConnectionHint')
  }
  if (message === SIGNUP_EMAIL_NOT_CONFIRMED_YET) {
    return translateText('auth.signUpEmailNotConfirmedYet')
  }
  if (message === SIGNUP_PENDING_MISSING) {
    return translateText('auth.signUpPendingMissing')
  }
  if (message === SIGNUP_SESSION_EXPIRED) {
    return translateText('auth.signUpSessionExpired')
  }
  if (message === SIGNUP_REGISTRATION_UNSUPPORTED_STAGE) {
    return translateText('auth.signUpUnsupportedAuthStage')
  }
  if (message === SIGNUP_SSO_USE_WEB_CLIENT) {
    return translateText('auth.signUpSsoUseWebClient')
  }
  if (message === SIGNUP_MSISDN_NOT_SUPPORTED) {
    return translateText('auth.signUpMsisdnUnsupported')
  }
  if (message === SIGNUP_RECAPTCHA_FAILED) {
    return translateText('auth.signUpRecaptchaFailed')
  }
  if (message === SIGNUP_RECAPTCHA_TOKEN_REQUIRED) {
    return translateText('auth.signUpRecaptchaRequired')
  }
  if (message === SIGNUP_REGISTRATION_TOKEN_REQUIRED) {
    return translateText('auth.signUpRegistrationTokenRequired')
  }
  if (message === SIGNUP_REGISTRATION_TOKEN_REJECTED) {
    return translateText('auth.signUpRegistrationTokenRejected')
  }
  if (message === SIGNUP_TERMS_ACCEPTANCE_REQUIRED) {
    return translateText('auth.signUpTermsTitle')
  }
  return translateText('auth.signUpFailed')
}

function emailSentBodyText(): string {
  const base = translateText('auth.signUpEmailSentBody')
  return base.replace(
    '{email}',
    email.value.trim() || '—'
  )
}

function hydrateCaptchaFromPending(): void {
  const pending = readSignupPendingPublic()
  if (!pending) {
    captchaSiteKey.value = ''
    return
  }
  const fromParams = extractRecaptchaFromParams(pending.paramsSnapshot)
  captchaSiteKey.value =
    pending.recaptchaSiteKey?.trim() ||
    fromParams?.siteKey ||
    ''
  captchaVersion.value =
    pending.recaptchaVersion ||
    fromParams?.version ||
    'v2'
}

/**
 * Advances UI after server stored sign-up intermediate state (sessionStorage).
 */
function applySignupStepFromPending(): void {
  const pending = readSignupPendingPublic()
  error.value = ''
  if (!pending) {
    step.value = 'emailSent'
    return
  }
  if (pending.needsRegistrationTokenBeforeEmail) {
    step.value = 'registrationToken'
    return
  }
  if (pending.needsTermsAcceptanceBeforeEmail) {
    termsPolicies.value = hydrateTermsPoliciesForPending()
    step.value = 'terms'
    return
  }
  if (pending.needsRecaptchaBeforeEmail) {
    hydrateCaptchaFromPending()
    if (!captchaSiteKey.value.trim()) {
      error.value =
        translateText('auth.signUpRecaptchaMissingSiteKey')
      step.value = 'form'
      return
    }
    step.value = 'captcha'
    return
  }
  if (pending.sid) {
    step.value = 'emailSent'
    return
  }
  step.value = 'emailSent'
}

async function handleSignup() {
  error.value = ''
  loading.value = true
  const effectiveBaseUrl = baseUrl.value.trim() || 'https://matrix.org'
  try {
    await startEmailRegistration(
      effectiveBaseUrl,
      username.value,
      password.value,
      email.value
    )
    const isBrowserClient =
      typeof window !== 'undefined' &&
      (import.meta as { client?: boolean }).client !== false
    const hasStoredPending =
      isBrowserClient &&
      Boolean(sessionStorage.getItem(SIGNUP_PENDING_STORAGE_KEY))
    if (hasStoredPending) {
      applySignupStepFromPending()
      return
    }
    await navigateTo({
      path: '/login',
      query: { signup: 'success' }
    })
  } catch (thrownError) {
    error.value = mapSignupError(thrownError)
  } finally {
    loading.value = false
  }
}

async function handleRegistrationTokenContinue() {
  error.value = ''
  loading.value = true
  try {
    await submitSignupRegistrationToken(registrationTokenInput.value)
    registrationTokenInput.value = ''
    if (!readSignupPendingPublic()) {
      await navigateTo({
        path: '/login',
        query: { signup: 'success' }
      })
      return
    }
    applySignupStepFromPending()
  } catch (thrownError) {
    error.value = mapSignupError(thrownError)
  } finally {
    loading.value = false
  }
}

async function handleTermsContinue() {
  error.value = ''
  loading.value = true
  try {
    await submitSignupTermsAcceptance()
    if (!readSignupPendingPublic()) {
      await navigateTo({
        path: '/login',
        query: { signup: 'success' }
      })
      return
    }
    applySignupStepFromPending()
  } catch (thrownError) {
    error.value = mapSignupError(thrownError)
  } finally {
    loading.value = false
  }
}

async function handleCaptchaVerified(token: string) {
  error.value = ''
  loading.value = true
  try {
    await submitSignupRecaptcha(token)
    if (!readSignupPendingPublic()) {
      await navigateTo({
        path: '/login',
        query: { signup: 'success' }
      })
      return
    }
    applySignupStepFromPending()
    const lingering = readSignupPendingPublic()
    if (lingering && !lingering.sid) {
      error.value = translateText('auth.signUpFailed')
    }
  } catch (thrownError) {
    error.value = mapSignupError(thrownError)
  } finally {
    loading.value = false
  }
}

async function refreshDelegatedBanner(): Promise<void> {
  delegatedOidcForHomeserver.value = false
  const homeserver = baseUrl.value.trim()
  if (!homeserver) {
    return
  }
  try {
    await fetchMatrixDelegatedClientHints(homeserver)
    delegatedOidcForHomeserver.value = true
  } catch {
    delegatedOidcForHomeserver.value = false
  }
}

async function handleOidcSignupViaMas(): Promise<void> {
  error.value = ''
  if (!trustedHttpsOriginReady.value) {
    error.value = translateText('auth.matrixOidcNeedsHttpsSiteUrl')
    return
  }
  const homeserverUrl = baseUrl.value.trim() || 'https://matrix.org'
  try {
    await startDelegatedMatrixNativeOidcAuth({
      homeserverUrlInput: homeserverUrl,
      intent: 'signup'
    })
  } catch (thrownError: unknown) {
    error.value = mapSignupError(thrownError)
  }
}

watch(baseUrl, () => {
  void refreshDelegatedBanner()
})

onMounted(() => {
  void refreshDelegatedBanner()
})

function resetToForm() {
  clearSignupPending()
  step.value = 'form'
  error.value = ''
  captchaSiteKey.value = ''
  termsPolicies.value = []
  registrationTokenInput.value = ''
}

function clearForm() {
  resetToForm()
  baseUrl.value = 'https://matrix.org'
  email.value = ''
  username.value = ''
  password.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <header
      class="border-b border-gray-200/70 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/85"
    >
      <div
        class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6"
      >
        <NuxtLink
          to="/"
          class="text-lg font-semibold text-white/70 transition hover:text-white dark:text-white/80"
        >
          Decentra
        </NuxtLink>
        <div class="flex items-center gap-2">
          <UButton
            to="/login"
            color="neutral"
            variant="outline"
          >
            {{ translateText('auth.signIn') }}
          </UButton>
          <UButton
            to="/signup"
            color="primary"
          >
            {{ translateText('auth.signUp') }}
          </UButton>
        </div>
      </div>
    </header>

    <main
      class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4"
    >
      <UCard
        v-if="step === 'form'"
        class="w-full max-w-md"
      >
        <template #header>
          <h1 class="text-xl font-semibold">
            Decentra - {{ translateText('auth.signUp') }}
          </h1>
        </template>

        <div class="space-y-4">
          <UFormField :label="translateText('auth.homeserver')">
            <UInput
              v-model="baseUrl"
              placeholder="https://matrix.org"
              type="url"
              required
            />
          </UFormField>

          <div
            v-if="delegatedOidcForHomeserver"
            class="space-y-3 rounded-lg border border-primary-500/30 bg-gray-900/60 p-3"
          >
            <p class="text-sm text-gray-300">
              {{ translateText('auth.matrixOidcSignupIntro') }}
            </p>
            <UAlert
              v-if="!trustedHttpsOriginReady"
              color="warning"
              :title="translateText('auth.matrixOidcNeedsHttpsSiteUrl')"
            />
            <UButton
              type="button"
              class="w-full justify-center"
              color="primary"
              variant="outline"
              :loading="loading"
              :disabled="loading || !trustedHttpsOriginReady"
              @click="handleOidcSignupViaMas()"
            >
              {{ translateText('auth.matrixOidcSignupButton') }}
            </UButton>
            <p class="text-xs text-gray-500">
              {{ translateText('auth.matrixOidcSignupFinePrint') }}
            </p>
          </div>

          <p
            v-if="delegatedOidcForHomeserver"
            class="text-xs font-medium text-gray-500"
          >
            {{ translateText('auth.signUpClassicRegistrationDivider') }}
          </p>

          <UAlert
            v-if="error"
            color="error"
            :title="error"
          />

          <form
            class="space-y-4"
            @submit.prevent="handleSignup"
          >
            <UFormField :label="translateText('auth.email')">
              <UInput
                v-model="email"
                placeholder="name@example.org"
                type="email"
                required
              />
            </UFormField>

            <UFormField :label="translateText('auth.username')">
              <UInput
                v-model="username"
                placeholder="@user:matrix.org"
                required
              />
            </UFormField>

            <UFormField :label="translateText('auth.password')">
              <UInput
                v-model="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </UFormField>

            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ translateText('auth.signUpHomeserverPrivacyNotice') }}
            </p>

            <div class="grid grid-cols-2 gap-3">
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                class="w-full justify-center"
                :disabled="loading"
                @click="clearForm"
              >
                {{ translateText('cancel') }}
              </UButton>
              <UButton
                type="submit"
                class="w-full justify-center"
                :loading="loading"
              >
                {{ translateText('auth.signUp') }}
              </UButton>
            </div>
          </form>
        </div>
      </UCard>

      <UCard
        v-else-if="step === 'registrationToken'"
        class="w-full max-w-md"
      >
        <template #header>
          <h1 class="text-xl font-semibold">
            {{ translateText('auth.signUpRegistrationTokenTitle') }}
          </h1>
        </template>
        <div class="space-y-4">
          <p class="text-sm text-gray-300">
            {{ translateText('auth.signUpRegistrationTokenRequired') }}
          </p>
          <UAlert
            v-if="error"
            color="error"
            :title="error"
            class="mb-2"
          />
          <UFormField
            :label="translateText(
              'auth.signUpRegistrationTokenPlaceholder'
            )"
          >
            <UInput
              v-model="registrationTokenInput"
              type="password"
              autocomplete="off"
            />
          </UFormField>
          <UButton
            class="w-full justify-center"
            :loading="loading"
            :disabled="!registrationTokenInput.trim()"
            @click="handleRegistrationTokenContinue"
          >
            {{ translateText('auth.signUpRegistrationTokenSubmit') }}
          </UButton>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="w-full justify-center"
            :disabled="loading"
            @click="resetToForm"
          >
            {{ translateText('auth.signUpCancel') }}
          </UButton>
        </div>
      </UCard>

      <UCard
        v-else-if="step === 'terms'"
        class="w-full max-w-md"
      >
        <template #header>
          <h1 class="text-xl font-semibold">
            {{ translateText('auth.signUpTermsTitle') }}
          </h1>
        </template>
        <div class="space-y-4">
          <UAlert
            v-if="error"
            color="error"
            :title="error"
            class="mb-2"
          />
          <SignupTermsStep
            :policies="termsPolicies"
            @continue="handleTermsContinue"
          />
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="w-full justify-center"
            :disabled="loading"
            @click="resetToForm"
          >
            {{ translateText('auth.signUpCancel') }}
          </UButton>
        </div>
      </UCard>

      <UCard
        v-else-if="step === 'captcha'"
        class="w-full max-w-md"
      >
        <template #header>
          <h1 class="text-xl font-semibold">
            {{ translateText('auth.signUpCaptchaTitle') }}
          </h1>
        </template>
        <div class="space-y-4">
          <UAlert
            v-if="error"
            color="error"
            :title="error"
            class="mb-2"
          />
          <SignupRecaptchaStep
            :site-key="captchaSiteKey"
            :version="captchaVersion"
            @verified="handleCaptchaVerified"
          />
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="w-full justify-center"
            :disabled="loading"
            @click="resetToForm"
          >
            {{ translateText('auth.signUpCancel') }}
          </UButton>
        </div>
      </UCard>

      <UCard
        v-else
        class="w-full max-w-md"
      >
        <template #header>
          <h1 class="text-xl font-semibold">
            {{ translateText('auth.signUpEmailSentTitle') }}
          </h1>
        </template>
        <div class="space-y-4">
          <p class="text-sm text-gray-200">
            {{ emailSentBodyText() }}
          </p>
          <p class="text-sm text-gray-400">
            {{ translateText('auth.signUpEmailKeepTabOpen') }}
          </p>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="w-full justify-center"
            @click="resetToForm"
          >
            {{ translateText('auth.signUpCancel') }}
          </UButton>
        </div>
      </UCard>
    </main>
  </div>
</template>
