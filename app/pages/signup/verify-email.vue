<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  extractRecaptchaFromParams,
  finalizeEmailRegistration,
  HOMESERVER_CONNECTION_HINT_ERROR,
  readSignupPendingPublic,
  SIGNUP_EMAIL_NOT_CONFIRMED_YET,
  SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR,
  SIGNUP_PENDING_MISSING,
  SIGNUP_RECAPTCHA_FAILED,
  SIGNUP_RECAPTCHA_TOKEN_REQUIRED,
  SIGNUP_REGISTRATION_UNSUPPORTED_STAGE,
  SIGNUP_SESSION_EXPIRED,
  SIGNUP_UNAVAILABLE_ERROR,
  useMatrixClient
} from '~/composables/useMatrixClient'
import { useAppI18n } from '~/composables/useAppI18n'

const loading = ref(true)
const error = ref('')
const needsCaptcha = ref(false)
const captchaSiteKey = ref('')
const captchaVersion = ref<'v2' | 'v3'>('v2')

const { isLoggedIn } = useMatrixClient()
const { translateText } = useAppI18n()

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
  const m = thrown.message
  if (m === SIGNUP_EMAIL_NOT_CONFIRMED_YET) {
    return translateText('auth.signUpEmailNotConfirmedYet')
  }
  if (m === SIGNUP_PENDING_MISSING) {
    return translateText('auth.signUpPendingMissing')
  }
  if (m === SIGNUP_SESSION_EXPIRED) {
    return translateText('auth.signUpSessionExpired')
  }
  if (m === SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR) {
    return translateText('auth.signUpEmailVerificationRequired')
  }
  if (m === SIGNUP_UNAVAILABLE_ERROR) {
    return translateText('auth.signUpUnavailable')
  }
  if (m === HOMESERVER_CONNECTION_HINT_ERROR) {
    return translateText('auth.homeserverConnectionHint')
  }
  if (m === SIGNUP_REGISTRATION_UNSUPPORTED_STAGE) {
    return translateText('auth.signUpUnsupportedAuthStage')
  }
  if (m === SIGNUP_RECAPTCHA_FAILED) {
    return translateText('auth.signUpRecaptchaFailed')
  }
  if (m === SIGNUP_RECAPTCHA_TOKEN_REQUIRED) {
    return translateText('auth.signUpRecaptchaRequired')
  }
  return translateText('auth.signUpFailed')
}

async function runFinalize(recaptchaToken?: string | null) {
  error.value = ''
  loading.value = true
  try {
    await finalizeEmailRegistration({
      recaptchaResponse: recaptchaToken ?? undefined
    })
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
      hydrateCaptchaFromPending()
      if (!captchaSiteKey.value.trim()) {
        error.value = translateText('auth.signUpRecaptchaMissingSiteKey')
      }
      return
    }
    error.value = mapError(thrownError)
  } finally {
    loading.value = false
  }
}

async function handleCaptchaVerified(token: string) {
  await runFinalize(token)
}

onMounted(() => {
  void runFinalize()
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <header
      class="border-b border-gray-200/70 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/85"
    >
      <div class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
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
            {{
              needsCaptcha
                ? translateText('auth.signUpCaptchaTitle')
                : translateText('auth.signUpEmailVerifyingTitle')
            }}
          </h1>
        </template>
        <div class="space-y-4">
          <div
            v-if="loading && !needsCaptcha"
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
          <SignupRecaptchaStep
            v-if="needsCaptcha && captchaSiteKey.trim()"
            :site-key="captchaSiteKey"
            :version="captchaVersion"
            @verified="handleCaptchaVerified"
          />
          <div
            v-if="!loading && !needsCaptcha"
            class="flex flex-col gap-2"
          >
            <UButton
              v-if="error"
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
          <div
            v-if="needsCaptcha && !captchaSiteKey.trim() && !loading"
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
        </div>
      </UCard>
    </main>
  </div>
</template>
