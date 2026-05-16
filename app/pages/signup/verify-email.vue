<script setup lang="ts">
import type { SignupTermsPolicyItem } from '~/composables/matrix/matrixRegistrationUia'
import { computed, onMounted, ref } from 'vue'
import {
  extractRecaptchaFromParams,
  finalizeEmailRegistration,
  HOMESERVER_CONNECTION_HINT_ERROR,
  hydrateTermsPoliciesForPending,
  readSignupPendingPublic,
  SIGNUP_EMAIL_NOT_CONFIRMED_YET,
  SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR,
  SIGNUP_MSISDN_NOT_SUPPORTED,
  SIGNUP_PENDING_MISSING,
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
  submitSignupRegistrationToken,
  submitSignupTermsAcceptance,
  useMatrixClient
} from '~/composables/useMatrixClient'
import { authFormInputUi } from '~/constants/authFormInputUi'
import { useAppI18n } from '~/composables/useAppI18n'

const loading = ref(true)
const error = ref('')
const needsCaptcha = ref(false)
const captchaSiteKey = ref('')
const captchaVersion = ref<'v2' | 'v3'>('v2')
const needsToken = ref(false)
const registrationTokenField = ref('')
const needsTerms = ref(false)
const termsPolicies = ref<SignupTermsPolicyItem[]>([])

const { isLoggedIn } = useMatrixClient()
const { translateText } = useAppI18n()

const activeStepLabel = computed(() => {
  if (needsTerms.value) {
    return translateText('auth.signUpTermsTitle')
  }
  if (needsToken.value) {
    return translateText('auth.signUpRegistrationTokenTitle')
  }
  if (needsCaptcha.value) {
    return translateText('auth.signUpCaptchaTitle')
  }
  return translateText('auth.signUpEmailVerifyingTitle')
})

