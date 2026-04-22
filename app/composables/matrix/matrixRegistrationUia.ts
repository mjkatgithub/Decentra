import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'

import {
  HOMESERVER_CONNECTION_HINT_ERROR,
  extractUserLocalpart,
  isLikelyBrowserNetworkOrCorsError,
  isSignupUnsupported,
  readMatrixErrorCode,
  readMatrixErrorMessage,
  resolveHomeserverBaseUrlForClient,
  supportsEmailVerificationStage
} from '~/composables/matrix/matrixClientShared'

export const SIGNUP_UNAVAILABLE_ERROR = 'SIGNUP_UNAVAILABLE'
export const SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR =
  'SIGNUP_EMAIL_VERIFICATION_REQUIRED'
export const SIGNUP_EMAIL_NOT_CONFIRMED_YET = 'SIGNUP_EMAIL_NOT_CONFIRMED_YET'
export const SIGNUP_PENDING_MISSING = 'SIGNUP_PENDING_MISSING'
export const SIGNUP_SESSION_EXPIRED = 'SIGNUP_SESSION_EXPIRED'
export const SIGNUP_REGISTRATION_UNSUPPORTED_STAGE =
  'SIGNUP_REGISTRATION_UNSUPPORTED_STAGE'

export const SIGNUP_PENDING_STORAGE_KEY = 'decentra.signup.pending.v1'

const SIGNUP_PENDING_V = 1

type SignupPendingStateV1 = {
  v: 1
  baseUrl: string
  username: string
  password: string
  email: string
  clientSecret: string
  sid: string
  session: string
  initialSession: string
  flowStages: string[]
}

function createRegisterEmailClientSecret(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `decentra-${Date.now().toString(36)}-` +
    `${Math.random().toString(36).slice(2, 10)}`
}

const EMAIL_IDENTITY_STAGE = 'm.login.email.identity'
const DUMMY_STAGE = 'm.login.dummy'

interface MatrixUiaData {
  session?: string
  completed?: string[]
  flows?: Array<{ stages?: string[] }>
}

function readMatrixUiaData(error: unknown): MatrixUiaData | null {
  if (!error || typeof error !== 'object') {
    return null
  }
  const record = error as { data?: MatrixUiaData }
  if (!record.data || typeof record.data !== 'object') {
    return null
  }
  const data = record.data
  if (data.session == null || data.session === '') {
    return null
  }
  return {
    session: data.session,
    flows: data.flows,
    completed: data.completed
  }
}

function pickFlowWithEmail(
  flows: Array<{ stages?: string[] }> | undefined
): string[] | null {
  if (!Array.isArray(flows)) {
    return null
  }
  for (const flow of flows) {
    const stages = flow.stages || []
    if (stages.includes(EMAIL_IDENTITY_STAGE)) {
      return stages
    }
  }
  return null
}

function getNextAuthStage(
  flowStages: string[],
  completed: string[] | undefined
): string | null {
  const done = new Set(completed || [])
  for (const stage of flowStages) {
    if (!done.has(stage)) {
      return stage
    }
  }
  return null
}

function isEmailNotVerifiedError(error: unknown): boolean {
  const code = readMatrixErrorCode(error)
  if (
    code === 'M_UNAUTHORIZED' ||
    code === 'M_THREEPID_AUTH_FAILED' ||
    code === 'M_SESSION_NOT_AUTHORISED'
  ) {
    return true
  }
  const message = readMatrixErrorMessage(error).toLowerCase()
  if (
    message.includes('not verified') ||
    message.includes('not validated') ||
    message.includes('could not be verified') ||
    message.includes('email not verified') ||
    message.includes('3pid not verified') ||
    message.includes('third-party')
  ) {
    return true
  }
  return false
}

type RegisterAuthClient = MatrixClient & {
  registerRequest?: (payload: Record<string, unknown>) => Promise<unknown>
  register?: (
    username: string,
    password: string,
    sessionId: string | undefined,
    auth: Record<string, unknown> | undefined,
    bindThreepids: boolean | undefined,
    guestAccessToken: string | undefined,
    inhibitLogin: boolean
  ) => Promise<unknown>
  requestRegisterEmailToken?: (
    email: string,
    clientSecret: string,
    sendAttempt: number,
    nextLink?: string
  ) => Promise<unknown>
  getIdentityServerUrl?: () => string
}

function buildEmailAuthPayload(
  client: RegisterAuthClient,
  pending: SignupPendingStateV1,
  sessionId: string
): Record<string, unknown> {
  const threepidCreds: Record<string, string> = {
    client_secret: pending.clientSecret,
    sid: pending.sid
  }
  const isUrl = typeof client.getIdentityServerUrl === 'function'
    ? client.getIdentityServerUrl()
    : ''
  if (isUrl) {
    try {
      threepidCreds.id_server = new URL(isUrl).host
    } catch {
      // ignore
    }
  }
  return {
    type: EMAIL_IDENTITY_STAGE,
    threepid_creds: threepidCreds,
    session: sessionId
  }
}

