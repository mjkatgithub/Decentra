import { messages } from '~/composables/i18n/locales'
import type { AppLocale } from '~/composables/i18n/types'

export type { AppLocale } from '~/composables/i18n/types'

const STORAGE_KEY = 'decentra.locale'

const allowedLocales: AppLocale[] = ['en', 'de']
const fallbackStateStore = new Map<string, { value: unknown }>()

function isAppLocale(value: string): value is AppLocale {
  return allowedLocales.includes(value as AppLocale)
}

export function useAppI18n() {
  const locale = getState<AppLocale>('app-locale', () => 'en')
  const initialized = getState<boolean>('app-locale-init', () => false)

  if (import.meta.client && !initialized.value) {
    const savedLocale = window.localStorage.getItem(STORAGE_KEY)
    if (savedLocale && isAppLocale(savedLocale)) {
      locale.value = savedLocale
    }
    initialized.value = true
  }

  function setLocale(nextLocale: AppLocale) {
    locale.value = nextLocale
    if (import.meta.client) {
      window.localStorage.setItem(STORAGE_KEY, nextLocale)
    }
  }

  function translateText(
    key: string,
    placeholders?: Record<string, string>,
  ): string {
    let text =
      messages[locale.value][key] ??
      messages.en[key] ??
      key
    if (placeholders) {
      for (const [ph, value] of Object.entries(placeholders)) {
        text = text.replaceAll(`{${ph}}`, value)
      }
    }
    return text
  }

  return {
    locale,
    setLocale,
    translateText,
    locales: allowedLocales,
  }
}

function getState<T>(
  key: string,
  init: () => T,
): { value: T } {
  if (typeof useState === 'function') {
    return useState<T>(key, init)
  }

  if (!fallbackStateStore.has(key)) {
    fallbackStateStore.set(key, { value: init() })
  }

  return fallbackStateStore.get(key) as { value: T }
}
