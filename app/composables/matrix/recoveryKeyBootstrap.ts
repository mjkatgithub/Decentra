import type { MatrixClient } from 'matrix-js-sdk'
import type { CryptoCallbacks } from 'matrix-js-sdk/lib/crypto-api'
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key'

import type { MatrixApiErrorShape } from './matrixClientShared'
import {
  isLikelyBrowserNetworkOrCorsError,
  readMatrixErrorCode
} from './matrixClientShared'
import { logOptionalRemote } from '../debug/optionalRemoteLogger'

/** Outcome of {@link bootstrapCrossSigningWithRecoveryKeyString}. */
export type RecoveryKeyBootstrapResult =
  | {
      success: true
      crossSigningReady: boolean
    }
  | {
      success: false
      failureReason: RecoveryKeyBootstrapFailureReason
    }

export type RecoveryKeyBootstrapFailureReason =
  | 'invalid_input'
  | 'invalid_key'
  | 'no_client'
  | 'crypto_unavailable'
  | 'ssss_missing'
  | 'uia_required'
  | 'network'
  | 'unknown'

type SecretStorageCallbacksHolder = {
  callbacks: CryptoCallbacks
}

/**
 * Reads the live callback bag used by {@link MatrixClient.secretStorage}.
 * When {@link ICreateClientOpts.cryptoCallbacks} was omitted, the SDK may use
 * a different object than {@link MatrixClient.cryptoCallbacks}; both must be
 * patched for Rust crypto + secret storage to see the recovery key.
 */
function getSecretStorageCallbackBags(
  matrixClient: MatrixClient
): [CryptoCallbacks, CryptoCallbacks] {
  const secretHolder = matrixClient.secretStorage as unknown as
    SecretStorageCallbacksHolder
  const secretCallbacks = secretHolder.callbacks
  const clientCallbacks = matrixClient.cryptoCallbacks
  return [secretCallbacks, clientCallbacks]
}

/**
 * Maps thrown values from bootstrap / network to a stable failure reason.
 * Never include secret material in logs or error strings.
 */
function errorLooksLikeInteractiveAuth(thrownError: unknown): boolean {
  if (!thrownError || typeof thrownError !== 'object') {
    return false
  }
  const shaped = thrownError as MatrixApiErrorShape
  const session = shaped.session ?? shaped.data?.session
  const flows = shaped.flows ?? shaped.data?.flows
  return Boolean(session && Array.isArray(flows) && flows.length > 0)
}

export function mapThrownErrorToRecoveryFailureReason(
  thrownError: unknown
): RecoveryKeyBootstrapFailureReason {
  const message =
    thrownError instanceof Error
      ? thrownError.message
      : String(thrownError)
  const lower = message.toLowerCase()

  if (
    lower.includes('getsecretstoragekey callback returned falsey') ||
    lower.includes('incorrect parity') ||
    lower.includes('incorrect prefix') ||
    lower.includes('incorrect length') ||
    lower.includes('importcrosssigningkeys failed')
  ) {
    return 'invalid_key'
  }

  if (
    lower.includes('interactive authentication') ||
    lower.includes('interactive auth') ||
    errorLooksLikeInteractiveAuth(thrownError)
  ) {
    return 'uia_required'
  }

  const matrixCode = readMatrixErrorCode(thrownError)
  if (matrixCode === 'M_FORBIDDEN' || matrixCode === 'M_UNAUTHORIZED') {
    return 'uia_required'
  }

  if (isLikelyBrowserNetworkOrCorsError(thrownError)) {
    return 'network'
  }

  if (
    thrownError &&
    typeof thrownError === 'object' &&
    'httpStatus' in thrownError &&
    typeof (thrownError as { httpStatus: unknown }).httpStatus === 'number'
  ) {
    const status = (thrownError as { httpStatus: number }).httpStatus
    if (status === 401 || status === 403) {
      return 'uia_required'
    }
  }

  return 'unknown'
}

function installMatchingSecretStorageGetter(
  matrixClient: MatrixClient,
  decodedPrivateKey: Uint8Array
): () => void {
  const [secretCallbacks, clientCallbacks] =
    getSecretStorageCallbackBags(matrixClient)
  const previousSecret = secretCallbacks.getSecretStorageKey
  const previousClient = clientCallbacks.getSecretStorageKey

  const getter: CryptoCallbacks['getSecretStorageKey'] = async (opts) => {
    for (const keyId of Object.keys(opts.keys)) {
      const keyInfo = opts.keys[keyId]
      if (!keyInfo) {
        continue
      }
      const matches = await matrixClient.secretStorage.checkKey(
        decodedPrivateKey,
        keyInfo
      )
      if (matches) {
        return [keyId, decodedPrivateKey]
      }
    }
    return null
  }

  secretCallbacks.getSecretStorageKey = getter
  if (clientCallbacks !== secretCallbacks) {
    clientCallbacks.getSecretStorageKey = getter
  }

  return () => {
    secretCallbacks.getSecretStorageKey = previousSecret
    if (clientCallbacks !== secretCallbacks) {
      clientCallbacks.getSecretStorageKey = previousClient
    }
  }
}

