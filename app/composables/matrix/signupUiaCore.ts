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


export const SIGNUP_UNAVAILABLE_ERROR = 'SIGNUP_UNAVAILABLE'
/** POST /register closed for normal clients (e.g. matrix.org API policy). */
export const SIGNUP_REGISTER_API_CLOSED_ERROR = 'SIGNUP_REGISTER_API_CLOSED'
export const SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR =
  'SIGNUP_EMAIL_VERIFICATION_REQUIRED'
export const SIGNUP_EMAIL_NOT_CONFIRMED_YET = 'SIGNUP_EMAIL_NOT_CONFIRMED_YET'
export const SIGNUP_PENDING_MISSING = 'SIGNUP_PENDING_MISSING'
export const SIGNUP_SESSION_EXPIRED = 'SIGNUP_SESSION_EXPIRED'
export const SIGNUP_REGISTRATION_UNSUPPORTED_STAGE =
  'SIGNUP_REGISTRATION_UNSUPPORTED_STAGE'
export const SIGNUP_RECAPTCHA_TOKEN_REQUIRED =
  'SIGNUP_RECAPTCHA_TOKEN_REQUIRED'
export const SIGNUP_RECAPTCHA_FAILED = 'SIGNUP_RECAPTCHA_FAILED'
export const SIGNUP_SSO_USE_WEB_CLIENT = 'SIGNUP_SSO_USE_WEB_CLIENT'
export const SIGNUP_MSISDN_NOT_SUPPORTED = 'SIGNUP_MSISDN_NOT_SUPPORTED'
export const SIGNUP_REGISTRATION_TOKEN_REQUIRED =
  'SIGNUP_REGISTRATION_TOKEN_REQUIRED'
export const SIGNUP_REGISTRATION_TOKEN_REJECTED =
  'SIGNUP_REGISTRATION_TOKEN_REJECTED'
export const SIGNUP_TERMS_ACCEPTANCE_REQUIRED =
  'SIGNUP_TERMS_ACCEPTANCE_REQUIRED'

export const SIGNUP_PENDING_STORAGE_KEY = 'decentra.signup.pending.v1'

export const SIGNUP_PENDING_V = 1

/** Matrix ToS links for signup (serializable subset). */
export type SignupTermsPolicyItem = {
  policyId: string
  version: string
  name: string
  url: string
}

export type SignupPendingStateV1 = {
  v: 1
  baseUrl: string
  username: string
  password: string
  email: string
  clientSecret: string
  /** Present after HS issued registration email token sid */
  sid: string
  session: string
  initialSession: string
  flowStages: string[]
  paramsSnapshot?: Record<string, unknown>
  recaptchaSiteKey?: string
  recaptchaVersion?: 'v2' | 'v3'
  /** True while user must solve captcha before email token request */
  needsRecaptchaBeforeEmail?: boolean
  /** True while user must enter registration token before email token */
  needsRegistrationTokenBeforeEmail?: boolean
  /** True until user accepts ToS/policy links */
  needsTermsAcceptanceBeforeEmail?: boolean
  /** Snapshot for terms UI while {@link needsTermsAcceptanceBeforeEmail} */
  termsPoliciesSnapshot?: SignupTermsPolicyItem[]
  /** User-supplied opaque token when required mid-flow */
  registrationTokenDraft?: string
  /** Server `completed` UIA rounds (latest known snapshot) */
  completedStagesSnapshot?: string[]
}

export function createRegisterEmailClientSecret(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `decentra-${Date.now().toString(36)}-` +
    `${Math.random().toString(36).slice(2, 10)}`
}

export const EMAIL_IDENTITY_STAGE = 'm.login.email.identity'
export const DUMMY_STAGE = 'm.login.dummy'
export const RECAPTCHA_STAGE = 'm.login.recaptcha'

export const REGISTRATION_TOKEN_STAGE = 'm.login.registration_token'
export const TERMS_STAGE = 'm.login.terms'
const SSO_STAGE = 'm.login.sso'
const MSISDN_STAGE = 'm.login.msisdn'

interface MatrixUiaData {
  session?: string
  completed?: string[]
  flows?: Array<{ stages?: string[] }>
  params?: Record<string, unknown>
}

export function readMatrixUiaData(error: unknown): MatrixUiaData | null {
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
    completed: data.completed,
    params: data.params
  }
}

