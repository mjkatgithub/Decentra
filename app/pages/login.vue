<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  HOMESERVER_CONNECTION_HINT_ERROR,
  useMatrixClient
} from '~/composables/useMatrixClient'
import { useAppI18n } from '~/composables/useAppI18n'

const baseUrl = ref('https://matrix.org')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const route = useRoute()
const signupSuccess = computed(() => route.query.signup === 'success')

const { login, isLoggedIn } = useMatrixClient()
const { translateText } = useAppI18n()

if (isLoggedIn.value) {
  navigateTo('/chat')
}

async function handleLogin() {
  error.value = ''
  loading.value = true
  const effectiveBaseUrl = baseUrl.value.trim() || 'https://matrix.org'
  try {
    await login(effectiveBaseUrl, username.value, password.value)
    await navigateTo('/chat')
  } catch (thrownError) {
    if (
      thrownError instanceof Error &&
      thrownError.message === HOMESERVER_CONNECTION_HINT_ERROR
    ) {
      error.value = translateText('auth.homeserverConnectionHint')
    } else {
      error.value =
        thrownError instanceof Error
          ? thrownError.message
          : translateText('auth.signInFailed')
    }
  } finally {
    loading.value = false
  }
}

function clearForm() {
  baseUrl.value = 'https://matrix.org'
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
          <UButton to="/login" color="primary">
            {{ translateText('auth.signIn') }}
          </UButton>
          <UButton to="/signup" color="neutral" variant="outline">
            {{ translateText('auth.signUp') }}
          </UButton>
        </div>
      </div>
    </header>

    <main class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <UCard class="w-full max-w-md">
        <template #header>
          <h1 class="text-xl font-semibold">
            Decentra - {{ translateText('auth.signIn') }}
          </h1>
        </template>

        <div class="space-y-4">
          <UAlert
            v-if="signupSuccess"
            color="success"
            :title="translateText('auth.signUpSuccess')"
          />

          <UFormField :label="translateText('auth.homeserver')">
            <UInput
              v-model="baseUrl"
              placeholder="https://matrix.org"
              type="url"
              required
            />
          </UFormField>

          <UAlert
            v-if="error"
            color="error"
            :title="error"
          />

          <form class="space-y-4" @submit.prevent="handleLogin">
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
                {{ translateText('auth.signIn') }}
              </UButton>
            </div>
          </form>
        </div>
      </UCard>
    </main>
  </div>
</template>
