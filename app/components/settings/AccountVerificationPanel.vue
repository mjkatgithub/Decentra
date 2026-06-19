<script setup lang="ts">
import {
  bootstrapCrossSigningWithRecoveryKeyString,
  type RecoveryKeyBootstrapFailureReason
} from '~/composables/matrix/recoveryKeyBootstrap'
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'

/**
 * matrix-js-sdk `VerificationPhase` values (avoid importing sdk subpaths:
 * SSR can 500 pulling crypto modules).
 *
 * @see matrix-js-sdk/src/crypto-api/verification.ts — enum VerificationPhase
 */
const PHASE_REQUESTED = 2 as const
const PHASE_READY = 3 as const
const PHASE_STARTED = 4 as const
const PHASE_CANCELLED = 5 as const
const PHASE_DONE = 6 as const
const METHOD_SAS_V1 = 'm.sas.v1' as const

/** Subset used by device verification helpers (Rust crypto request object). */
type MatrixDeviceVerificationRequest = {
  phase: number
  initiatedByMe: boolean
  accepting: boolean
  pending: boolean
  isSelfVerification: boolean
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void
  accept: () => Promise<void>
  startVerification: (method: string) => Promise<unknown>
}

const {
  client,
  ensureCryptoReady,
  incomingVerificationFromOtherOwnDeviceBeacon,
  consumeIncomingVerificationFromOtherOwnDeviceBeacon
} = useMatrixClient()
const { translateText } = useAppI18n()

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
  on?: (event: string, handler: (...args: unknown[]) => void) => void
} | null = null
let activeVerificationPromise: Promise<void> | null = null

const recoveryKeyInput = ref('')
const recoveryKeyBusy = ref(false)
const recoveryKeyMessageText = ref('')
const recoveryKeyErrorText = ref('')

function translateRecoveryFailureReason(
  failureReason: RecoveryKeyBootstrapFailureReason
): string {
  const keys: Record<RecoveryKeyBootstrapFailureReason, string> = {
    invalid_input: 'settings.verificationRecoveryErrorInvalidInput',
    invalid_key: 'settings.verificationRecoveryErrorInvalidKey',
    no_client: 'settings.verificationUnavailable',
    crypto_unavailable: 'settings.verificationRecoveryErrorCryptoUnavailable',
    ssss_missing: 'settings.verificationRecoveryErrorNoSecretStorage',
    uia_required: 'settings.verificationRecoveryErrorUiaRequired',
    network: 'settings.verificationRecoveryErrorNetwork',
    unknown: 'settings.verificationRecoveryErrorUnknown'
  }
  return translateText(keys[failureReason])
}

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

onMounted(async () => {
  await refreshVerificationState()
  await tryContinueVerificationFromAnotherOwnDevice()
})

async function tryContinueVerificationFromAnotherOwnDevice(): Promise<void> {
  if (!consumeIncomingVerificationFromOtherOwnDeviceBeacon()) {
    return
  }
  await nextTick()
  verificationErrorText.value = ''
  await startDeviceVerification()
}

watch(
  incomingVerificationFromOtherOwnDeviceBeacon,
  async (pendingFromOtherOwnDevice) => {
    if (!pendingFromOtherOwnDevice) {
      return
    }
    await tryContinueVerificationFromAnotherOwnDevice()
  }
)

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
  verificationErrorText.value = ''
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
    const openRequests =
      activeCryptoApi.getVerificationRequestsToDeviceInProgress(matrixUserId)
    pendingVerificationRequest.value = openRequests.some((request) => {
      return request.isSelfVerification && request.pending
    })
    verificationStatusText.value = ownDeviceVerified
      ? translateText('settings.verificationVerified')
      : translateText('settings.verificationNotVerified')
  } catch {
    verificationStatusText.value = translateText('settings.verificationFailed')
  }
}

function getSelfVerificationRequest(
  cryptoApi: unknown,
  matrixUserId: string
): MatrixDeviceVerificationRequest | undefined {
  const cryptoApiWithRequests = cryptoApi as {
    getVerificationRequestsToDeviceInProgress?: (
      userId: string
    ) => unknown[]
  }
  const openRequests =
    (cryptoApiWithRequests.getVerificationRequestsToDeviceInProgress?.(
      matrixUserId
    ) ?? []) as MatrixDeviceVerificationRequest[]
  return openRequests.find((request: MatrixDeviceVerificationRequest) => {
    return request.isSelfVerification && request.pending
  })
}

