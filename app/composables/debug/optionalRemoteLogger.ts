import { useRuntimeConfig } from '#imports'

type OptionalRemoteLoggerPayload = {
  sessionId?: string
  runId?: string
  hypothesisId?: string
  location: string
  message: string
  data?: unknown
  timestamp: number
}

function safeConsoleWarn(payload: OptionalRemoteLoggerPayload) {
  try {
    // Always log locally; never include secrets in `data`.
    console.warn('[DECENTRA_DBG]', payload)
  } catch {
    /* ignore */
  }
}

export function logOptionalRemote(payload: OptionalRemoteLoggerPayload) {
  safeConsoleWarn(payload)

  const runtimePublic = useRuntimeConfig().public as {
    debugLogIngestUrl?: string
    debugLogSessionId?: string
    debugLogSessionHeader?: string
  }

  const ingestUrl = String(runtimePublic.debugLogIngestUrl ?? '').trim()
  if (!ingestUrl) {
    return
  }

  const sessionId = String(runtimePublic.debugLogSessionId ?? '').trim()
  const sessionHeader = String(runtimePublic.debugLogSessionHeader ?? '').trim()

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

