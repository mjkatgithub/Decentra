type AppLocale = 'en' | 'de'

const STORAGE_KEY = 'decentra.locale'

const messages: Record<AppLocale, Record<string, string>> = {
  en: {
    'auth.signIn': 'Sign in',
    'auth.homeserver': 'Homeserver',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.signInFailed': 'Sign in failed',
    'chat.loggedInAs': 'Signed in as',
    'chat.signOut': 'Sign out',
    'chat.selectRoom': 'Select a room',
    'chat.loadOlder': 'Load older messages',
    'chat.noMessages': 'No messages yet. Start the conversation.',
    'chat.sendMessage': 'Send',
    'chat.messagePlaceholder': 'Write a message...',
    'chat.noRooms': 'No rooms',
    'layout.spaces': 'Spaces',
    'layout.channels': 'Channels',
    'layout.members': 'Members',
    'layout.noMembers': 'No members found',
    'layout.noSpaces': 'No spaces available',
    'layout.noRoomsInSpace': 'No channels in this space',
    'layout.generalCategory': 'General',
    'layout.roomFallback': 'Unnamed room',
    'layout.spaceFallback': 'Unnamed space',
    'layout.homeSpace': 'Home',
    'layout.personalChats': 'Personal chats',
    'layout.unassignedRooms': 'Unassigned rooms',
    'layout.toggleNavigation': 'Toggle navigation',
    'layout.toggleMembers': 'Toggle members',
    'layout.expandSpaces': 'Expand spaces',
    'layout.collapseSpaces': 'Collapse spaces',
    'layout.openAccountSettings': 'Account settings',
    'layout.openSpaceSettings': 'Space settings',
    'layout.createSpace': 'Create space',
    'layout.online': 'Online',
    'layout.away': 'Away',
    'layout.busy': 'Do not disturb',
    'layout.offline': 'Offline',
    'layout.unknown': 'Unknown',
    'settings.accountTitle': 'Account settings',
    'settings.accountDescription': 'Manage your profile preferences.',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.presence': 'Presence',
    'settings.applyPresence': 'Apply presence',
    'settings.presenceSaved': 'Presence updated',
    'settings.busyUnsupported': 'Busy presence is not supported by this homeserver',
    'settings.verificationTitle': 'Device verification',
    'settings.verificationDescription': 'Verify this session with another client of the same account.',
    'settings.verificationDeviceId': 'Device ID',
    'settings.verificationStart': 'Start verification',
    'settings.verificationRefresh': 'Refresh status',
    'settings.verificationConfirm': 'Emojis match',
    'settings.verificationMismatchAction': 'Emojis differ',
    'settings.verificationCancel': 'Cancel verification',
    'settings.verificationPending': 'Verification request is pending on your other client.',
    'settings.verificationRequestSent': 'Verification request sent. Continue on your other client.',
    'settings.verificationCompare': 'Compare the emojis with your other client and confirm.',
    'settings.verificationWaiting': 'Waiting for the other client to finish verification.',
    'settings.verificationCompleted': 'Verification finished successfully.',
    'settings.verificationVerified': 'This device is verified.',
    'settings.verificationNotVerified': 'This device is not verified yet.',
    'settings.verificationUnavailable': 'Verification is not available for this session.',
    'settings.verificationFailed': 'Verification failed. Please try again.',
    'settings.verificationMismatch': 'Verification cancelled because emojis did not match.',
    'settings.verificationCancelled': 'Verification was cancelled.',
    'settings.verificationCrossSigningHint': 'Cross-signing might need setup on your other client first.',
    'settings.backToChat': 'Back to chat',
    'settings.spaceTitle': 'Space settings',
    'settings.spaceDescription': 'Basic settings for this space.',
    'settings.spaceId': 'Space ID',
    'settings.spaceName': 'Space name',
    'settings.save': 'Save',
    'settings.saved': 'Settings saved locally',
    'settings.account': 'Account',
    'settings.space': 'Space',
    'spaces.newTitle': 'Create space',
    'spaces.newDescription': 'This is a Phase 2 stub screen.',
    'spaces.name': 'Space name',
    'spaces.createStub': 'Create (stub)',
    'spaces.stubInfo': 'Real server-side creation will follow in a later step.',
    'common.loading': 'Loading...'
  },
  de: {
    'auth.signIn': 'Anmelden',
    'auth.homeserver': 'Homeserver',
    'auth.username': 'Benutzername',
    'auth.password': 'Passwort',
    'auth.signInFailed': 'Anmeldung fehlgeschlagen',
    'chat.loggedInAs': 'Eingeloggt als',
    'chat.signOut': 'Abmelden',
    'chat.selectRoom': 'Wähle einen Raum',
    'chat.loadOlder': 'Ältere Nachrichten laden',
    'chat.noMessages': 'Keine Nachrichten. Starte die Unterhaltung!',
    'chat.sendMessage': 'Senden',
    'chat.messagePlaceholder': 'Nachricht eingeben...',
    'chat.noRooms': 'Keine Räume',
    'layout.spaces': 'Spaces',
    'layout.channels': 'Kanäle',
    'layout.members': 'Mitglieder',
    'layout.noMembers': 'Keine Mitglieder gefunden',
    'layout.noSpaces': 'Keine Spaces verfügbar',
    'layout.noRoomsInSpace': 'Keine Kanäle in diesem Space',
    'layout.generalCategory': 'Allgemein',
    'layout.roomFallback': 'Unbenannter Raum',
    'layout.spaceFallback': 'Unbenannter Space',
    'layout.homeSpace': 'Start',
    'layout.personalChats': 'Persoenliche Chats',
    'layout.unassignedRooms': 'Nicht zugeordnete Raeume',
    'layout.toggleNavigation': 'Navigation umschalten',
    'layout.toggleMembers': 'Mitglieder umschalten',
    'layout.expandSpaces': 'Spaces erweitern',
    'layout.collapseSpaces': 'Spaces einklappen',
    'layout.openAccountSettings': 'Account-Einstellungen',
    'layout.openSpaceSettings': 'Space-Einstellungen',
    'layout.createSpace': 'Space erstellen',
    'layout.online': 'Online',
    'layout.away': 'Abwesend',
    'layout.busy': 'Bitte nicht stoeren',
    'layout.offline': 'Offline',
    'layout.unknown': 'Unbekannt',
    'settings.accountTitle': 'Account-Einstellungen',
    'settings.accountDescription': 'Verwalte deine Profil-Einstellungen.',
    'settings.theme': 'Theme',
    'settings.language': 'Sprache',
    'settings.presence': 'Status',
    'settings.applyPresence': 'Status setzen',
    'settings.presenceSaved': 'Status aktualisiert',
    'settings.busyUnsupported': 'Busy-Status wird vom Homeserver nicht unterstuetzt',
    'settings.verificationTitle': 'Geraet verifizieren',
    'settings.verificationDescription': 'Verifiziere diese Session mit einem anderen Client desselben Accounts.',
    'settings.verificationDeviceId': 'Geraete-ID',
    'settings.verificationStart': 'Verifizierung starten',
    'settings.verificationRefresh': 'Status aktualisieren',
    'settings.verificationConfirm': 'Emojis stimmen ueberein',
    'settings.verificationMismatchAction': 'Emojis unterscheiden sich',
    'settings.verificationCancel': 'Verifizierung abbrechen',
    'settings.verificationPending': 'Verifizierungsanfrage wartet auf dem anderen Client.',
    'settings.verificationRequestSent': 'Verifizierungsanfrage gesendet. Auf dem anderen Client fortsetzen.',
    'settings.verificationCompare': 'Vergleiche die Emojis mit dem anderen Client und bestaetige.',
    'settings.verificationWaiting': 'Warte auf Abschluss im anderen Client.',
    'settings.verificationCompleted': 'Verifizierung erfolgreich abgeschlossen.',
    'settings.verificationVerified': 'Dieses Geraet ist verifiziert.',
    'settings.verificationNotVerified': 'Dieses Geraet ist noch nicht verifiziert.',
    'settings.verificationUnavailable': 'Verifizierung ist fuer diese Session nicht verfuegbar.',
    'settings.verificationFailed': 'Verifizierung fehlgeschlagen. Bitte erneut versuchen.',
    'settings.verificationMismatch': 'Verifizierung abgebrochen, weil Emojis nicht uebereinstimmen.',
    'settings.verificationCancelled': 'Verifizierung wurde abgebrochen.',
    'settings.verificationCrossSigningHint': 'Cross-Signing muss eventuell zuerst im anderen Client eingerichtet werden.',
    'settings.backToChat': 'Zurück zum Chat',
    'settings.spaceTitle': 'Space-Einstellungen',
    'settings.spaceDescription': 'Basis-Einstellungen für diesen Space.',
    'settings.spaceId': 'Space-ID',
    'settings.spaceName': 'Space-Name',
    'settings.save': 'Speichern',
    'settings.saved': 'Einstellungen lokal gespeichert',
    'settings.account': 'Account',
    'settings.space': 'Space',
    'spaces.newTitle': 'Space erstellen',
    'spaces.newDescription': 'Dies ist ein Phase-2-Stub.',
    'spaces.name': 'Space-Name',
    'spaces.createStub': 'Erstellen (Stub)',
    'spaces.stubInfo': 'Echte Server-Erstellung folgt spaeter.',
    'common.loading': 'Lade...'
  }
}

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

  function translateText(key: string): string {
    return (
      messages[locale.value][key] ??
      messages.en[key] ??
      key
    )
  }

  return {
    locale,
    setLocale,
    translateText,
    locales: allowedLocales
  }
}

function getState<T>(
  key: string,
  init: () => T
): { value: T } {
  if (typeof useState === 'function') {
    return useState<T>(key, init)
  }

  if (!fallbackStateStore.has(key)) {
    fallbackStateStore.set(key, { value: init() })
  }

  return fallbackStateStore.get(key) as { value: T }
}
