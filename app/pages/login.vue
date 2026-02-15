<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

const baseUrl = ref('https://matrix.org')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const { login, isLoggedIn } = useMatrixClient()
const { translateText } = useAppI18n()

if (isLoggedIn.value) {
  navigateTo('/chat')
}

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await login(baseUrl.value, username.value, password.value)
    await navigateTo('/chat')
  } catch (thrownError) {
    error.value =
      thrownError instanceof Error
        ? thrownError.message
        : translateText('auth.signInFailed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-semibold">
          Decentra - {{ translateText('auth.signIn') }}
        </h1>
      </template>

      <form class="space-y-4" @submit.prevent="handleLogin">
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

        <UButton
          type="submit"
          block
          :loading="loading"
        >
          {{ translateText('auth.signIn') }}
        </UButton>
      </form>
    </UCard>
  </div>
</template>