/** Synapse/matrix.org-style “register endpoint closed” detection. */
export function throwIfPublicRegisterDisabled(error: unknown): void {
  if (isPublicRegisterEndpointDisabled(error)) {
    throw new Error(SIGNUP_REGISTER_API_CLOSED_ERROR)
  }
}

/** Registration token MSC stage aliases (homeserver-provided literal). */
export function isRegistrationTokenStage(stage: string): boolean {
  if (!stage.trim()) {
    return false
  }
  if (stage === REGISTRATION_TOKEN_STAGE) {
    return true
  }
  const lower = stage.toLowerCase()
  return lower.endsWith('.login.registration_token')
}

/** Terms stage identifiers (usually stable identifier). */
export function isTermsStage(stage: string): boolean {
  if (!stage.trim()) {
    return false
  }
  if (stage === TERMS_STAGE) {
    return true
  }
  return stage.toLowerCase().endsWith('.login.terms')
}

export function isSsoStage(stage: string): boolean {
  if (!stage.trim()) {
    return false
  }
  if (stage === SSO_STAGE) {
    return true
  }
  const lower = stage.toLowerCase()
  return lower.includes('.login.sso') || lower === 'm.login.oauth2'
}

export function isMsisdnStage(stage: string): boolean {
  return stage === MSISDN_STAGE ||
    stage.toLowerCase().endsWith('.login.msisdn')
}

export function isCompleterSupportedUiStage(stage: string): boolean {
  if (stage === EMAIL_IDENTITY_STAGE) {
    return true
  }
  if (
    stage === DUMMY_STAGE ||
    stage === RECAPTCHA_STAGE ||
    isTermsStage(stage) ||
    isRegistrationTokenStage(stage)
  ) {
    return true
  }
  if (isSsoStage(stage) || isMsisdnStage(stage)) {
    return false
  }
  return false
}

/**
 * Finds a signup flow containing email.identity where Decentra can complete
 * every stage (excluding SSO/OIDC phone-only paths).
 */
export function pickCompletableEmailSignupFlow(
  flows: Array<{ stages?: string[] }> | undefined
):
  | { ok: true; stages: string[] }
  | { ok: false; reason: 'no_email' | 'sso_only' | 'msisdn_block' |
      'unsupported' }
{
  if (!Array.isArray(flows)) {
    return { ok: false, reason: 'no_email' }
  }
  const emailFlows = flows
    .map((flowEntry) => flowEntry.stages || [])
    .filter((stages) => stages.includes(EMAIL_IDENTITY_STAGE))
  if (emailFlows.length === 0) {
    return { ok: false, reason: 'no_email' }
  }
  const completable = emailFlows.filter((stageList) =>
    stageList.every((stage) => isCompleterSupportedUiStage(stage))
  )
  if (completable.length > 0) {
    completable.sort(
      (a, b) => a.length - b.length || a.join().localeCompare(b.join())
    )
    return { ok: true, stages: completable[0] as string[] }
  }
  if (emailFlows.every((stageList) => stageList.some(isSsoStage))) {
    return { ok: false, reason: 'sso_only' }
  }
  if (emailFlows.every((stageList) => stageList.some(isMsisdnStage))) {
    return { ok: false, reason: 'msisdn_block' }
  }
  return { ok: false, reason: 'unsupported' }
}

/**
 * Parses Synapse/Matrix UIA params for {@link RECAPTCHA_STAGE}.
 */
export function extractRecaptchaFromParams(
  params: Record<string, unknown> | undefined
): { siteKey: string; version: 'v2' | 'v3' } | null {
  if (!params || typeof params !== 'object') {
    return null
  }
  const blockUnknown = params[RECAPTCHA_STAGE]
  if (!blockUnknown || typeof blockUnknown !== 'object') {
    return null
  }
  const block = blockUnknown as Record<string, unknown>
  const publicKey = block.public_key
  if (typeof publicKey !== 'string' || !publicKey.trim()) {
    return null
  }
  let version: 'v2' | 'v3' = 'v2'
  const rawVersion = block.version
  if (rawVersion === 'v3' || rawVersion === 3) {
    version = 'v3'
  }
  return { siteKey: publicKey.trim(), version }
}

