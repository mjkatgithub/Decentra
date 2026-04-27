<script setup lang="ts">
import { ref } from 'vue'
import {
  clearSignupPending,
  HOMESERVER_CONNECTION_HINT_ERROR,
  SIGNUP_EMAIL_NOT_CONFIRMED_YET,
  SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR,
  SIGNUP_PENDING_MISSING,
  SIGNUP_PENDING_STORAGE_KEY,
  SIGNUP_REGISTRATION_UNSUPPORTED_STAGE,
  SIGNUP_SESSION_EXPIRED,
  SIGNUP_UNAVAILABLE_ERROR,
  startEmailRegistration,
  useMatrixClient
} from '~/composables/useMatrixClient'
import { useAppI18n } from '~/composables/useAppI18n'

const baseUrl = ref('https://matrix.org')
const email = ref('')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const step = ref<'form' | 'emailSent'>('form')

const { isLoggedIn } = useMatrixClient()
const { translateText } = useAppI18n()

if (isLoggedIn.value) {
  navigateTo('/chat')
}

function mapSignupError(thrown: unknown): string {
  if (!(thrown instanceof Error) || !thrown.message) {
    return translateText('auth.signUpFailed')
  }
  const m = thrown.message
  if (m === SIGNUP_UNAVAILABLE_ERROR) {
    return translateText('auth.signUpUnavailable')
  }
  if (m === SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR) {
    return translateText('auth.signUpEmailVerificationRequired')
  }
  if (m === HOMESERVER_CONNECTION_HINT_ERROR) {
    return translateText('auth.homeserverConnectionHint')
  }
  if (m === SIGNUP_EMAIL_NOT_CONFIRMED_YET) {
    return translateText('auth.signUpEmailNotConfirmedYet')
  }
  if (m === SIGNUP_PENDING_MISSING) {
    return translateText('auth.signUpPendingMissing')
  }
  if (m === SIGNUP_SESSION_EXPIRED) {
    return translateText('auth.signUpSessionExpired')
  }
  if (m === SIGNUP_REGISTRATION_UNSUPPORTED_STAGE) {
    return translateText('auth.signUpUnsupportedAuthStage')
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
    const isBrowserClient = typeof window !== 'undefined' &&
      (import.meta as { client?: boolean }).client !== false
    if (isBrowserClient) {
      if (sessionStorage.getItem(SIGNUP_PENDING_STORAGE_KEY)) {
        step.value = 'emailSent'
        return
      }
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

function resetToForm() {
  clearSignupPending()
  step.value = 'form'
  error.value = ''
}

function clearForm() {
  baseUrl.value = 'https://matrix.org'
  email.value = ''
  username.value = ''
  password.value = ''
  error.value = ''
  clearSignupPending()
  step.value = 'form'
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

          <UFormField :label="translateText('auth.homeserver')">
            <UInput
              v-model="baseUrl"
              placeholder="https://matrix.org"
              type="url"
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

          <UAlert
            v-if="error"
            color="error"
            :title="error"
            class="mb-4"
          />

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
