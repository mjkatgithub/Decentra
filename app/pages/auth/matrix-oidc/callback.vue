<script setup lang="ts">
import {
  HOMESERVER_CONNECTION_HINT_ERROR,
  MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR,
  MATRIX_OIDC_INVALID_CALLBACK_ERROR,
  useMatrixClient
} from '~/composables/useMatrixClient'
import { useAppI18n } from '~/composables/useAppI18n'
import { onMounted, ref } from 'vue'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const { finalizeDelegatedMatrixOidcFromRedirectPayload, isLoggedIn } =
  useMatrixClient()
const { translateText } = useAppI18n()

if (isLoggedIn.value) {
  navigateTo('/chat')
}

function mapDelegatedOidcFinishError(thrown: unknown): string {
  if (!(thrown instanceof Error) || !thrown.message.trim()) {
    return translateText('auth.signInFailed')
  }
  const code = thrown.message
  if (code === HOMESERVER_CONNECTION_HINT_ERROR) {
    return translateText('auth.homeserverConnectionHint')
  }
  if (code === MATRIX_OIDC_INVALID_CALLBACK_ERROR) {
    return translateText('auth.matrixOidcCallbackInvalid')
  }
  if (code === MATRIX_OIDC_HTTPS_ORIGIN_REQUIRED_ERROR) {
    return translateText('auth.matrixOidcNeedsHttpsSiteUrl')
  }
  return translateText('auth.matrixOidcCallbackFailedRaw').replace(
    '{detail}',
    thrown.message.trim()
  )
}

onMounted(async () => {
  error.value = ''
  loading.value = true
  const code =
    typeof route.query.code === 'string' ? route.query.code.trim() : ''
  const state =
    typeof route.query.state === 'string' ? route.query.state.trim() : ''
  if (!code || !state) {
    loading.value = false
    error.value = translateText('auth.matrixOidcMissingCodeState')
    return
  }
  try {
    await finalizeDelegatedMatrixOidcFromRedirectPayload({ code, state })
    await navigateTo('/chat')
  } catch (thrownError: unknown) {
    error.value = mapDelegatedOidcFinishError(thrownError)
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <header
      class="border-b border-gray-800 bg-gray-900/85 backdrop-blur"
    >
      <div class="mx-auto flex h-16 w-full max-w-6xl items-center px-6">
        <NuxtLink
          to="/"
          class="text-lg font-semibold text-white/80 transition hover:text-white"
        >
          Decentra
        </NuxtLink>
      </div>
    </header>
    <main class="flex min-h-[calc(100vh-4rem)] justify-center px-4 py-12">
      <UCard class="w-full max-w-md space-y-4">
        <template #header>
          <h1 class="text-xl font-semibold">
            {{ translateText('auth.matrixOidcCallbackTitle') }}
          </h1>
        </template>
        <p
          v-if="loading && !error"
          class="text-sm text-gray-400"
        >
          {{ translateText('auth.matrixOidcCallbackBusy') }}
        </p>
        <UAlert
          v-if="error"
          color="error"
          :title="error"
        />
        <UButton
          v-if="!loading || error"
          to="/login"
          color="primary"
          class="w-full justify-center"
          type="button"
        >
          {{ translateText('auth.matrixOidcBackToLogin') }}
        </UButton>
      </UCard>
    </main>
  </div>
</template>