/** Collects docs from `params` for matrix `m.login.terms`. */
export function extractTermsPoliciesFromParams(
  params: Record<string, unknown> | undefined,
  preferredLocales: readonly string[]
): SignupTermsPolicyItem[] {
  if (!params || typeof params !== 'object') {
    return []
  }
  let policiesBlock: Record<string, unknown> | null = null
  const direct = params[TERMS_STAGE]
  if (
    direct &&
    typeof direct === 'object' &&
    !Array.isArray(direct)
  ) {
    policiesBlock =
      extractPoliciesMap(direct as Record<string, unknown>)
  }
  if (!policiesBlock) {
    for (const [, valueUnknown] of Object.entries(params)) {
      if (
        valueUnknown &&
        typeof valueUnknown === 'object' &&
        !Array.isArray(valueUnknown)
      ) {
        const trial = extractPoliciesMap(
          valueUnknown as Record<string, unknown>
        )
        if (trial) {
          policiesBlock = trial
          break
        }
      }
    }
  }
  if (!policiesBlock) {
    return []
  }
  const locales = preferredLocales
    .filter((locale) => typeof locale === 'string' && locale.trim())
    .map((locale) => locale.trim().replace(/_/g, '-'))
  const out: SignupTermsPolicyItem[] = []
  for (const [policyId, defUnknown] of Object.entries(policiesBlock)) {
    if (
      typeof defUnknown !== 'object' ||
      defUnknown === null ||
      Array.isArray(defUnknown)
    ) {
      continue
    }
    const defRecord = defUnknown as Record<string, unknown>
    const version =
      typeof defRecord.version === 'string'
        ? defRecord.version.trim()
        : ''
    let chosenName = ''
    let chosenUrl = ''
    for (const locale of locales) {
      const tryShort = locale.split('-')[0] ?? locale
      const candidates =
        locale === tryShort
          ? [locale]
          : [locale, tryShort].filter(Boolean) as string[]
      for (const cand of candidates) {
        const tr = pickPolicyTranslation(defRecord, cand)
        if (tr) {
          chosenName = tr.name
          chosenUrl = tr.url
          break
        }
      }
      if (chosenUrl) {
        break
      }
    }
    if (!chosenUrl) {
      for (const [, valueMaybe] of Object.entries(defRecord)) {
        if (valueMaybe === version) {
          continue
        }
        if (
          valueMaybe &&
          typeof valueMaybe === 'object' &&
          !Array.isArray(valueMaybe)
        ) {
          const trMaybe = valueMaybe as Record<string, unknown>
          const n = trMaybe.name
          const u = trMaybe.url
          if (typeof u === 'string' && u.trim()) {
            chosenName = typeof n === 'string' && n.trim()
              ? n.trim()
              : policyId
            chosenUrl = u.trim()
            break
          }
        }
      }
    }
    if (chosenUrl) {
      out.push({
        policyId,
        version: version || '—',
        name: chosenName || policyId,
        url: chosenUrl
      })
    }
  }
  return out
}

export function extractPoliciesMap(
  block: Record<string, unknown>
): Record<string, unknown> | null {
  const direct = block.policies
  if (
    direct &&
    typeof direct === 'object' &&
    !Array.isArray(direct)
  ) {
    return direct as Record<string, unknown>
  }
  const keysTop = Object.keys(block)
  if (
    keysTop.some((attributeKey) => attributeKey === 'policies')
  ) {
    return null
  }
  if (keysTop.length > 0) {
    return block
  }
  return null
}

export function pickPolicyTranslation(
  defRecord: Record<string, unknown>,
  localeTag: string
): { name: string; url: string } | null {
  const trUnknown = defRecord[localeTag]
  if (
    trUnknown &&
    typeof trUnknown === 'object' &&
    !Array.isArray(trUnknown)
  ) {
    const trRecord = trUnknown as Record<string, unknown>
    const name = typeof trRecord.name === 'string'
      ? trRecord.name.trim()
      : ''
    const url = typeof trRecord.url === 'string'
      ? trRecord.url.trim()
      : ''
    if (url) {
      return { name: name || localeTag, url }
    }
  }
  const altLocale = localeTag.replace(/-/g, '_')
  if (altLocale !== localeTag) {
    return pickPolicyTranslation(defRecord, altLocale)
  }
  return null
}

