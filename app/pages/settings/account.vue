<script setup lang="ts">
import AccountVerificationPanel from '~/components/settings/AccountVerificationPanel.vue'
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'
import { useThemePreference } from '~/composables/useThemePreference'

type ThemeMode = 'light' | 'dark' | 'system'
type AppLocale = 'en' | 'de'
type PresenceMode =
  | 'online'
  | 'unavailable'
  | 'offline'
  | 'org.matrix.msc3026.busy'

const { client, userId, logout } = useMatrixClient()
const { locale, setLocale, translateText } = useAppI18n()
const { getThemePreference, setThemePreference } = useThemePreference()

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

const presenceValue = ref<PresenceMode>('online')
const busyPresenceSupported = ref(false)
const presenceFeedback = ref('')

const presenceOptions = computed(() => {
  const options: Array<{ label: string; value: PresenceMode }> = [
    { label: translateText('layout.online'), value: 'online' },
    { label: translateText('layout.away'), value: 'unavailable' },
    { label: translateText('layout.offline'), value: 'offline' }
  ]
  if (busyPresenceSupported.value) {
    options.splice(1, 0, {
      label: translateText('layout.busy'),
      value: 'org.matrix.msc3026.busy'
    })
  }
  return options
})

onMounted(async () => {
  await detectBusyPresenceSupport()
  syncPresenceFromCurrentUser()
})

function handleLogout() {
  logout()
  navigateTo('/login')
}

async function detectBusyPresenceSupport() {
  try {
    const homeserverUrl = client.value?.getHomeserverUrl?.()
    if (!homeserverUrl) {
      return
    }
    const response = await fetch(`${homeserverUrl}/_matrix/client/versions`)
    const versionsData = await response.json()
    busyPresenceSupported.value = Boolean(
      versionsData?.unstable_features?.['org.matrix.msc3026.busy_presence']
    )
  } catch {
    busyPresenceSupported.value = false
  }
}

function syncPresenceFromCurrentUser() {
  const ownUserId = client.value?.getUserId?.()
  if (!ownUserId) {
    return
  }
  const ownUserPresence = client.value?.getUser(ownUserId)?.presence
  if (
    ownUserPresence === 'online' ||
    ownUserPresence === 'offline' ||
    ownUserPresence === 'unavailable' ||
    ownUserPresence === 'org.matrix.msc3026.busy'
  ) {
    presenceValue.value = ownUserPresence
    return
  }
  if (ownUserPresence === 'dnd' && busyPresenceSupported.value) {
    presenceValue.value = 'org.matrix.msc3026.busy'
  }
}

async function applyPresence() {
  if (!client.value) {
    return
  }
  if (
    presenceValue.value === 'org.matrix.msc3026.busy' &&
    !busyPresenceSupported.value
  ) {
    presenceFeedback.value = translateText('settings.busyUnsupported')
    return
  }
  try {
    await client.value.setPresence({
      presence: presenceValue.value as unknown as
        'online' | 'offline' | 'unavailable'
    })
    presenceFeedback.value = translateText('settings.presenceSaved')
  } catch {
    presenceFeedback.value = translateText('auth.signInFailed')
  }
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

        <label class="flex flex-col gap-2 text-sm">
          <span class="font-medium">{{ translateText('settings.presence') }}</span>
          <select
            v-model="presenceValue"
            class="rounded-lg border border-gray-300 bg-white px-3 py-2
                   dark:border-gray-700 dark:bg-gray-900"
          >
            <option
              v-for="presenceOption in presenceOptions"
              :key="presenceOption.value"
              :value="presenceOption.value"
            >
              {{ presenceOption.label }}
            </option>
          </select>
        </label>

        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          @click="applyPresence"
        >
          {{ translateText('settings.applyPresence') }}
        </UButton>
        <p
          v-if="presenceFeedback"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ presenceFeedback }}
        </p>
        <p
          v-if="!busyPresenceSupported"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ translateText('settings.busyUnsupported') }}
        </p>

        <AccountVerificationPanel />
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