if (isLoggedIn.value) {
  navigateTo('/chat')
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

function mapError(thrown: unknown): string {
  if (!(thrown instanceof Error) || !thrown.message) {
    return translateText('auth.signUpFailed')
  }
  const messageCode = thrown.message
  if (messageCode === SIGNUP_EMAIL_NOT_CONFIRMED_YET) {
    return translateText('auth.signUpEmailNotConfirmedYet')
  }
  if (messageCode === SIGNUP_PENDING_MISSING) {
    return translateText('auth.signUpPendingMissing')
  }
  if (messageCode === SIGNUP_SESSION_EXPIRED) {
    return translateText('auth.signUpSessionExpired')
  }
  if (messageCode === SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR) {
    return translateText('auth.signUpEmailVerificationRequired')
  }
  if (messageCode === SIGNUP_UNAVAILABLE_ERROR) {
    return translateText('auth.signUpUnavailable')
  }
  if (messageCode === SIGNUP_REGISTER_API_CLOSED_ERROR) {
    return translateText('auth.signUpRegisterApiClosed')
  }
  if (messageCode === HOMESERVER_CONNECTION_HINT_ERROR) {
    return translateText('auth.homeserverConnectionHint')
  }
  if (messageCode === SIGNUP_REGISTRATION_UNSUPPORTED_STAGE) {
    return translateText('auth.signUpUnsupportedAuthStage')
  }
  if (messageCode === SIGNUP_SSO_USE_WEB_CLIENT) {
    return translateText('auth.signUpSsoUseWebClient')
  }
  if (messageCode === SIGNUP_MSISDN_NOT_SUPPORTED) {
    return translateText('auth.signUpMsisdnUnsupported')
  }
  if (messageCode === SIGNUP_RECAPTCHA_FAILED) {
    return translateText('auth.signUpRecaptchaFailed')
  }
  if (messageCode === SIGNUP_RECAPTCHA_TOKEN_REQUIRED) {
    return translateText('auth.signUpRecaptchaRequired')
  }
  if (messageCode === SIGNUP_REGISTRATION_TOKEN_REQUIRED) {
    return translateText('auth.signUpRegistrationTokenRequired')
  }
  if (messageCode === SIGNUP_REGISTRATION_TOKEN_REJECTED) {
    return translateText('auth.signUpRegistrationTokenRejected')
  }
  if (messageCode === SIGNUP_TERMS_ACCEPTANCE_REQUIRED) {
    return translateText('auth.signUpTermsTitle')
  }
  return translateText('auth.signUpFailed')
}

async function runFinalize(recaptchaToken?: string | null) {
  error.value = ''
  loading.value = true
  try {
    await finalizeEmailRegistration({
      recaptchaResponse: recaptchaToken ?? undefined,
      registrationToken: registrationTokenField.value.trim()
        ? registrationTokenField.value.trim()
        : null
    })
    registrationTokenField.value = ''
    await navigateTo({
      path: '/login',
      query: { signup: 'success' }
    })
  } catch (thrownError) {
    if (
      thrownError instanceof Error &&
      thrownError.message === SIGNUP_RECAPTCHA_TOKEN_REQUIRED
    ) {
      needsCaptcha.value = true
      needsToken.value = false
      needsTerms.value = false
      hydrateCaptchaFromPending()
      if (!captchaSiteKey.value.trim()) {
        error.value = translateText('auth.signUpRecaptchaMissingSiteKey')
      }
      return
    }
    if (
      thrownError instanceof Error &&
      thrownError.message === SIGNUP_REGISTRATION_TOKEN_REQUIRED
    ) {
      needsToken.value = true
      needsCaptcha.value = false
      needsTerms.value = false
      return
    }
    if (
      thrownError instanceof Error &&
      thrownError.message === SIGNUP_TERMS_ACCEPTANCE_REQUIRED
    ) {
      needsTerms.value = true
      needsCaptcha.value = false
      needsToken.value = false
      termsPolicies.value = hydrateTermsPoliciesForPending()
      return
    }
    error.value = mapError(thrownError)
  } finally {
    loading.value = false
  }
}

async function handleCaptchaVerified(token: string) {
  needsCaptcha.value = false
  await runFinalize(token)
}

async function handleTokenSubmit() {
  error.value = ''
  try {
    await submitSignupRegistrationToken(registrationTokenField.value)
    needsToken.value = false
    registrationTokenField.value = ''
    await runFinalize()
  } catch (thrownError) {
    error.value = mapError(thrownError)
  }
}

async function handleTermsContinue() {
  error.value = ''
  try {
    await submitSignupTermsAcceptance()
    needsTerms.value = false
    await runFinalize()
  } catch (thrownError) {
    error.value = mapError(thrownError)
  }
}

const showBusyOverlay = computed(() => (
  loading.value &&
  !needsCaptcha.value &&
  !needsToken.value &&
  !needsTerms.value
))

onMounted(() => {
  void runFinalize()
})
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
        <UButton
          to="/signup"
          color="neutral"
          variant="outline"
        >
          {{ translateText('auth.signUp') }}
        </UButton>
      </div>
    </header>

    <main
      class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4"
    >
      <UCard class="w-full max-w-md">
        <template #header>
          <h1 class="text-xl font-semibold">
            {{ activeStepLabel }}
          </h1>
        </template>
        <div class="space-y-4">
          <div
            v-if="showBusyOverlay"
            class="text-sm text-gray-500 dark:text-gray-300"
          >
            {{ translateText('auth.signUpEmailVerifyingTitle') }}
          </div>
          <UAlert
            v-if="error"
            color="error"
            :title="error"
            class="mb-2"
          />
          <SignupTermsStep
            v-if="needsTerms && termsPolicies.length > 0"
            :policies="termsPolicies"
            @continue="handleTermsContinue"
          />
          <div
            v-if="needsToken"
            class="space-y-3"
          >
            <p class="text-sm text-gray-300">
              {{
                translateText('auth.signUpRegistrationTokenRequired')
              }}
            </p>
            <UFormField
              :label="translateText(
                'auth.signUpRegistrationTokenPlaceholder'
              )"
            >
              <UInput
                v-model="registrationTokenField"
                class="w-full"
                :ui="authFormInputUi"
                type="password"
                autocomplete="off"
              />
            </UFormField>
            <UButton
              class="w-full justify-center"
              :loading="loading"
              :disabled="!registrationTokenField.trim()"
              @click="handleTokenSubmit"
            >
              {{
                translateText('auth.signUpRegistrationTokenSubmit')
              }}
            </UButton>
          </div>
          <SignupRecaptchaStep
            v-if="needsCaptcha && captchaSiteKey.trim()"
            :site-key="captchaSiteKey"
            :version="captchaVersion"
            @verified="handleCaptchaVerified"
          />
          <div
            v-if="
              needsCaptcha &&
                !captchaSiteKey.trim() &&
                !loading
            "
            class="flex flex-col gap-2"
          >
            <UButton
              to="/signup"
              color="neutral"
              variant="outline"
              class="w-full justify-center"
            >
              {{ translateText('auth.signUpBackToForm') }}
            </UButton>
          </div>
          <div
            v-if="
              !loading &&
                !needsCaptcha &&
                !needsToken &&
                !needsTerms &&
                error
            "
            class="flex flex-col gap-2"
          >
            <UButton
              class="w-full justify-center"
              :loading="loading"
              @click="runFinalize()"
            >
              {{ translateText('auth.signUpRetry') }}
            </UButton>
            <UButton
              to="/signup"
              color="neutral"
              variant="outline"
              class="w-full justify-center"
            >
              {{ translateText('auth.signUpBackToForm') }}
            </UButton>
          </div>
        </div>
      </UCard>
    </main>
  </div>
</template>