export function preferredSignupLocales(): string[] {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return ['en']
  }
  const primary = navigator.language
  const list = navigator.languages?.length
    ? [...navigator.languages]
    : [primary]
  const uniq: string[] = []
  const seenLower = new Set<string>()
  for (const locale of list) {
    const trimmed = locale.trim()
    const low = trimmed.toLowerCase()
    if (trimmed && !seenLower.has(low)) {
      seenLower.add(low)
      uniq.push(trimmed)
    }
  }
  if (!uniq.includes('en')) {
    uniq.push('en')
  }
  return uniq
}

export function signupPendingNeedsRecaptchaBeforeEmail(): boolean {
  const pending = readSignupPending()
  return pending?.needsRecaptchaBeforeEmail === true
}

export function signupPendingNeedsRegistrationTokenBeforeEmail(): boolean {
  const pending = readSignupPending()
  return pending?.needsRegistrationTokenBeforeEmail === true
}

export function signupPendingNeedsTermsBeforeEmail(): boolean {
  const pending = readSignupPending()
  return pending?.needsTermsAcceptanceBeforeEmail === true
}

export function readSignupPendingPublic(): SignupPendingStateV1 | null {
  return readSignupPending()
}

export function hydrateTermsPoliciesForPending(): SignupTermsPolicyItem[] {
  const pending = readSignupPending()
  const params = pending?.paramsSnapshot
  const existing = pending?.termsPoliciesSnapshot
  if (existing?.length) {
    return existing
  }
  return extractTermsPoliciesFromParams(
    params,
    preferredSignupLocales()
  )
}

