import type { AppLocale } from '../types'
import en from './en'
import de from './de'

export const messages: Record<AppLocale, Record<string, string>> = {
  en,
  de,
}