function verificationPhaseAllowsSasStart(phase: number): boolean {
  return phase === PHASE_READY || phase === PHASE_STARTED
}

function verificationPhaseTerminated(phase: number): boolean {
  return phase === PHASE_CANCELLED || phase === PHASE_DONE
}

/**
 * Wait until the other party has sent `.ready` (Ready) or verification ended.
 */
async function waitVerificationUntilReadyOrEnd(
  verificationRequest: MatrixDeviceVerificationRequest,
  timeoutMs: number
): Promise<'ready' | 'cancelled' | 'timeout'> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const phase = verificationRequest.phase
    if (verificationPhaseAllowsSasStart(phase)) {
      return 'ready'
    }
    if (verificationPhaseTerminated(phase)) {
      return 'cancelled'
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  const phase = verificationRequest.phase
  if (verificationPhaseAllowsSasStart(phase)) {
    return 'ready'
  }
  if (verificationPhaseTerminated(phase)) {
    return 'cancelled'
  }
  return 'timeout'
}

function resolveVerificationThrownMessage(thrownError: unknown): string {
  return thrownError instanceof Error
    ? thrownError.message
    : String(thrownError)
}

async function startDeviceVerification() {
  verificationBusy.value = true
  verificationErrorText.value = ''
  clearVerificationUi()
  try {
    const matrixClient = client.value
    const matrixUserId = matrixClient?.getUserId?.()
    if (!matrixClient || !matrixUserId) {
      verificationStatusText.value = translateText(
        'settings.verificationUnavailable'
      )
      verificationBusy.value = false
      return
    }
    const cryptoReady = await withTimeout(
      ensureCryptoReady(),
      10000,
      'Crypto initialization timeout'
    )
    if (!cryptoReady) {
      verificationStatusText.value = translateText(
        'settings.verificationUnavailable'
      )
      verificationErrorText.value = translateText('settings.verificationFailed')
      verificationBusy.value = false
      return
    }
    const cryptoApi = matrixClient.getCrypto?.()
    if (!cryptoApi) {
      verificationStatusText.value = translateText(
        'settings.verificationUnavailable'
      )
      verificationBusy.value = false
      return
    }

    await matrixClient.downloadKeysForUsers([matrixUserId]).catch(() => {
      /* best-effort */
    })

    const existingIncomingRequest = getSelfVerificationRequest(
      cryptoApi,
      matrixUserId
    )

    const verificationRequest = (
      existingIncomingRequest ??
      (await withTimeout(
        cryptoApi.requestOwnUserVerification(),
        10000,
        'Verification request timeout'
      ))
    ) as MatrixDeviceVerificationRequest
    pendingVerificationRequest.value = true
    verificationStatusText.value = translateText(
      'settings.verificationRequestSent'
    )

    const responderShouldSendReady =
      existingIncomingRequest !== undefined ||
      !verificationRequest.initiatedByMe

    if (
      responderShouldSendReady &&
      verificationRequest.phase === PHASE_REQUESTED &&
      !verificationRequest.accepting
    ) {
      await verificationRequest.accept()
    }

    const waitOutcome = await waitVerificationUntilReadyOrEnd(
      verificationRequest,
      90_000
    )
    if (waitOutcome === 'timeout') {
      verificationErrorText.value = translateText(
        'settings.verificationReadyTimeout'
      )
      pendingVerificationRequest.value = false
      verificationBusy.value = false
      return
    }
    if (waitOutcome === 'cancelled') {
      verificationErrorText.value = translateText(
        'settings.verificationCancelled'
      )
      pendingVerificationRequest.value = false
      verificationBusy.value = false
      return
    }

    const verifier = (await withTimeout(
      verificationRequest.startVerification(METHOD_SAS_V1),
      10000,
      'Verification start timeout'
    )) as {
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      getShowSasCallbacks?: () => Parameters<typeof applySasPayload>[0] | null
      verify?: () => Promise<void>
      cancel?: (error: Error) => void
    }
    activeVerifier = verifier
    verifier.on?.('show_sas', (showSas: unknown) => {
      applySasPayload(showSas as Parameters<typeof applySasPayload>[0])
    })
    verifier.on?.('cancel', () => {
      verificationErrorText.value = translateText(
        'settings.verificationCancelled'
      )
      pendingVerificationRequest.value = false
      clearVerificationUi()
    })

    const currentSasPayload = verifier.getShowSasCallbacks?.()
    if (currentSasPayload) {
      applySasPayload(currentSasPayload)
    }

    verificationStatusText.value = translateText(
      'settings.verificationRequestSent'
    )
    activeVerificationPromise =
      verifier.verify
        ?.()
        .then(async () => {
          verificationStatusText.value = translateText(
            'settings.verificationCompleted'
          )
          pendingVerificationRequest.value = false
          clearVerificationUi()
          await refreshVerificationState()
        })
        .catch(() => {
          verificationErrorText.value = translateText(
            'settings.verificationFailed'
          )
          pendingVerificationRequest.value = false
          clearVerificationUi()
        })
        .finally(() => {
          verificationBusy.value = false
          activeVerificationPromise = null
        }) ?? null
    verificationBusy.value = false
  } catch (thrownError: unknown) {
    const message = resolveVerificationThrownMessage(thrownError)
    if (message.includes('no existing cross-signing key')) {
      verificationErrorText.value = translateText(
        'settings.verificationNeedCrossSigning'
      )
    } else if (message.includes('other device is unknown')) {
      verificationErrorText.value = translateText(
        'settings.verificationUnknownOtherDevice'
      )
    } else if (message.includes('Cannot accept a verification request')) {
      verificationErrorText.value = translateText(
        'settings.verificationProtocolError'
      )
    } else {
      verificationErrorText.value = translateText('settings.verificationFailed')
    }
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
    verificationBusy.value = false
  }
  activeSasCallbacks?.cancel()
  activeVerifier?.cancel?.(new Error('Cancelled by user'))
  verificationErrorText.value = translateText('settings.verificationCancelled')
  pendingVerificationRequest.value = false
  clearVerificationUi()
}

