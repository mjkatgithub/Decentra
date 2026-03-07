<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useThemePreference } from '~/composables/useThemePreference'

type ThemeMode = 'light' | 'dark' | 'system'
type AppLocale = 'en' | 'de'
type PresenceMode =
  | 'online'
  | 'unavailable'
  | 'offline'
  | 'org.matrix.msc3026.busy'

const OWN_PRESENCE_STORAGE_KEY = 'decentra.presence.preference.v1'

const { client, userId, logout, ensureCryptoReady } = useMatrixClient()
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
const verificationBusy = ref(false)
const verificationStatusText = ref('')
const verificationErrorText = ref('')
const ownDeviceId = ref('')
const ownCrossSigningReady = ref(false)
const sasEmoji = ref<Array<{ symbol: string; name: string }>>([])
const sasDecimal = ref<[number, number, number] | null>(null)
const showSasActions = ref(false)
const pendingVerificationRequest = ref(false)
let activeSasCallbacks: {
  confirm: () => Promise<void>
  mismatch: () => void
  cancel: () => void
} | null = null
let activeVerifier: {
  verify?: () => Promise<void>
  cancel?: (error: Error) => void
  getShowSasCallbacks?: () => {
    sas?: {
      emoji?: Array<[string, string]>
      decimal?: [number, number, number]
    }
    confirm: () => Promise<void>
    mismatch: () => void
    cancel: () => void
  } | null
  on?: (event: string, handler: (...args: any[]) => void) => void
} | null = null
let activeVerificationPromise: Promise<void> | null = null

function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)
    task
      .then((value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      })
  })
}

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
  await refreshVerificationState()
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
    return
  }
  const storedPresence = readStoredPresencePreference()
  if (storedPresence) {
    presenceValue.value = storedPresence
  }
}

function readStoredPresencePreference(): PresenceMode | null {
  if (typeof window === 'undefined') {
    return null
  }
  const rawPresencePreference = window.localStorage.getItem(
    OWN_PRESENCE_STORAGE_KEY
  )
  if (
    rawPresencePreference === 'online' ||
    rawPresencePreference === 'unavailable' ||
    rawPresencePreference === 'offline' ||
    rawPresencePreference === 'org.matrix.msc3026.busy'
  ) {
    return rawPresencePreference
  }
  return null
}

function persistPresencePreference(presence: PresenceMode) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(OWN_PRESENCE_STORAGE_KEY, presence)
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
    const setSyncPresence = (
      client.value as
        | { setSyncPresence?: (presence: 'online' | 'offline' | 'unavailable') => void }
        | null
    )?.setSyncPresence
    if (typeof setSyncPresence === 'function') {
      setSyncPresence(
        presenceValue.value as unknown as 'online' | 'offline' | 'unavailable'
      )
    }
    await client.value.setPresence({
      presence: presenceValue.value as unknown as
        'online' | 'offline' | 'unavailable'
    })
    persistPresencePreference(presenceValue.value)
    presenceFeedback.value = translateText('settings.presenceSaved')
  } catch {
    presenceFeedback.value = translateText('auth.signInFailed')
  }
}

function applySasPayload(showSas: {
  sas?: {
    emoji?: Array<[string, string]>
    decimal?: [number, number, number]
  }
  confirm: () => Promise<void>
  mismatch: () => void
  cancel: () => void
}) {
  const emoji = showSas.sas?.emoji ?? []
  const decimal = showSas.sas?.decimal ?? null
  sasEmoji.value = emoji.map(([symbol, name]) => ({ symbol, name }))
  sasDecimal.value = decimal
  activeSasCallbacks = {
    confirm: showSas.confirm,
    mismatch: showSas.mismatch,
    cancel: showSas.cancel
  }
  showSasActions.value = true
  verificationStatusText.value = translateText('settings.verificationCompare')
}

function clearVerificationUi() {
  sasEmoji.value = []
  sasDecimal.value = null
  showSasActions.value = false
  activeSasCallbacks = null
}

