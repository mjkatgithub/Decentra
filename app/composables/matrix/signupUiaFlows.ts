import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'

import {
  HOMESERVER_CONNECTION_HINT_ERROR,
  extractUserLocalpart,
  isTransportFailureWithoutMatrixBody,
  isPublicRegisterEndpointDisabled,
  isSignupUnsupported,
  readMatrixErrorCode,
  readMatrixErrorMessage,
  resolveHomeserverBaseUrlForClient,
  supportsEmailVerificationStage
} from '~/composables/matrix/matrixClientShared'

import {
  buildRecaptchaAuthPayload,
  buildRegistrationTokenAuthPayload,
  buildTermsAuthPayload,
  clearSignupPending,
  createRegisterEmailClientSecret,
  getNextAuthStage,
  isLikelyRecaptchaRejected,
  isLikelyRegistrationTokenRejected,
  isLikelyTermsRejected,
  isMsisdnStage,
  isRegistrationTokenStage,
  isSsoStage,
  isTermsStage,
  mergeParamsIntoPending,
  pickCompletableEmailSignupFlow,
  readMatrixUiaData,
  readSignupPending,
  refreshTermsSnapshot,
  REGISTRATION_TOKEN_STAGE,
  resumeSignupPipeline,
  runSignupFinalizeLoop,
  RECAPTCHA_STAGE,
  DUMMY_STAGE,
  SIGNUP_EMAIL_NOT_CONFIRMED_YET,
  SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR,
  SIGNUP_MSISDN_NOT_SUPPORTED,
  SIGNUP_PENDING_MISSING,
  SIGNUP_PENDING_V,
  SIGNUP_RECAPTCHA_FAILED,
  SIGNUP_RECAPTCHA_TOKEN_REQUIRED,
  SIGNUP_REGISTER_API_CLOSED_ERROR,
  SIGNUP_REGISTRATION_TOKEN_REJECTED,
  SIGNUP_REGISTRATION_TOKEN_REQUIRED,
  SIGNUP_REGISTRATION_UNSUPPORTED_STAGE,
  SIGNUP_SESSION_EXPIRED,
  SIGNUP_SSO_USE_WEB_CLIENT,
  SIGNUP_TERMS_ACCEPTANCE_REQUIRED,
  SIGNUP_UNAVAILABLE_ERROR,
  throwIfPublicRegisterDisabled,
  writeSignupPending,
  extractRecaptchaFromParams,
  type RegisterAuthClient,
  type SignupPendingStateV1,
} from './signupUiaCore'


