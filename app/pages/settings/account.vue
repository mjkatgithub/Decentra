<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useThemePreference } from '~/composables/useThemePreference'

type ThemeMode = 'light' | 'dark' | 'system'
type AppLocale = 'en' | 'de'

const { isLoggedIn, userId, logout } = useMatrixClient()
const { locale, setLocale, translateText } = useAppI18n()
const { getThemePreference, setThemePreference } = useThemePreference()

if (!isLoggedIn.value) {
  navigateTo('/login')
}

const selectedTheme = computed<ThemeMode>({
  get() {
    return getThemePreference()
  },
  set(value) {
    setThemePreference(value)
  }
})

const selectedLocale = computed<AppLocale>({
  get() {
    return locale.value
  },
  set(value) {
    setLocale(value)
  }
})

const themeOptions: Array<{ label: string; value: ThemeMode }> = [
  { label: 'System', value: 'system' },
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' }
]

const localeOptions: Array<{ label: string; value: AppLocale }> = [
  { label: 'English', value: 'en' },
  { label: 'Deutsch', value: 'de' }
]

function handleLogout() {
  logout()
  navigateTo('/login')
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-2xl items-start p-4">
    <UCard class="w-full">
      <template #header>
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">
            {{ translateText('settings.accountTitle') }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ translateText('settings.accountDescription') }}
          </p>
          <p
            v-if="userId"
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            {{ translateText('chat.loggedInAs') }} {{ userId }}
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <label class="flex flex-col gap-2 text-sm">
          <span class="font-medium">{{ translateText('settings.theme') }}</span>
          <select
            v-model="selectedTheme"
            class="rounded-lg border border-gray-300 bg-white px-3 py-2
                   dark:border-gray-700 dark:bg-gray-900"
          >
            <option
              v-for="themeOption in themeOptions"
              :key="themeOption.value"
              :value="themeOption.value"
            >
              {{ themeOption.label }}
            </option>
          </select>
        </label>

        <label class="flex flex-col gap-2 text-sm">
          <span class="font-medium">{{ translateText('settings.language') }}</span>
          <select
            v-model="selectedLocale"
            class="rounded-lg border border-gray-300 bg-white px-3 py-2
                   dark:border-gray-700 dark:bg-gray-900"
          >
            <option
              v-for="localeOption in localeOptions"
              :key="localeOption.value"
              :value="localeOption.value"
            >
              {{ localeOption.label }}
            </option>
          </select>
        </label>
      </div>

      <template #footer>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="soft"
            to="/chat"
          >
            {{ translateText('settings.backToChat') }}
          </UButton>
          <UButton color="error" variant="soft" @click="handleLogout">
            {{ translateText('chat.signOut') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
