type OptionalRemoteLoggerPayload = {
  sessionId?: string
  runId?: string
  hypothesisId?: string
  location: string
  message: string
  data?: unknown
  timestamp: number
}

type OptionalRemoteLoggerPublicConfig = {
  debugLogIngestUrl?: string
  debugLogSessionId?: string
  debugLogSessionHeader?: string
}

function safeConsoleWarn(payload: OptionalRemoteLoggerPayload) {
  try {
    // Always log locally; never include secrets in `data`.
    console.warn('[DECENTRA_DBG]', payload)
  } catch {
    /* ignore */
  }
}

function getOptionalRemoteLoggerPublicConfig(): OptionalRemoteLoggerPublicConfig {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env

  const envConfig: OptionalRemoteLoggerPublicConfig = {
    debugLogIngestUrl: metaEnv?.NUXT_PUBLIC_DEBUG_LOG_INGEST_URL?.trim(),
    debugLogSessionId: metaEnv?.NUXT_PUBLIC_DEBUG_LOG_SESSION_ID?.trim(),
    debugLogSessionHeader: metaEnv?.NUXT_PUBLIC_DEBUG_LOG_SESSION_HEADER?.trim()
  }

  const nuxtPublicConfig = (
    globalThis as unknown as {
      __NUXT__?: { config?: { public?: OptionalRemoteLoggerPublicConfig } }
    }
  ).__NUXT__?.config?.public

  return { ...envConfig, ...(nuxtPublicConfig ?? {}) }
}

export function logOptionalRemote(payload: OptionalRemoteLoggerPayload) {
  safeConsoleWarn(payload)

  const config = getOptionalRemoteLoggerPublicConfig()
  const ingestUrl = String(config.debugLogIngestUrl ?? '').trim()
  if (!ingestUrl) {
    return
  }

  const sessionId = String(config.debugLogSessionId ?? '').trim()
  const sessionHeader = String(config.debugLogSessionHeader ?? '').trim()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sessionId && sessionHeader) {
    headers[sessionHeader] = sessionId
  }

  fetch(ingestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, sessionId: sessionId || payload.sessionId })
  }).catch(() => {})
}