export async function startEmailRegistration(
  baseUrl: string,
  username: string,
  password: string,
  email: string
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error(SIGNUP_PENDING_MISSING)
  }
  const resolved = resolveHomeserverBaseUrlForClient(baseUrl)
  const authClient = sdk.createClient({
    baseUrl: resolved
  }) as RegisterAuthClient
  const normUser = extractUserLocalpart(username)
  const trimmed = email.trim()
  if (!trimmed) {
    throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
  }
  const nextLink = `${window.location.origin}/signup/verify-email`
  const clientSecret = createRegisterEmailClientSecret()
  try {
    if (typeof authClient.registerRequest === 'function') {
      await authClient.registerRequest({
        username: normUser,
        password,
        inhibit_login: true
      })
    } else if (typeof authClient.register === 'function') {
      await authClient.register(
        normUser,
        password,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      )
    } else {
      throw new Error(SIGNUP_UNAVAILABLE_ERROR)
    }
    clearSignupPending()
    return
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    const uia = readMatrixUiaData(error)
    if (!uia || !uia.session) {
      throwIfPublicRegisterDisabled(error)
      if (isSignupUnsupported(error)) {
        throw new Error(SIGNUP_UNAVAILABLE_ERROR)
      }
      const requiresEmail = supportsEmailVerificationStage(error)
      const matrixErrorMessage = readMatrixErrorMessage(error)
      const hasSdkEmailHttpError = (
        trimmed &&
        matrixErrorMessage.includes("reading 'http'")
      )
      if (trimmed && (requiresEmail || hasSdkEmailHttpError)) {
        if (typeof authClient.requestRegisterEmailToken === 'function') {
          await authClient.requestRegisterEmailToken(
            trimmed,
            clientSecret,
            1,
            nextLink
          )
        }
        throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
      }
      if (matrixErrorMessage) {
        throw new Error(matrixErrorMessage)
      }
      throw error
    }
    const signupUiaSnapshot = uia
    const picked = pickCompletableEmailSignupFlow(signupUiaSnapshot.flows)
    if (!picked.ok) {
      throwIfPublicRegisterDisabled(error)
      if (isSignupUnsupported(error)) {
        throw new Error(SIGNUP_UNAVAILABLE_ERROR)
      }
      if (picked.reason === 'sso_only') {
        throw new Error(SIGNUP_SSO_USE_WEB_CLIENT)
      }
      if (picked.reason === 'msisdn_block') {
        throw new Error(SIGNUP_MSISDN_NOT_SUPPORTED)
      }
      if (picked.reason === 'unsupported') {
        throw new Error(SIGNUP_REGISTRATION_UNSUPPORTED_STAGE)
      }
      throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
    }
    const flowStages = picked.stages
    const paramsRaw = signupUiaSnapshot.params
    const params: Record<string, unknown> =
      paramsRaw &&
      typeof paramsRaw === 'object' &&
      !Array.isArray(paramsRaw)
        ? (paramsRaw as Record<string, unknown>)
        : {}
    const completedInitial = signupUiaSnapshot.completed || []
    const firstStageRaw = getNextAuthStage(flowStages, completedInitial)
    const recMeta = extractRecaptchaFromParams(params)

    function buildBasePending(part: Partial<SignupPendingStateV1>):
      SignupPendingStateV1 {
      return {
        v: SIGNUP_PENDING_V,
        baseUrl: resolved,
        username: normUser,
        password,
        email: trimmed,
        clientSecret,
        sid: '',
        session: signupUiaSnapshot.session ?? '',
        initialSession: signupUiaSnapshot.session ?? '',
        flowStages,
        paramsSnapshot: Object.keys(params).length > 0 ? params : undefined,
        recaptchaSiteKey: recMeta?.siteKey,
        recaptchaVersion: recMeta?.version ?? 'v2',
        completedStagesSnapshot: [...completedInitial],
        ...part
      }
    }

    if (!firstStageRaw) {
      throw new Error(SIGNUP_REGISTRATION_UNSUPPORTED_STAGE)
    }
    if (isSsoStage(firstStageRaw)) {
      throw new Error(SIGNUP_SSO_USE_WEB_CLIENT)
    }
    if (isMsisdnStage(firstStageRaw)) {
      throw new Error(SIGNUP_MSISDN_NOT_SUPPORTED)
    }
    if (isRegistrationTokenStage(firstStageRaw)) {
      const pendingToken: SignupPendingStateV1 =
        buildBasePending({ needsRegistrationTokenBeforeEmail: true })
      writeSignupPending(pendingToken)
      return
    }
    if (isTermsStage(firstStageRaw)) {
      const pendingTerms = buildBasePending({
        needsTermsAcceptanceBeforeEmail: true
      })
      writeSignupPending(pendingTerms)
      refreshTermsSnapshot(pendingTerms)
      writeSignupPending(pendingTerms)
      return
    }
    if (firstStageRaw === RECAPTCHA_STAGE) {
      writeSignupPending(
        buildBasePending({
          needsRecaptchaBeforeEmail: true
        })
      )
      return
    }

    if (typeof authClient.requestRegisterEmailToken !== 'function') {
      throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
    }
    const sidResponse = await authClient.requestRegisterEmailToken(
      trimmed,
      clientSecret,
      1,
      nextLink
    ) as { sid?: string }
    const sid = sidResponse.sid
    if (!sid) {
      throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
    }
    const pendingRegular: SignupPendingStateV1 = buildBasePending({
      sid,
      needsRecaptchaBeforeEmail: false
    })
    writeSignupPending(pendingRegular)
  }
}


