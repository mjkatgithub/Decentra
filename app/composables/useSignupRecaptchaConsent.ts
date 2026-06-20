/**
 * Consent helpers for loading Google reCAPTCHA during signup (GDPR-oriented).
 *
 * Optional iubenda Cookie Solution is injected via `plugins/iubenda.client.ts`.
 * If iubenda IDs are missing, only explicit local consent applies.
 */

import { ref } from 'vue'

export function useSignupRecaptchaConsent() {
  const runtimeConfig = useRuntimeConfig()

  const localConsentGranted = ref(false)

  function iubendaConfigured(): boolean {
    const siteId = String(runtimeConfig.public.iubendaSiteId ?? '').trim()
    const policyId = String(
      runtimeConfig.public.iubendaCookiePolicyId ?? ''
    ).trim()
    return !!(siteId && policyId)
  }

  function privacyPolicyUrl(): string {
    return String(runtimeConfig.public.iubendaPrivacyPolicyUrl ?? '').trim()
  }

  function parsePurposeIds(): number[] {
    const raw = String(
      runtimeConfig.public.iubendaRecaptchaPurposeIds ?? ''
    ).trim()
    if (!raw) {
      return []
    }
    return raw
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value))
  }

  function readIubendaApi(): Record<string, unknown> | null {
    if (typeof window === 'undefined') {
      return null
    }
    const bridge = window as unknown as {
      _iub?: { cs?: { api?: Record<string, unknown> } }
    }
    const api = bridge._iub?.cs?.api
    return api && typeof api === 'object' ? api : null
  }

  /**
   * Best-effort check when purpose IDs are configured in runtime config.
   */
  function hasConfiguredPurposeConsent(): boolean {
    const purposeIds = parsePurposeIds()
    if (purposeIds.length === 0) {
      return false
    }
    const api = readIubendaApi()
    if (!api) {
      return false
    }
    const candidates = [
      api.hasConsentedPurpose,
      api.isPurposeAccepted,
      api.hasConsentForPurpose
    ]
    for (const candidate of candidates) {
      if (typeof candidate !== 'function') {
        continue
      }
      const checker = candidate as (purposeId: number) => boolean
      try {
        if (purposeIds.some((purposeId) => checker.call(api, purposeId))) {
          return true
        }
      } catch {
        continue
      }
    }
    return false
  }

  function canLoadGoogleRecaptcha(): boolean {
    if (localConsentGranted.value) {
      return true
    }
    if (iubendaConfigured() && hasConfiguredPurposeConsent()) {
      return true
    }
    return false
  }

  function grantLocalRecaptchaConsent(): void {
    localConsentGranted.value = true
  }

  function openCookiePreferences(): void {
    const api = readIubendaApi()
    if (!api) {
      return
    }
    const openerCandidates = [
      api.openPreferenceCenter,
      api.openPreferences,
      api.openCmp
    ]
    for (const candidate of openerCandidates) {
      if (typeof candidate === 'function') {
        try {
          ;(candidate as () => void).call(api)
          return
        } catch {
          continue
        }
      }
    }
  }

  return {
    localConsentGranted,
    iubendaConfigured,
    privacyPolicyUrl,
    canLoadGoogleRecaptcha,
    grantLocalRecaptchaConsent,
    openCookiePreferences
  }
}