async function submitRecoveryKey() {
  recoveryKeyMessageText.value = ''
  recoveryKeyErrorText.value = ''
  recoveryKeyBusy.value = true
  try {
    const matrixClient = client.value
    const outcome = await bootstrapCrossSigningWithRecoveryKeyString(
      matrixClient,
      recoveryKeyInput.value,
      ensureCryptoReady
    )
    if (outcome.success) {
      recoveryKeyMessageText.value = translateText(
        'settings.verificationRecoverySuccess'
      )
      recoveryKeyInput.value = ''
      await refreshVerificationState()
    } else {
      recoveryKeyErrorText.value = translateRecoveryFailureReason(
        outcome.failureReason
      )
    }
  } finally {
    recoveryKeyBusy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-1">
      <h2 class="text-base font-semibold">
        {{ translateText('settings.verificationPanelTitle') }}
      </h2>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ translateText('settings.verificationPanelIntro') }}
      </p>
    </div>

    <div class="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <p class="text-sm font-medium">
        {{ translateText('settings.verificationEmojiTitle') }}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ translateText('settings.verificationEmojiDescription') }}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ translateText('settings.verificationDeviceId') }}:
        <span class="font-mono">{{ ownDeviceId || '-' }}</span>
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ verificationErrorText ? '' : verificationStatusText }}
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

    <div class="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <p class="text-sm font-medium">
        {{ translateText('settings.verificationRecoveryTitle') }}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ translateText('settings.verificationRecoveryDescription') }}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ translateText('settings.verificationRecoveryHint') }}
      </p>
      <UFormField
        :label="translateText('settings.verificationRecoveryKeyLabel')"
      >
        <AuthMaskedSecretInput
          v-model="recoveryKeyInput"
          secret-kind="recoveryKey"
          multiline
          :rows="3"
          autocomplete="off"
        />
      </UFormField>
      <UButton
        size="sm"
        color="primary"
        :loading="recoveryKeyBusy"
        :disabled="recoveryKeyBusy"
        @click="submitRecoveryKey"
      >
        {{ translateText('settings.verificationRecoverySubmit') }}
      </UButton>
      <p
        v-if="recoveryKeyMessageText"
        class="text-xs text-green-600 dark:text-green-400"
      >
        {{ recoveryKeyMessageText }}
      </p>
      <p
        v-if="recoveryKeyErrorText"
        class="text-xs text-red-600 dark:text-red-400"
      >
        {{ recoveryKeyErrorText }}
      </p>
    </div>
  </div>
</template>
