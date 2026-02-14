<script setup lang="ts">
const baseUrl = ref('https://matrix.org')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const { login, isLoggedIn } = useMatrixClient()

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
      thrownError instanceof Error ? thrownError.message : 'Login fehlgeschlagen'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-semibold">Decentra – Anmelden</h1>
      </template>

      <form class="space-y-4" @submit.prevent="handleLogin">
        <UFormField label="Homeserver">
          <UInput
            v-model="baseUrl"
            placeholder="https://matrix.org"
            type="url"
            required
          />
        </UFormField>

        <UFormField label="Benutzername">
          <UInput
            v-model="username"
            placeholder="@user:matrix.org"
            required
          />
        </UFormField>

        <UFormField label="Passwort">
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
          Anmelden
        </UButton>
      </form>
    </UCard>
  </div>
</template>