export async function submitSignupRecaptcha(
  response: string
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error(SIGNUP_PENDING_MISSING)
  }
  const trimmedResponse = response.trim()
  if (!trimmedResponse) {
    throw new Error(SIGNUP_RECAPTCHA_FAILED)
  }
  const pending = readSignupPending()
  if (!pending) {
    throw new Error(SIGNUP_PENDING_MISSING)
  }
  if (!pending.needsRecaptchaBeforeEmail) {
    throw new Error(SIGNUP_RECAPTCHA_FAILED)
  }
  const authClient = sdk.createClient({
    baseUrl: resolveHomeserverBaseUrlForClient(pending.baseUrl)
  }) as RegisterAuthClient
  if (typeof authClient.registerRequest !== 'function') {
    throw new Error(SIGNUP_UNAVAILABLE_ERROR)
  }
  try {
    await authClient.registerRequest({
      username: pending.username,
      password: pending.password,
      inhibit_login: true,
      auth: buildRecaptchaAuthPayload(pending.session, trimmedResponse)
    })
    clearSignupPending()
    return
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    if (isLikelyRecaptchaRejected(error)) {
      throw new Error(SIGNUP_RECAPTCHA_FAILED)
    }
    const uia = readMatrixUiaData(error)
    if (!uia) {
      throwIfPublicRegisterDisabled(error)
      if (isSignupUnsupported(error)) {
        throw new Error(SIGNUP_UNAVAILABLE_ERROR)
      }
      const matrixMessage = readMatrixErrorMessage(error)
      if (matrixMessage) {
        throw new Error(matrixMessage)
      }
      throw error
    }
    if (uia.session) {
      pending.session = uia.session
    }
    mergeParamsIntoPending(
      pending,
      uia.params &&
        typeof uia.params === 'object' &&
        !Array.isArray(uia.params)
        ? (uia.params as Record<string, unknown>)
        : undefined
    )
    await resumeSignupPipeline(pending, authClient, uia)
  }
}

export async function submitSignupRegistrationToken(
  opaqueToken: string
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error(SIGNUP_PENDING_MISSING)
  }
  const trimmed = opaqueToken.trim()
  if (!trimmed) {
    throw new Error(SIGNUP_REGISTRATION_TOKEN_REQUIRED)
  }
  const pendingSnapshot = readSignupPending()
  if (!pendingSnapshot) {
    throw new Error(SIGNUP_PENDING_MISSING)
  }
  const snapshotTok = pendingSnapshot.completedStagesSnapshot ?? []
  const litTok = getNextAuthStage(pendingSnapshot.flowStages, snapshotTok)
  const awaitingTokenUx =
    pendingSnapshot.needsRegistrationTokenBeforeEmail === true ||
    isRegistrationTokenStage(litTok ?? '')
  if (!awaitingTokenUx) {
    throw new Error(SIGNUP_REGISTRATION_TOKEN_REJECTED)
  }
  pendingSnapshot.registrationTokenDraft = trimmed
  writeSignupPending(pendingSnapshot)
  const authClient = sdk.createClient({
    baseUrl: resolveHomeserverBaseUrlForClient(pendingSnapshot.baseUrl)
  }) as RegisterAuthClient
  if (typeof authClient.registerRequest !== 'function') {
    throw new Error(SIGNUP_UNAVAILABLE_ERROR)
  }

  const nextStageLit = litTok
  const registrationStageId =
    typeof nextStageLit === 'string' &&
      isRegistrationTokenStage(nextStageLit)
      ? nextStageLit
      : REGISTRATION_TOKEN_STAGE

  try {
    await authClient.registerRequest({
      username: pendingSnapshot.username,
      password: pendingSnapshot.password,
      inhibit_login: true,
      auth: buildRegistrationTokenAuthPayload(
        pendingSnapshot.session,
        trimmed,
        registrationStageId
      )
    })
    clearSignupPending()
    return
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    if (isLikelyRegistrationTokenRejected(error)) {
      throw new Error(SIGNUP_REGISTRATION_TOKEN_REJECTED)
    }
    const uia = readMatrixUiaData(error)
    if (!uia) {
      throwIfPublicRegisterDisabled(error)
      if (isSignupUnsupported(error)) {
        throw new Error(SIGNUP_UNAVAILABLE_ERROR)
      }
      const matrixMessage = readMatrixErrorMessage(error)
      if (matrixMessage) {
        throw new Error(matrixMessage)
      }
      throw error
    }
    if (uia.session) {
      pendingSnapshot.session = uia.session
    }
    mergeParamsIntoPending(
      pendingSnapshot,
      uia.params &&
        typeof uia.params === 'object' &&
        !Array.isArray(uia.params)
        ? (uia.params as Record<string, unknown>)
        : undefined
    )
    await resumeSignupPipeline(pendingSnapshot, authClient, uia)
  }
}

