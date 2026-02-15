type ThemePreference = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'decentra.theme.preference'

function isThemePreference(value: string): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function useThemePreference() {
  const colorMode = useColorMode()
  const initialized = useState<boolean>('theme-preference-init', () => false)

  function initializeThemePreference() {
    if (!import.meta.client || initialized.value) {
      return
    }

    const savedPreference = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (savedPreference && isThemePreference(savedPreference)) {
      colorMode.preference = savedPreference
    }
    initialized.value = true
  }

  function setThemePreference(preference: ThemePreference) {
    colorMode.preference = preference
    if (import.meta.client) {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    }
  }

  function getThemePreference(): ThemePreference {
    const preference = colorMode.preference as string
    if (isThemePreference(preference)) {
      return preference
    }
    return 'system'
  }

  return {
    initializeThemePreference,
    setThemePreference,
    getThemePreference
  }
}