async function refreshVerificationState() {
  const matrixClient = client.value
  const matrixUserId = matrixClient?.getUserId?.()
  const matrixDeviceId = matrixClient?.getDeviceId?.()
  ownDeviceId.value = matrixDeviceId ?? ''
  if (!matrixClient || !matrixUserId || !matrixDeviceId) {
    ownCrossSigningReady.value = false
    verificationStatusText.value = translateText('settings.verificationUnavailable')
    pendingVerificationRequest.value = false
    return
  }
  const cryptoApi = matrixClient.getCrypto?.()
  if (!cryptoApi) {
    const initialized = await withTimeout(
      ensureCryptoReady(),
      10000,
      'Crypto initialization timeout'
    )
    if (!initialized) {
      ownCrossSigningReady.value = false
      verificationStatusText.value = translateText('settings.verificationUnavailable')
      pendingVerificationRequest.value = false
      return
    }
  }
  const activeCryptoApi = matrixClient.getCrypto?.()
  if (!activeCryptoApi) {
    ownCrossSigningReady.value = false
    verificationStatusText.value = translateText('settings.verificationUnavailable')
    pendingVerificationRequest.value = false
    return
  }

  try {
    ownCrossSigningReady.value = await withTimeout(
      activeCryptoApi.isCrossSigningReady(),
      10000,
      'Cross-signing status timeout'
    )
    const verificationStatus = await withTimeout(
      activeCryptoApi.getDeviceVerificationStatus(matrixUserId, matrixDeviceId),
      10000,
      'Device verification status timeout'
    )
    const ownDeviceVerified = verificationStatus?.isVerified() ?? false
    const openRequests = activeCryptoApi.getVerificationRequestsToDeviceInProgress(
      matrixUserId
    )
    pendingVerificationRequest.value = openRequests.some((request: any) => {
      return request.isSelfVerification && request.pending
    })
    verificationStatusText.value = ownDeviceVerified
      ? translateText('settings.verificationVerified')
      : translateText('settings.verificationNotVerified')
  } catch {
    verificationStatusText.value = translateText('settings.verificationFailed')
  }
}

function getSelfVerificationRequest(cryptoApi: any, matrixUserId: string): any {
  const openRequests = cryptoApi.getVerificationRequestsToDeviceInProgress?.(
    matrixUserId
  ) ?? []
  return openRequests.find((request: any) => {
    return request.isSelfVerification && request.pending
  })
}

async function startDeviceVerification() {
  verificationBusy.value = true
  verificationErrorText.value = ''
  clearVerificationUi()
  try {
    const matrixClient = client.value
    const matrixUserId = matrixClient?.getUserId?.()
    if (!matrixClient || !matrixUserId) {
      verificationStatusText.value = translateText('settings.verificationUnavailable')
      return
    }
    const cryptoReady = await withTimeout(
      ensureCryptoReady(),
      10000,
      'Crypto initialization timeout'
    )
    if (!cryptoReady) {
      verificationStatusText.value = translateText('settings.verificationUnavailable')
      verificationErrorText.value = translateText('settings.verificationFailed')
      return
    }
    const cryptoApi = matrixClient.getCrypto?.()
    if (!cryptoApi) {
      verificationStatusText.value = translateText('settings.verificationUnavailable')
      return
    }

    const verificationRequest = getSelfVerificationRequest(cryptoApi, matrixUserId) ??
      await withTimeout(
        cryptoApi.requestOwnUserVerification(),
        10000,
        'Verification request timeout'
      )
    pendingVerificationRequest.value = true
    verificationStatusText.value = translateText('settings.verificationRequestSent')

    if (verificationRequest.phase <= 2 && !verificationRequest.accepting) {
      await verificationRequest.accept()
    }

    const verifier = await withTimeout<any>(
      verificationRequest.startVerification('m.sas.v1'),
      10000,
      'Verification start timeout'
    )
    activeVerifier = verifier
    verifier.on?.('show_sas', (showSas: any) => {
      applySasPayload(showSas)
    })
    verifier.on?.('cancel', () => {
      verificationErrorText.value = translateText('settings.verificationCancelled')
      pendingVerificationRequest.value = false
      clearVerificationUi()
    })

    const currentSasPayload = verifier.getShowSasCallbacks?.()
    if (currentSasPayload) {
      applySasPayload(currentSasPayload)
    }

    verificationStatusText.value = translateText('settings.verificationRequestSent')
    activeVerificationPromise = verifier.verify?.()
      .then(async () => {
        verificationStatusText.value = translateText('settings.verificationCompleted')
        pendingVerificationRequest.value = false
        clearVerificationUi()
        await refreshVerificationState()
      })
      .catch(() => {
        verificationErrorText.value = translateText('settings.verificationFailed')
        pendingVerificationRequest.value = false
        clearVerificationUi()
      })
      .finally(() => {
        verificationBusy.value = false
        activeVerificationPromise = null
      }) ?? null
    verificationBusy.value = false
  } catch {
    verificationErrorText.value = translateText('settings.verificationFailed')
    pendingVerificationRequest.value = false
    clearVerificationUi()
    verificationBusy.value = false
  }
}

