type AppLocale = 'en' | 'de'

const STORAGE_KEY = 'decentra.locale'

const messages: Record<AppLocale, Record<string, string>> = {
  en: {
    'auth.signIn': 'Sign in',
    'auth.signUp': 'Sign up',
    'cancel': 'Cancel',
    'auth.email': 'Email',
    'auth.homeserver': 'Homeserver',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.signInFailed': 'Sign in failed',
    'auth.signUpFailed': 'Sign up failed',
    'auth.signUpUnavailable': 'Sign-up is not available on this homeserver',
    'auth.signUpRegisterApiClosed':
      'This homeserver does not allow creating new accounts through the ' +
      'Matrix Client-Server API—the method Decentra uses for sign-up. ' +
      'You may still be able to register through the operator\'s website ' +
      'or another Matrix client, then sign in here.',
    'auth.signUpEmailVerificationRequired': 'Sign-up requires email verification on this homeserver',
    'auth.signUpSuccess': 'Account created. Please sign in.',
    'auth.signUpEmailSentTitle': 'Check your email',
    'auth.signUpEmailSentBody':
      'We sent a verification link to {email}. Open it to finish ' +
      'sign-up, then you can return here or sign in.',
    'auth.signUpEmailKeepTabOpen':
      'You can keep this tab open. After you use the link, this app ' +
      'can finish the flow automatically on the next page.',
    'auth.signUpCancel': 'Start over',
    'auth.signUpEmailVerifyingTitle': 'Confirming your email…',
    'auth.signUpEmailNotConfirmedYet':
      'The link in your email is not valid yet, or the mail was not ' +
      'opened. Open the link from the message, then try again.',
    'auth.signUpPendingMissing':
      'No sign-up in progress. Start from the sign-up form.',
    'auth.signUpSessionExpired':
      'The sign-up session expired. Please start again from the form.',
    'auth.signUpUnsupportedAuthStage':
      'This homeserver needs an additional sign-up step that Decentra ' +
      'does not support yet.',
    'auth.signUpSsoUseWebClient':
      'This homeserver only allows SSO sign-up. Please use the official ' +
      'Element web client in a browser, then continue in Decentra after ' +
      'your account exists.',
    'auth.signUpMsisdnUnsupported':
      'This homeserver expects phone-number (SMS) confirmation. Decentra ' +
      'does not support SMS sign-up yet.',
    'auth.signUpRegistrationTokenTitle': 'Registration token',
    'auth.signUpRegistrationTokenPlaceholder':
      'Paste token from homeserver admins',
    'auth.signUpRegistrationTokenSubmit': 'Continue',
    'auth.signUpRegistrationTokenRequired':
      'Homeserver requires a registration token. Enter it below.',
    'auth.signUpRegistrationTokenRejected':
      'This registration token was rejected. Check with your homeserver ' +
      'and try another token.',
    'auth.signUpTermsTitle': 'Accept policies',
    'auth.signUpTermsAcceptCheckbox':
      'I have read and agree to all policies linked above.',
    'auth.signUpTermsContinue': 'Continue',
    'auth.signUpTermsEmptyPolicies':
      'This homeserver did not send usable policy URLs. Cannot continue.',
    'auth.signUpRetry': 'Try again',
    'auth.signUpBackToForm': 'Back to sign-up',
    'auth.signUpCaptchaTitle': 'Verify you are human',
    'auth.signUpCaptchaConsentLead':
      'Google reCAPTCHA loads only after you agree. Google may process ' +
      'technical data (also outside the EU).',
    'auth.signUpHomeserverPrivacyNotice':
      'Your chosen Matrix homeserver operator processes signup data under ' +
      'their own rules; Decentra cannot describe every homeserver.',
    'auth.signUpPrivacyPolicyLink': 'Privacy policy',
    'auth.signUpCookieSettings': 'Cookie settings',
    'auth.signUpAgreeLoadRecaptcha': 'Agree and load reCAPTCHA',
    'auth.signUpRunRecaptchaCheck': 'Run automatic check',
    'auth.signUpRecaptchaMissingSiteKey':
      'The homeserver did not send a reCAPTCHA site key.',
    'auth.signUpRecaptchaFailed':
      'reCAPTCHA verification failed. Please try again.',
    'auth.signUpRecaptchaRequired':
      'Complete reCAPTCHA to continue.',
    'auth.signUpRecaptchaTransferAck':
      'I understand that loading reCAPTCHA sends data ' +
      '(including IP-related telemetry if applicable) ' +
      'to Google.',
    'auth.signUpClassicRegistrationDivider':
      'Classic sign-up via homeserver registration API',
    'auth.matrixOidcSignupIntro':
      'On this homeserver new accounts use the Matrix login service ' +
      '(MAS / OAuth), like Element—not the legacy /register form.',
    'auth.matrixOidcSignupButton': 'Continue Matrix sign-up in browser…',
    'auth.matrixOidcSignupFinePrint':
      'After you confirm in the Matrix window, Decentra continues here.',
    'auth.matrixOidcLoginIntro':
      'Delegated Matrix login (OAuth)—same mechanism many Element users ' +
      'use here.',
    'auth.matrixOidcLoginButton': 'Continue Matrix sign-in in browser…',
    'auth.signInPasswordDivider': 'Or sign in with password',
    'auth.matrixOidcNeedsHttpsSiteUrl':
      'Set NUXT_PUBLIC_SITE_URL to your public HTTPS app origin so OAuth ' +
      'redirects work (e.g. HTTPS preview URL—not plain http localhost).',
    'auth.matrixOidcCallbackTitle': 'Completing Matrix sign-in',
    'auth.matrixOidcCallbackBusy': 'Finishing delegated login…',
    'auth.matrixOidcMissingCodeState':
      'OAuth callback was missing authorization code or state.',
    'auth.matrixOidcCallbackInvalid':
      'Delegated login expired or tampered—start OAuth again.',
    'auth.matrixOidcCallbackFailedRaw': '{detail}',
    'auth.matrixOidcBackToLogin': 'Return to login',
    'auth.homeserverConnectionHint':
      'Cannot reach the homeserver from the browser. For public ' +
      'servers use https:// (not http://) so a redirect does not break ' +
      'CORS preflight. Synapse must allow this app origin in CORS.',
    'auth.restoringSession': 'Restoring session...',
    'chat.loggedInAs': 'Signed in as',
    'chat.signOut': 'Sign out',
    'chat.selectRoom': 'Select a room',
    'chat.loadOlder': 'Load older messages',
    'chat.noMessages': 'No messages yet. Start the conversation.',
    'chat.sendMessage': 'Send',
    'chat.replyAction': 'Reply',
    'chat.replyingTo': 'Replying to',
    'chat.cancelReply': 'Cancel reply',
    'chat.sendImage': 'Send image',
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
    'rooms.createTitle': 'Create room',
    'rooms.createDescription':
      'Create a Matrix room (not a Space). You can invite others after.',
    'rooms.createName': 'Room name',
    'rooms.createTopic': 'Topic (optional)',
    'rooms.createVisibility': 'Visibility',
    'rooms.visibilityPrivate': 'Private (invite only)',
    'rooms.visibilityPublic': 'Public (listed, open join)',
    'rooms.createSubmit': 'Create room',
    'onboarding.title': 'Get started',
    'onboarding.subtitle':
      'Start a direct message, create a room, or explore public rooms.',
    'onboarding.startDm': 'Start direct message',
    'onboarding.createRoom': 'Create room',
    'onboarding.explorePublic': 'Explore public rooms',
    'onboarding.back': 'Back',
    'onboarding.dmTitle': 'Direct message',
    'onboarding.dmPeerLabel': 'Matrix user',
    'onboarding.dmPeerPlaceholder': '@user:server or local name',
    'onboarding.shareOwnLink': 'Share your Matrix link (others can message you)',
    'onboarding.sharePeerLink': 'Link to selected user (matrix.to)',
    'onboarding.copyLink': 'Copy link',
    'onboarding.copied': 'Copied to clipboard',
    'onboarding.copyFailed': 'Could not copy to clipboard',
    'onboarding.dmSearchHint':
      'Optional: search the homeserver user directory (if enabled).',
    'onboarding.dmSearchPlaceholder': 'Search by name or id',
    'onboarding.dmSearchButton': 'Search',
    'onboarding.dmPickUser': 'Use',
    'onboarding.dmStart': 'Open conversation',
    'onboarding.publicTitle': 'Public rooms',
    'onboarding.publicSearch': 'Search',
    'onboarding.publicSearchPlaceholder': 'Filter directory…',
    'onboarding.publicNoResults': 'No rooms matched your search.',
    'onboarding.publicEmpty': 'No public rooms returned for this homeserver.',
    'onboarding.publicMembers': 'members',
    'onboarding.publicJoin': 'Join',
    'onboarding.publicLoadMore': 'Load more',
    'landing.kicker': 'OPEN AND FEDERATED TEAM CHAT',
    'landing.title': 'Own your collaboration with Decentra.',
    'landing.subtitle': 'Keep communication in your control while staying connected through Matrix.',
    'landing.loginCta': 'Sign in',
    'landing.signupCta': 'Sign up',
    'landing.chatCta': 'Open chat',
    'landing.featureOneTitle': 'Federated by default',
    'landing.featureOneText': 'Use Matrix homeservers to connect teams without vendor lock-in.',
    'landing.featureTwoTitle': 'Focus on productive channels',
    'landing.featureTwoText': 'Organize spaces, channels and replies in a clean, fast interface.',
    'landing.featureThreeTitle': 'Built for privacy-minded teams',
    'landing.featureThreeText': 'Decentra keeps your communication choices transparent and portable.',
    'landing.downloadTitle': 'Native app download',
    'landing.downloadPlaceholder': 'Desktop and mobile installers will arrive in a future phase.',
    'landing.downloadCta': 'Download coming soon',
    'landing.downloadIos': 'iOS (soon)',
    'landing.downloadAndroid': 'Android (soon)',
    'common.loading': 'Loading...'
  },
  de: {
    'auth.signIn': 'Anmelden',
    'auth.signUp': 'Registrieren',
    'cancel': 'Abbrechen',
    'auth.email': 'E-Mail',
    'auth.homeserver': 'Homeserver',
    'auth.username': 'Benutzername',
    'auth.password': 'Passwort',
    'auth.signInFailed': 'Anmeldung fehlgeschlagen',
    'auth.signUpFailed': 'Registrierung fehlgeschlagen',
    'auth.signUpUnavailable': 'Registrierung ist auf diesem Homeserver nicht verfuegbar',
    'auth.signUpRegisterApiClosed':
      'Dieser Homeserver erlaubt keine Neuregistrierung ueber die ' +
      'Matrix Client-Server-API - genau diese Schnittstelle nutzt Decentra ' +
      'fuer die Registrierung. Evtl. kannst du den Account bei der ' +
      'Betreibenden oder in einem anderen Client anlegen und dich hier ' +
      'danach anmelden.',
    'auth.signUpEmailVerificationRequired': 'Registrierung erfordert E-Mail-Verifizierung auf diesem Homeserver',
    'auth.signUpSuccess': 'Account erstellt. Bitte melde dich an.',
    'auth.signUpEmailSentTitle': 'E-Mail pruefen',
    'auth.signUpEmailSentBody':
      'Wir haben einen Bestaetigungslink an {email} geschickt. Oeffne ' +
      'ihn, um die Registrierung abzuschliessen, danach kannst du ' +
      'hier fortfahren oder dich anmelden.',
    'auth.signUpEmailKeepTabOpen':
      'Du kannst diesen Tab offen lassen. Nach dem Klick im Link ' +
      'schliessen wir den Vorgang auf der naechsten Seite automatisch ' +
      'ab, wenn es geht.',
    'auth.signUpCancel': 'Von vorn',
    'auth.signUpEmailVerifyingTitle': 'E-Mail wird bestaetigt…',
    'auth.signUpEmailNotConfirmedYet':
      'Der Link in der E-Mail ist noch nicht gueltig, oder die Mail ' +
      'wurde nicht geoeffnet. Nutze den Link aus der Nachricht, dann ' +
      'erst erneut versuchen.',
    'auth.signUpPendingMissing':
      'Keine laufende Registrierung. Bitte im Formular neu starten.',
    'auth.signUpSessionExpired':
      'Die Registrierungs-Sitzung ist abgelaufen. Bitte im Formular ' +
      'neu starten.',
    'auth.signUpUnsupportedAuthStage':
      'Dieser Homeserver verlangt einen weiteren Registrierungs-Schritt, ' +
      'den Decentra noch nicht unterstuetzt.',
    'auth.signUpSsoUseWebClient':
      'Dieser Homeserver erlaubt die Registrierung nur ueber SSO. Bitte ' +
      'die offizielle Element-Web-App im Browser nutzen, danach kannst du ' +
      'hier fortfahren, sobald ein Account besteht.',
    'auth.signUpMsisdnUnsupported':
      'Dieser Homeserver erwartet Bestaetigung per Mobilnummer/SMS. ' +
      'Decentra unterstuetzt diese SMS-Registrierung noch nicht.',
    'auth.signUpRegistrationTokenTitle':
      'Registrierungs-Token',
    'auth.signUpRegistrationTokenPlaceholder':
      'Token von den Homeserver-Admins einfuegen',
    'auth.signUpRegistrationTokenSubmit': 'Fortfahren',
    'auth.signUpRegistrationTokenRequired':
      'Der Homeserver braucht ein Registrierungs-Token.' +
      ' Bitte gib es unten ein.',
    'auth.signUpRegistrationTokenRejected':
      'Das Token wird vom Homeserver nicht akzeptiert. Bitte pruefen ' +
      'oder ein gueltiges Token verwenden.',
    'auth.signUpTermsTitle': 'Richtlinien akzeptieren',
    'auth.signUpTermsAcceptCheckbox':
      'Ich habe die verlinkten Richtlinien gelesen und stimme allen zu.',
    'auth.signUpTermsContinue': 'Fortfahren',
    'auth.signUpTermsEmptyPolicies':
      'Nutzbare Links zu Richtlinien fehlen. Fortsetzen ist nicht ' +
      'moeglich.',
    'auth.signUpRetry': 'Erneut versuchen',
    'auth.signUpBackToForm': 'Zurueck zur Registrierung',
    'auth.signUpCaptchaTitle': 'Bestaetigung gegen Bots',
    'auth.signUpCaptchaConsentLead':
      'Google reCAPTCHA wird erst nach Zustimmung geladen. Google kann ' +
      'technische Daten verarbeiten (auch ausserhalb der EU).',
    'auth.signUpHomeserverPrivacyNotice':
      'Der Betreiber deines gewaehlten Matrix-Homeservers verarbeitet ' +
      'Registrierungsdaten nach eigener Datenschutzerklaerung; Decentra ' +
      'kann nicht jeden Homeserver beschreiben.',
    'auth.signUpPrivacyPolicyLink': 'Datenschutzerklaerung',
    'auth.signUpCookieSettings': 'Cookie-Einstellungen',
    'auth.signUpAgreeLoadRecaptcha': 'Zustimmen und reCAPTCHA laden',
    'auth.signUpRunRecaptchaCheck': 'Automatische Pruefung starten',
    'auth.signUpRecaptchaMissingSiteKey':
      'Der Homeserver hat keinen reCAPTCHA-Site-Key gesendet.',
    'auth.signUpRecaptchaFailed':
      'reCAPTCHA-Verifikation fehlgeschlagen. Bitte erneut versuchen.',
    'auth.signUpRecaptchaRequired':
      'Bitte reCAPTCHA abschliessen, um fortzufahren.',
    'auth.signUpRecaptchaTransferAck':
      'Mir ist klar: Beim Laden von reCAPTCHA werden Daten unter ' +
      'Umstaenden an Google uebermittelt.',
    'auth.signUpClassicRegistrationDivider':
      'Klassische Registrierung ueber die Legacy-Registration-API',
    'auth.matrixOidcSignupIntro':
      'Auf diesem Homeserver laufen neue Konten ueber den Matrix-Anmeldeservice ' +
      '(MAS / OAuth), vergleichbar mit Element, nicht ueber die Legacy-/register-' +
      'API.',
    'auth.matrixOidcSignupButton':
      'Mit Matrix-Webfenster registrieren…',
    'auth.matrixOidcSignupFinePrint':
      'Nach dem Abschluss dort kehrst du hier automatisch weiter.',
    'auth.matrixOidcLoginIntro':
      'Delegation ueber OAuth wie bei Element, falls der Homeserver keine ' +
      'klassische Password-/login-Anmeldung nutzt.',
    'auth.matrixOidcLoginButton':
      'Mit Matrix-Webfenster anmelden…',
    'auth.signInPasswordDivider': 'Oder mit Passwort anmelden',
    'auth.matrixOidcNeedsHttpsSiteUrl':
      'Fuer OAuth-Bruecken setze NUXT_PUBLIC_SITE_URL auf eine oeffentliche ' +
      'HTTPS-Origin (z. B. Tunnel-Preview, nicht nur http localhost).',
    'auth.matrixOidcCallbackTitle':
      'Matrix-Anmeldung wird abgeschlossen',
    'auth.matrixOidcCallbackBusy':
      'Mit dem Anmeldeservice unterhalten…',
    'auth.matrixOidcMissingCodeState':
      'OAuth-Rueckruf ohne code oder state.',
    'auth.matrixOidcCallbackInvalid':
      'Anmeldedaten ungueltig oder abgelaufen—OAuth erneut starten.',
    'auth.matrixOidcCallbackFailedRaw': '{detail}',
    'auth.matrixOidcBackToLogin': 'Zurueck zum Login',
    'auth.homeserverConnectionHint':
      'Homeserver aus dem Browser nicht erreichbar. Oeffentliche ' +
      'Server: https:// statt http:// (sonst bricht CORS-Preflight). Synapse ' +
      'muss diese App-Origin in CORS erlauben.',
    'auth.restoringSession': 'Session wird wiederhergestellt...',
    'chat.loggedInAs': 'Eingeloggt als',
    'chat.signOut': 'Abmelden',
    'chat.selectRoom': 'Wähle einen Raum',
    'chat.loadOlder': 'Ältere Nachrichten laden',
    'chat.noMessages': 'Keine Nachrichten. Starte die Unterhaltung!',
    'chat.sendMessage': 'Senden',
    'chat.replyAction': 'Antworten',
    'chat.replyingTo': 'Antwort an',
    'chat.cancelReply': 'Antwort abbrechen',
    'chat.sendImage': 'Bild senden',
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
    'rooms.createTitle': 'Raum erstellen',
    'rooms.createDescription':
      'Erstelle einen Matrix-Raum (kein Space). Einladungen folgen spaeter.',
    'rooms.createName': 'Raumname',
    'rooms.createTopic': 'Thema (optional)',
    'rooms.createVisibility': 'Sichtbarkeit',
    'rooms.visibilityPrivate': 'Privat (nur auf Einladung)',
    'rooms.visibilityPublic': 'Oeffentlich (Verzeichnis, offener Beitritt)',
    'rooms.createSubmit': 'Raum erstellen',
    'onboarding.title': 'Erste Schritte',
    'onboarding.subtitle':
      'DM starten, Raum anlegen oder oeffentliche Raeume entdecken.',
    'onboarding.startDm': 'Direktnachricht starten',
    'onboarding.createRoom': 'Raum erstellen',
    'onboarding.explorePublic': 'Oeffentliche Raeume',
    'onboarding.back': 'Zurueck',
    'onboarding.dmTitle': 'Direktnachricht',
    'onboarding.dmPeerLabel': 'Matrix-Nutzer',
    'onboarding.dmPeerPlaceholder': '@user:server oder lokaler Name',
    'onboarding.shareOwnLink': 'Dein Matrix-Link (andere koennen dir schreiben)',
    'onboarding.sharePeerLink': 'Link zum gewaehlten Nutzer (matrix.to)',
    'onboarding.copyLink': 'Link kopieren',
    'onboarding.copied': 'In die Zwischenablage kopiert',
    'onboarding.copyFailed': 'Kopieren fehlgeschlagen',
    'onboarding.dmSearchHint':
      'Optional: Nutzerverzeichnis des Homeservers (falls aktiv).',
    'onboarding.dmSearchPlaceholder': 'Suche nach Name oder ID',
    'onboarding.dmSearchButton': 'Suchen',
    'onboarding.dmPickUser': 'Uebernehmen',
    'onboarding.dmStart': 'Unterhaltung oeffnen',
    'onboarding.publicTitle': 'Oeffentliche Raeume',
    'onboarding.publicSearch': 'Suchen',
    'onboarding.publicSearchPlaceholder': 'Verzeichnis filtern…',
    'onboarding.publicNoResults': 'Keine Raeume fuer diese Suche.',
    'onboarding.publicEmpty': 'Keine oeffentlichen Raeume vom Homeserver.',
    'onboarding.publicMembers': 'Mitglieder',
    'onboarding.publicJoin': 'Beitreten',
    'onboarding.publicLoadMore': 'Mehr laden',
    'landing.kicker': 'OPEN AND FEDERATED TEAM CHAT',
    'landing.title': 'Own your collaboration with Decentra.',
    'landing.subtitle': 'Keep communication in your control while staying connected through Matrix.',
    'landing.loginCta': 'Anmelden',
    'landing.signupCta': 'Registrieren',
    'landing.chatCta': 'Chat oeffnen',
    'landing.featureOneTitle': 'Foederiert von Anfang an',
    'landing.featureOneText': 'Nutze Matrix-Homeserver fuer Team-Chats ohne Vendor-Lock-in.',
    'landing.featureTwoTitle': 'Fokus auf produktive Kanaele',
    'landing.featureTwoText': 'Organize spaces, channels and replies in a clean, fast interface.',
    'landing.featureThreeTitle': 'Fuer privacy-orientierte Teams gebaut',
    'landing.featureThreeText': 'Decentra haelt Kommunikationsentscheidungen transparent und portabel.',
    'landing.downloadTitle': 'Native app download',
    'landing.downloadPlaceholder': 'Desktop and mobile installers will arrive in a future phase.',
    'landing.downloadCta': 'Download folgt bald',
    'landing.downloadIos': 'iOS (bald)',
    'landing.downloadAndroid': 'Android (bald)',
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
