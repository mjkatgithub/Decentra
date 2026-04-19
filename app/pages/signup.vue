<script setup lang="ts">
import { ref } from 'vue'
import {
  HOMESERVER_CONNECTION_HINT_ERROR,
  SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR,
  SIGNUP_UNAVAILABLE_ERROR,
  useMatrixClient
} from '~/composables/useMatrixClient'
import { useAppI18n } from '~/composables/useAppI18n'

const baseUrl = ref('https://matrix.org')
const email = ref('')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const { register, isLoggedIn } = useMatrixClient()
const { translateText } = useAppI18n()

if (isLoggedIn.value) {
  navigateTo('/chat')
}

async function handleSignup() {
  error.value = ''
  loading.value = true
  const effectiveBaseUrl = baseUrl.value.trim() || 'https://matrix.org'
  try {
    await register(
      effectiveBaseUrl,
      username.value,
      password.value,
      email.value
    )
    await navigateTo({
      path: '/login',
      query: { signup: 'success' }
    })
  } catch (thrownError) {
    if (
      thrownError instanceof Error &&
      thrownError.message === SIGNUP_UNAVAILABLE_ERROR
    ) {
      error.value = translateText('auth.signUpUnavailable')
    } else if (
      thrownError instanceof Error &&
      thrownError.message === SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR
    ) {
      error.value = translateText('auth.signUpEmailVerificationRequired')
    } else if (
      thrownError instanceof Error &&
      thrownError.message === HOMESERVER_CONNECTION_HINT_ERROR
    ) {
      error.value = translateText('auth.homeserverConnectionHint')
    } else {
      error.value =
        thrownError instanceof Error &&
        thrownError.message.trim()
          ? thrownError.message
          : translateText('auth.signUpFailed')
    }
  } finally {
    loading.value = false
  }
}

function clearForm() {
  baseUrl.value = 'https://matrix.org'
  email.value = ''
  username.value = ''
  password.value = ''
  error.value = ''
}
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
        <div class="flex items-center gap-2">
          <UButton to="/login" color="neutral" variant="outline">
            {{ translateText('auth.signIn') }}
          </UButton>
          <UButton to="/signup" color="primary">
            {{ translateText('auth.signUp') }}
          </UButton>
        </div>
      </div>
    </header>

    <main class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <UCard class="w-full max-w-md">
        <template #header>
          <h1 class="text-xl font-semibold">
            Decentra - {{ translateText('auth.signUp') }}
          </h1>
        </template>

        <form class="space-y-4" @submit.prevent="handleSignup">
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
    </main>
  </div>
</template>