export function getNextAuthStage(
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

export function mergeParamsIntoPending(
  pending: SignupPendingStateV1,
  params: Record<string, unknown> | undefined
): void {
  if (
    params &&
    typeof params === 'object' &&
    !Array.isArray(params)
  ) {
    pending.paramsSnapshot = {
      ...(pending.paramsSnapshot ?? {}),
      ...params
    }
    const recMeta = extractRecaptchaFromParams(pending.paramsSnapshot)
    if (recMeta) {
      pending.recaptchaSiteKey = recMeta.siteKey
      pending.recaptchaVersion = recMeta.version
    }
  }
}

export function clearSignupBlockingFlags(
  pending: SignupPendingStateV1
): void {
  pending.needsRecaptchaBeforeEmail = false
  pending.needsRegistrationTokenBeforeEmail = false
  pending.needsTermsAcceptanceBeforeEmail = false
}

export function refreshTermsSnapshot(pending: SignupPendingStateV1): void {
  pending.termsPoliciesSnapshot = extractTermsPoliciesFromParams(
    pending.paramsSnapshot,
    preferredSignupLocales()
  )
  writeSignupPending(pending)
}

/**
 * After a successful interim `registerRequest`, decide next blocker or loop.
 */
export async function resumeSignupPipeline(
  pending: SignupPendingStateV1,
  authClient: RegisterAuthClient,
  uia: MatrixUiaData
): Promise<void> {
  clearSignupBlockingFlags(pending)
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
  const completedList = uia.completed || []
  pending.completedStagesSnapshot = [...completedList]
  const nextStageRaw = getNextAuthStage(pending.flowStages, completedList)
  if (!nextStageRaw) {
    throw new Error(SIGNUP_REGISTRATION_UNSUPPORTED_STAGE)
  }
  if (isSsoStage(nextStageRaw)) {
    throw new Error(SIGNUP_SSO_USE_WEB_CLIENT)
  }
  if (isMsisdnStage(nextStageRaw)) {
    throw new Error(SIGNUP_MSISDN_NOT_SUPPORTED)
  }
  writeSignupPending(pending)

  if (isRegistrationTokenStage(nextStageRaw)) {
    pending.needsRegistrationTokenBeforeEmail = true
    writeSignupPending(pending)
    return
  }
  if (isTermsStage(nextStageRaw)) {
    pending.needsTermsAcceptanceBeforeEmail = true
    refreshTermsSnapshot(pending)
    writeSignupPending(pending)
    return
  }
  if (nextStageRaw === RECAPTCHA_STAGE) {
    pending.needsRecaptchaBeforeEmail = true
    writeSignupPending(pending)
    return
  }

  const nextLink = `${window.location.origin}/signup/verify-email`
  if (nextStageRaw === EMAIL_IDENTITY_STAGE && !pending.sid) {
    if (typeof authClient.requestRegisterEmailToken !== 'function') {
      throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
    }
    const tokenSid = await authClient.requestRegisterEmailToken(
      pending.email,
      pending.clientSecret,
      1,
      nextLink
    ) as { sid?: string }
    const sid = tokenSid.sid
    if (!sid) {
      throw new Error(SIGNUP_EMAIL_VERIFICATION_REQUIRED_ERROR)
    }
    pending.sid = sid
    writeSignupPending(pending)
    return
  }

  await runSignupFinalizeLoop(pending, authClient, {
    initialCompleted: completedList,
    initialSession: pending.session
  })
}

export function isEmailNotVerifiedError(error: unknown): boolean {
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

export function isLikelyRegistrationTokenRejected(error: unknown): boolean {
  const code = readMatrixErrorCode(error).toUpperCase()
  const message = readMatrixErrorMessage(error).toLowerCase()
  return (
    code.includes('TOKEN') ||
    message.includes('registration token') ||
    message.includes('invalid token') ||
    message.includes('token is not valid')
  )
}

export function isLikelyTermsRejected(error: unknown): boolean {
  const msg = readMatrixErrorMessage(error).toLowerCase()
  return msg.includes('terms') || msg.includes('policy')
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

export function buildEmailAuthPayload(
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

export function buildDummyAuthPayload(
  sessionId: string
): Record<string, unknown> {
  return {
    type: DUMMY_STAGE,
    session: sessionId
  }
}

export function buildRecaptchaAuthPayload(
  sessionId: string,
  responseToken: string
): Record<string, unknown> {
  return {
    type: RECAPTCHA_STAGE,
    session: sessionId,
    response: responseToken
  }
}

export function buildRegistrationTokenAuthPayload(
  sessionId: string,
  opaqueToken: string,
  matrixStageIdentifier: string
): Record<string, unknown> {
  return {
    type: matrixStageIdentifier,
    session: sessionId,
    token: opaqueToken.trim()
  }
}

export function buildTermsAuthPayload(
  sessionId: string,
  matrixStageIdentifier: string
): Record<string, unknown> {
  return {
    type: matrixStageIdentifier,
    session: sessionId
  }
}

export function isLikelyRecaptchaRejected(error: unknown): boolean {
  const code = readMatrixErrorCode(error).toUpperCase()
  if (code.includes('CAPTCHA')) {
    return true
  }
  const message = readMatrixErrorMessage(error).toLowerCase()
  return (
    message.includes('recaptcha') ||
    message.includes('captcha')
  )
}

export function readSignupPending(): SignupPendingStateV1 | null {
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

export function writeSignupPending(pending: SignupPendingStateV1): void {
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

type FinalizeLoopOptions = {
  recaptchaResponse?: string | null
  registrationTokenOverride?: string | null
  initialCompleted?: string[]
  initialSession?: string | null
}

export async function runSignupFinalizeLoop(
  pendingArg: SignupPendingStateV1,
  authClient: RegisterAuthClient,
  loopOptions?: FinalizeLoopOptions
): Promise<void> {
  const pendingLocal: SignupPendingStateV1 = pendingArg

  let session =
    loopOptions?.initialSession != null &&
      loopOptions.initialSession !== ''
      ? loopOptions.initialSession
      : pendingLocal.session
  let completedList: string[]
  if (loopOptions?.initialCompleted != null) {
    completedList = [...loopOptions.initialCompleted]
  } else {
    completedList = [...(pendingLocal.completedStagesSnapshot ?? [])]
  }
  pendingLocal.completedStagesSnapshot = [...completedList]
  let pendingRecaptchaToken =
    loopOptions?.recaptchaResponse?.trim() ?? ''
  let pendingOpaqueToken =
    loopOptions?.registrationTokenOverride?.trim() ?? ''

  for (let round = 0; round < 12; round++) {
    const nextStage = getNextAuthStage(
      pendingLocal.flowStages,
      completedList
    )
    if (!nextStage) {
      throw new Error('Sign up failed')
    }
    if (isSsoStage(nextStage)) {
      throw new Error(SIGNUP_SSO_USE_WEB_CLIENT)
    }
    if (isMsisdnStage(nextStage)) {
      throw new Error(SIGNUP_MSISDN_NOT_SUPPORTED)
    }
    let authPayload: Record<string, unknown>
    if (nextStage === EMAIL_IDENTITY_STAGE) {
      authPayload = buildEmailAuthPayload(
        authClient,
        pendingLocal,
        session
      )
    } else if (nextStage === DUMMY_STAGE) {
      authPayload = buildDummyAuthPayload(session)
    } else if (nextStage === RECAPTCHA_STAGE) {
      const tokenToSend = pendingRecaptchaToken
      if (!tokenToSend) {
        throw new Error(SIGNUP_RECAPTCHA_TOKEN_REQUIRED)
      }
      pendingRecaptchaToken = ''
      authPayload = buildRecaptchaAuthPayload(session, tokenToSend)
    } else if (isRegistrationTokenStage(nextStage)) {
      const opaque = pendingOpaqueToken.trim() ||
        (pendingLocal.registrationTokenDraft || '').trim()
      if (!opaque) {
        pendingLocal.needsRegistrationTokenBeforeEmail = true
        writeSignupPending(pendingLocal)
        throw new Error(SIGNUP_REGISTRATION_TOKEN_REQUIRED)
      }
      pendingOpaqueToken = ''
      pendingLocal.registrationTokenDraft = opaque
      writeSignupPending(pendingLocal)
      authPayload = buildRegistrationTokenAuthPayload(
        session,
        opaque,
        nextStage
      )
    } else if (isTermsStage(nextStage)) {
      pendingLocal.needsTermsAcceptanceBeforeEmail = true
      refreshTermsSnapshot(pendingLocal)
      writeSignupPending(pendingLocal)
      throw new Error(SIGNUP_TERMS_ACCEPTANCE_REQUIRED)
    } else {
      throw new Error(SIGNUP_REGISTRATION_UNSUPPORTED_STAGE)
    }
    try {
      await authClient.registerRequest({
        username: pendingLocal.username,
        password: pendingLocal.password,
        inhibit_login: true,
        auth: authPayload
      })
      clearSignupPending()
      return
    } catch (error) {
      if (isTransportFailureWithoutMatrixBody(error)) {
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
      if (
        nextStage === RECAPTCHA_STAGE &&
        isLikelyRecaptchaRejected(error)
      ) {
        throw new Error(SIGNUP_RECAPTCHA_FAILED)
      }
      if (
        isRegistrationTokenStage(nextStage) &&
        isLikelyRegistrationTokenRejected(error)
      ) {
        throw new Error(SIGNUP_REGISTRATION_TOKEN_REJECTED)
      }
      if (
        isTermsStage(nextStage) &&
        isLikelyTermsRejected(error)
      ) {
        throw new Error(SIGNUP_TERMS_ACCEPTANCE_REQUIRED)
      }
      const uia = readMatrixUiaData(error)
      if (uia) {
        if (
          round === 0 &&
          nextStage === EMAIL_IDENTITY_STAGE &&
          uia.session &&
          uia.session !== pendingLocal.session &&
          !(uia.completed || []).includes(EMAIL_IDENTITY_STAGE) &&
          !isEmailNotVerifiedError(error)
        ) {
          throw new Error(SIGNUP_SESSION_EXPIRED)
        }
        if (
          round === 0 &&
          nextStage === RECAPTCHA_STAGE &&
          uia.session &&
          uia.session !== pendingLocal.session &&
          !(uia.completed || []).includes(RECAPTCHA_STAGE)
        ) {
          throw new Error(SIGNUP_SESSION_EXPIRED)
        }
        if (
          round === 0 &&
          isRegistrationTokenStage(nextStage) &&
          uia.session &&
          uia.session !== pendingLocal.session &&
          !(uia.completed || []).includes(nextStage)
        ) {
          throw new Error(SIGNUP_SESSION_EXPIRED)
        }
        if (uia.session) {
          session = uia.session
        }
        if (Array.isArray(uia.completed)) {
          completedList = [...(uia.completed as string[])]
        }
        mergeParamsIntoPending(
          pendingLocal,
          uia.params &&
            typeof uia.params === 'object' &&
            !Array.isArray(uia.params)
            ? (uia.params as Record<string, unknown>)
            : undefined
        )
        pendingLocal.completedStagesSnapshot = [...completedList]
        pendingLocal.session = session
        writeSignupPending(pendingLocal)
        continue
      }
      if (
        nextStage === EMAIL_IDENTITY_STAGE &&
        isEmailNotVerifiedError(error)
      ) {
        throw new Error(SIGNUP_EMAIL_NOT_CONFIRMED_YET)
      }
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
  }
  throw new Error('Sign up failed')
}