/**
 * Hydrate cross-signing (and optionally the key backup key) from secret
 * storage using the user's recovery / security key.
 *
 * Does not persist the recovery key. Do not log the raw key.
 */
export async function bootstrapCrossSigningWithRecoveryKeyString(
  matrixClient: MatrixClient | null | undefined,
  recoveryKeyRaw: string,
  ensureCryptoReady: () => Promise<boolean>
): Promise<RecoveryKeyBootstrapResult> {
  if (!matrixClient) {
    return { success: false, failureReason: 'no_client' }
  }

  const trimmedKey = recoveryKeyRaw.trim()
  if (!trimmedKey) {
    return { success: false, failureReason: 'invalid_input' }
  }

  let decodedPrivateKey: Uint8Array
  try {
    decodedPrivateKey = decodeRecoveryKey(trimmedKey)
  } catch {
    return { success: false, failureReason: 'invalid_key' }
  }

  const cryptoReady = await ensureCryptoReady()
  if (!cryptoReady) {
    return { success: false, failureReason: 'crypto_unavailable' }
  }

  const cryptoApi = matrixClient.getCrypto?.()
  if (!cryptoApi) {
    return { success: false, failureReason: 'crypto_unavailable' }
  }

  let crossSigningStatusBefore: unknown = null
  try {
    const crossSigningStatus = await cryptoApi.getCrossSigningStatus()
    crossSigningStatusBefore = crossSigningStatus
    const defaultKeyId = await matrixClient.secretStorage.getDefaultKeyId()
    if (
      !crossSigningStatus.privateKeysInSecretStorage ||
      !defaultKeyId
    ) {
      // #region agent log
      logOptionalRemote({
        sessionId: '4f7064',
        hypothesisId: 'H1,H3',
        location: 'recoveryKeyBootstrap.ts:precheck',
        message: 'pre-bootstrap ssss_missing branch',
        data: { crossSigningStatus, defaultKeyId },
        timestamp: Date.now()
      })
      // #endregion
      return { success: false, failureReason: 'ssss_missing' }
    }
  } catch (thrownError) {
    return {
      success: false,
      failureReason: mapThrownErrorToRecoveryFailureReason(thrownError)
    }
  }

  const uninstallGetter = installMatchingSecretStorageGetter(
    matrixClient,
    decodedPrivateKey
  )

  try {
    // #region agent log
    logOptionalRemote({
      sessionId: '4f7064',
      hypothesisId: 'H1,H3',
      location: 'recoveryKeyBootstrap.ts:before-bootstrap',
      message: 'about to call bootstrapCrossSigning',
      data: { crossSigningStatusBefore },
      timestamp: Date.now()
    })
    // #endregion
    await cryptoApi.bootstrapCrossSigning({})
    try {
      await cryptoApi.loadSessionBackupPrivateKeyFromSecretStorage()
    } catch {
      /* optional; backup may be absent */
    }
    const crossSigningReady = await cryptoApi.isCrossSigningReady()
    let crossSigningStatusAfter: unknown = null
    try {
      crossSigningStatusAfter = await cryptoApi.getCrossSigningStatus()
    } catch {
      /* best-effort only for diagnostics */
    }
    let deviceVerifiedAfter: boolean | null = null
    try {
      const matrixUserId = matrixClient.getUserId?.() ?? ''
      const matrixDeviceId = matrixClient.getDeviceId?.() ?? ''
      const status = matrixUserId && matrixDeviceId
        ? await cryptoApi.getDeviceVerificationStatus(
            matrixUserId,
            matrixDeviceId
          )
        : null
      deviceVerifiedAfter = status?.isVerified() ?? null
    } catch {
      /* diagnostics */
    }
    // #region agent log
    logOptionalRemote({
      sessionId: '4f7064',
      hypothesisId: 'H1,H3',
      location: 'recoveryKeyBootstrap.ts:after-bootstrap',
      message: 'bootstrapCrossSigning returned',
      data: {
        crossSigningReady,
        crossSigningStatusBefore,
        crossSigningStatusAfter,
        deviceVerifiedAfter
      },
      timestamp: Date.now()
    })
    // #endregion
    return { success: true, crossSigningReady }
  } catch (thrownError) {
    const failureReason = mapThrownErrorToRecoveryFailureReason(thrownError)
    // #region agent log
    logOptionalRemote({
      sessionId: '4f7064',
      hypothesisId: 'H1,H3,H5',
      location: 'recoveryKeyBootstrap.ts:catch',
      message: 'bootstrapCrossSigning threw',
      data: {
        failureReason,
        errorMessage:
          thrownError instanceof Error ? thrownError.message : String(thrownError)
      },
      timestamp: Date.now()
    })
    // #endregion
    return { success: false, failureReason }
  } finally {
    uninstallGetter()
  }
}