function buildDummyAuthPayload(
  sessionId: string
): Record<string, unknown> {
  return {
    type: DUMMY_STAGE,
    session: sessionId
  }
}

function readSignupPending(): SignupPendingStateV1 | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null
  }
  const raw = window.sessionStorage.getItem(SIGNUP_PENDING_STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as SignupPendingStateV1
    if (parsed.v !== SIGNUP_PENDING_V) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeSignupPending(pending: SignupPendingStateV1): void {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return
  }
  window.sessionStorage.setItem(
    SIGNUP_PENDING_STORAGE_KEY,
    JSON.stringify(pending)
  )
}

export function clearSignupPending(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return
  }
  window.sessionStorage.removeItem(SIGNUP_PENDING_STORAGE_KEY)
}

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
    if (isLikelyBrowserNetworkOrCorsError(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
    const uia = readMatrixUiaData(error)
    if (!uia?.session) {
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
    const flowStages = pickFlowWithEmail(uia.flows)
    if (!flowStages) {
      if (isSignupUnsupported(error)) {
        throw new Error(SIGNUP_UNAVAILABLE_ERROR)
      }
      throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
    }
    if (typeof authClient.requestRegisterEmailToken !== 'function') {
      throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
    }
    const token = await authClient.requestRegisterEmailToken(
      trimmed,
      clientSecret,
      1,
      nextLink
    ) as { sid?: string }
    const sid = token.sid
    if (!sid) {
      throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
    }
    const pending: SignupPendingStateV1 = {
      v: SIGNUP_PENDING_V,
      baseUrl: resolved,
      username: normUser,
      password,
      email: trimmed,
      clientSecret,
      sid,
      session: uia.session,
      initialSession: uia.session,
      flowStages
    }
    writeSignupPending(pending)
  }
}

export async function finalizeEmailRegistration(): Promise<void> {
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
  let session = pending.session
  let completedList: string[] = []
  for (let round = 0; round < 12; round++) {
    const nextStage = getNextAuthStage(
      pending.flowStages,
      completedList
    )
    if (!nextStage) {
      throw new Error('Sign up failed')
    }
    let authPayload: Record<string, unknown>
    if (nextStage === EMAIL_IDENTITY_STAGE) {
      authPayload = buildEmailAuthPayload(
        authClient,
        pending,
        session
      )
    } else if (nextStage === DUMMY_STAGE) {
      authPayload = buildDummyAuthPayload(session)
    } else {
      throw new Error(SIGNUP_REGISTRATION_UNSUPPORTED_STAGE)
    }
    try {
      await authClient.registerRequest({
        username: pending.username,
        password: pending.password,
        inhibit_login: true,
        auth: authPayload
      })
      clearSignupPending()
      return
    } catch (error) {
      if (isLikelyBrowserNetworkOrCorsError(error)) {
        throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
      }
      if (
        nextStage === EMAIL_IDENTITY_STAGE &&
        isEmailNotVerifiedError(error) &&
        !(readMatrixUiaData(error)?.completed || []).includes(
          EMAIL_IDENTITY_STAGE
        )
      ) {
        throw new Error(SIGNUP_EMAIL_NOT_CONFIRMED_YET)
      }
      const uia = readMatrixUiaData(error)
      if (uia) {
        if (
          round === 0 &&
          nextStage === EMAIL_IDENTITY_STAGE &&
          uia.session &&
          uia.session !== pending.session &&
          !(uia.completed || []).includes(EMAIL_IDENTITY_STAGE) &&
          !isEmailNotVerifiedError(error)
        ) {
          throw new Error(SIGNUP_SESSION_EXPIRED)
        }
        if (uia.session) {
          session = uia.session
        }
        if (Array.isArray(uia.completed)) {
          completedList = [...(uia.completed as string[])]
        }
        continue
      }
      if (
        nextStage === EMAIL_IDENTITY_STAGE &&
        isEmailNotVerifiedError(error)
      ) {
        throw new Error(SIGNUP_EMAIL_NOT_CONFIRMED_YET)
      }
      if (isSignupUnsupported(error)) {
        throw new Error(SIGNUP_UNAVAILABLE_ERROR)
      }
      const matrixMessage = readMatrixErrorMessage(error)
      if (matrixMessage) {
        throw new Error(matrixMessage)
      }
      throw error
    }
  }
  throw new Error('Sign up failed')
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
    if (isLikelyBrowserNetworkOrCorsError(error)) {
      throw new Error(HOMESERVER_CONNECTION_HINT_ERROR)
    }
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