async function confirmSasMatch() {
  if (!activeSasCallbacks) {
    return
  }
  verificationBusy.value = true
  verificationErrorText.value = ''
  try {
    await activeSasCallbacks.confirm()
    verificationStatusText.value = translateText('settings.verificationWaiting')
  } catch {
    verificationErrorText.value = translateText('settings.verificationFailed')
  } finally {
    verificationBusy.value = false
  }
}

function markSasMismatch() {
  if (!activeSasCallbacks) {
    return
  }
  activeSasCallbacks.mismatch()
  verificationErrorText.value = translateText('settings.verificationMismatch')
  clearVerificationUi()
}

function cancelVerification() {
  if (activeVerificationPromise) {
    // Mark as user-cancelled; verifier cancellation closes the promise.
    verificationBusy.value = false
  }
  activeSasCallbacks?.cancel()
  activeVerifier?.cancel?.(new Error('Cancelled by user'))
  verificationErrorText.value = translateText('settings.verificationCancelled')
  pendingVerificationRequest.value = false
  clearVerificationUi()
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

        <div class="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <p class="text-sm font-medium">
            {{ translateText('settings.verificationTitle') }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ translateText('settings.verificationDescription') }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ translateText('settings.verificationDeviceId') }}:
            <span class="font-mono">{{ ownDeviceId || '-' }}</span>
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ verificationStatusText }}
          </p>
          <p
            v-if="verificationErrorText"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ verificationErrorText }}
          </p>
          <p
            v-if="pendingVerificationRequest"
            class="text-xs text-amber-600 dark:text-amber-300"
          >
            {{ translateText('settings.verificationPending') }}
          </p>
          <p
            v-if="!ownCrossSigningReady"
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            {{ translateText('settings.verificationCrossSigningHint') }}
          </p>

          <div
            v-if="sasEmoji.length > 0"
            class="grid grid-cols-2 gap-2 rounded-md bg-gray-50 p-2
                   dark:bg-gray-800/50"
          >
            <div
              v-for="emoji in sasEmoji"
              :key="`${emoji.symbol}-${emoji.name}`"
              class="flex items-center gap-2 text-sm"
            >
              <span class="text-lg">{{ emoji.symbol }}</span>
              <span>{{ emoji.name }}</span>
            </div>
          </div>
          <p v-if="sasDecimal" class="text-xs text-gray-500 dark:text-gray-400">
            {{ sasDecimal[0] }} - {{ sasDecimal[1] }} - {{ sasDecimal[2] }}
          </p>

          <div class="flex flex-wrap gap-2">
            <UButton
              size="sm"
              color="primary"
              :loading="verificationBusy"
              @click="startDeviceVerification"
            >
              {{ translateText('settings.verificationStart') }}
            </UButton>
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              :loading="verificationBusy"
              @click="refreshVerificationState"
            >
              {{ translateText('settings.verificationRefresh') }}
            </UButton>
            <UButton
              v-if="showSasActions"
              size="sm"
              color="success"
              :loading="verificationBusy"
              @click="confirmSasMatch"
            >
              {{ translateText('settings.verificationConfirm') }}
            </UButton>
            <UButton
              v-if="showSasActions"
              size="sm"
              color="warning"
              variant="soft"
              @click="markSasMismatch"
            >
              {{ translateText('settings.verificationMismatchAction') }}
            </UButton>
            <UButton
              v-if="pendingVerificationRequest || showSasActions"
              size="sm"
              color="error"
              variant="soft"
              @click="cancelVerification"
            >
              {{ translateText('settings.verificationCancel') }}
            </UButton>
          </div>
        </div>
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
