/**
 * Loads Google reCAPTCHA v3 client script and executes once for a site key.
 */

type RecaptchaV3Api = {
  ready: (callback: () => void) => void
  execute: (
    siteKey: string,
    options: { action: string }
  ) => Promise<string>
}

function readRecaptchaV3FromWindow(): RecaptchaV3Api | undefined {
  const bridge = window as unknown as {
    grecaptcha?: Record<string, unknown>
  }
  const candidate = bridge.grecaptcha
  const executeCandidate = candidate?.execute
  const readyCandidate = candidate?.ready
  if (
    typeof executeCandidate !== 'function' ||
    typeof readyCandidate !== 'function'
  ) {
    return undefined
  }
  return candidate as unknown as RecaptchaV3Api
}

function scriptSelector(siteKey: string): string {
  return `script[data-decentra-recaptcha-v3="${siteKey}"]`
}

async function ensureRecaptchaV3Script(siteKey: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('recaptcha-v3-no-document')
  }
  const existing = document.querySelector(scriptSelector(siteKey))
  if (existing && readRecaptchaV3FromWindow()?.execute) {
    return
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const scriptElement = document.createElement('script')
    scriptElement.src =
      `https://www.google.com/recaptcha/api.js?render=` +
      `${encodeURIComponent(siteKey)}`
    scriptElement.async = true
    scriptElement.dataset.decentraRecaptchaV3 = siteKey
    scriptElement.onload = () => resolvePromise()
    scriptElement.onerror = () => rejectPromise(new Error('recaptcha-v3-load'))
    document.head.appendChild(scriptElement)
  })
}

export async function executeGoogleRecaptchaV3(
  siteKey: string,
  action: string
): Promise<string> {
  await ensureRecaptchaV3Script(siteKey)
  const client = readRecaptchaV3FromWindow()
  if (!client?.execute || !client.ready) {
    throw new Error('recaptcha-v3-unavailable')
  }
  await new Promise<void>((resolveReady) => {
    client.ready(() => resolveReady())
  })
  return client.execute(siteKey, { action })
}
