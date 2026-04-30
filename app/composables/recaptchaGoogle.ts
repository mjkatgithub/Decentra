/**
 * Loads Google reCAPTCHA v3 client script and executes once for a site key.
 */

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      execute: (
        siteKey: string,
        options: { action: string }
      ) => Promise<string>
    }
  }
}

function scriptSelector(siteKey: string): string {
  return `script[data-decentra-recaptcha-v3="${siteKey}"]`
}

async function ensureRecaptchaV3Script(siteKey: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('recaptcha-v3-no-document')
  }
  const existing = document.querySelector(scriptSelector(siteKey))
  if (existing && window.grecaptcha?.execute) {
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
  const client = window.grecaptcha
  if (!client?.execute || !client.ready) {
    throw new Error('recaptcha-v3-unavailable')
  }
  await new Promise<void>((resolveReady) => {
    client.ready(() => resolveReady())
  })
  return client.execute(siteKey, { action })
}