export async function submitSignupTermsAcceptance(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error(SIGNUP_PENDING_MISSING)
  }
  const pending = readSignupPending()
  if (!pending) {
    throw new Error(SIGNUP_PENDING_MISSING)
  }
  const snapshotTerms = pending.completedStagesSnapshot ?? []
  const litTerms = getNextAuthStage(pending.flowStages, snapshotTerms)
  const awaitingTermsUx =
    pending.needsTermsAcceptanceBeforeEmail === true ||
    isTermsStage(litTerms ?? '')
  if (!awaitingTermsUx) {
    throw new Error(SIGNUP_TERMS_ACCEPTANCE_REQUIRED)
  }
  const authClient = sdk.createClient({
    baseUrl: resolveHomeserverBaseUrlForClient(pending.baseUrl)
  }) as RegisterAuthClient
  if (typeof authClient.registerRequest !== 'function') {
    throw new Error(SIGNUP_UNAVAILABLE_ERROR)
  }

  const nextLit = getNextAuthStage(
    pending.flowStages,
    snapshotTerms
  )
  const stageType =
    typeof nextLit === 'string' &&
      isTermsStage(nextLit)
      ? nextLit
      : TERMS_STAGE

  try {
    await authClient.registerRequest({
      username: pending.username,
      password: pending.password,
      inhibit_login: true,
      auth: buildTermsAuthPayload(pending.session, stageType)
    })
    clearSignupPending()
    return
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    if (isLikelyTermsRejected(error)) {
      throw new Error(SIGNUP_TERMS_ACCEPTANCE_REQUIRED)
    }
    const uia = readMatrixUiaData(error)
    if (!uia) {
      throwIfPublicRegisterDisabled(error)
      if (isSignupUnsupported(error)) {
        throw new Error(SIGNUP_UNAVAILABLE_ERROR)
      }
      const matrixMessage = readMatrixErrorMessage(error)
      if (matrixMessage) {
        throw new Error(matrixMessage)
      }
      throw error
    }
    if (uia.session) {
      pending.session = uia.session
    }
    mergeParamsIntoPending(
      pending,
      uia.params &&
        typeof uia.params === 'object' &&
        !Array.isArray(uia.params)
        ? (uia.params as Record<string, unknown>)
        : undefined
    )
    await resumeSignupPipeline(pending, authClient, uia)
  }
}

export async function finalizeEmailRegistration(
  options?: {
    recaptchaResponse?: string | null
    registrationToken?: string | null
  }
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error(SIGNUP_PENDING_MISSING)
  }
  const pending = readSignupPending()
  if (!pending) {
    throw new Error(SIGNUP_PENDING_MISSING)
  }
  const authClient = sdk.createClient({
    baseUrl: resolveHomeserverBaseUrlForClient(pending.baseUrl)
  }) as RegisterAuthClient
  if (typeof authClient.registerRequest !== 'function') {
    throw new Error(SIGNUP_UNAVAILABLE_ERROR)
  }

  await runSignupFinalizeLoop(pending, authClient, {
    recaptchaResponse: options?.recaptchaResponse,
    registrationTokenOverride: options?.registrationToken
  })
}

/**
 * “Open” / dummy homeserver public registration (no 3pid).
 */
export async function registerWithDummy(
  baseUrl: string,
  username: string,
  password: string
): Promise<void> {
  const resolvedBaseUrl = resolveHomeserverBaseUrlForClient(baseUrl)
  const authClient = sdk.createClient({ baseUrl: resolvedBaseUrl })
  const normalizedUsername = extractUserLocalpart(username)
  const authApiClient = authClient as RegisterAuthClient
  try {
    if (typeof authApiClient.registerRequest === 'function') {
      const registerPayload: Record<string, unknown> = {
        username: normalizedUsername,
        password,
        auth: { type: DUMMY_STAGE },
        inhibit_login: true
      }
      await authApiClient.registerRequest(registerPayload)
      return
    }
    if (typeof authApiClient.register === 'function') {
      await authApiClient.register(
        normalizedUsername,
        password,
        undefined,
        { type: DUMMY_STAGE },
        undefined,
        undefined,
        true
      )
      return
    }
    throw new Error(SIGNUP_UNAVAILABLE_ERROR)
  } catch (error) {
    if (isTransportFailureWithoutMatrixBody(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    throwIfPublicRegisterDisabled(error)
    if (isSignupUnsupported(error)) {
      throw new Error(SIGNUP_UNAVAILABLE_ERROR)
    }
    const matrixErrorMessage = readMatrixErrorMessage(error)
    if (matrixErrorMessage) {
      throw new Error(matrixErrorMessage)
    }
    throw new Error('Sign up failed')
  }
}

