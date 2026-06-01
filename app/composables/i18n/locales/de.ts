import type { LocaleMessages } from '../types'

const messages: LocaleMessages = {
    'auth.signIn': 'Anmelden',
    'auth.signUp': 'Registrieren',
    'cancel': 'Abbrechen',
    'auth.email': 'E-Mail',
    'auth.homeserver': 'Homeserver',
    'auth.username': 'Benutzername',
    'auth.password': 'Passwort',
    'auth.secretShowPassword': 'Passwort anzeigen',
    'auth.secretHidePassword': 'Passwort verbergen',
    'auth.signInFailed': 'Anmeldung fehlgeschlagen',
    'auth.signUpFailed': 'Registrierung fehlgeschlagen',
    'auth.signUpUnavailable': 'Registrierung ist auf diesem Homeserver nicht verfuegbar',
    'auth.signUpRegisterApiClosed':
      'Ueber diese Decentra-Seite kannst du dich auf diesem Homeserver ' +
      'nicht registrieren: Dort ist die Kontenerstellung auf bestimmte ' +
      'portale oder zugelassene Web-Angebote beschraenkt oder die fuer ' +
      'Decentra noetige generische Matrix-Registrierung ist abgeschaltet.\n\n' +
      'Wenn der Betreiber Registrierung im Web anbietet, probiere dort ' +
      'beginnend mit:\n{homeserverPortal}\n\n' +
      'Wenn der Account steht, melde dich unten an.',
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
      'Dieser Homeserver akzeptiert Neukonten nur ueber SSO. Bitte ' +
      'Registrierung ueber das SSO bzw. Web-Angebot des Betreibers ' +
      'abschliessen, danach hier anmelden.',
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
      'Auf diesem Homeserver laufen neue Konten ueber den delegierten ' +
      'Matrix-Anmeldeservice (MAS / OAuth), nicht ueber das klassische ' +
      '/register-Formular in diesem Dialog.',
    'auth.matrixOidcSignupButton':
      'Mit Matrix-Webfenster registrieren…',
    'auth.matrixOidcSignupFinePrint':
      'Nach dem Abschluss dort kehrst du hier automatisch weiter.',
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
      'Matrix-Client-API von dieser Seite aus nicht erreichbar. Bei ' +
      'oeffentlichen Servern https:// verwenden (kein Klartext-http). ' +
      'Netzwerk pruefen. Manche Betreiberschraenken zusaetzlich, welche ' +
      'Website-Urspruenge Login-Calls erlauben—auch wenn die ' +
      'Homeserver-URL stimmt.',
    'auth.restoringSession': 'Session wird wiederhergestellt...',
    'chat.loggedInAs': 'Eingeloggt als',
    'chat.signOut': 'Abmelden',
    'chat.selectRoom': 'Wähle einen Raum',
    'chat.loadOlder': 'Ältere Nachrichten laden',
    'chat.noMessages': 'Keine Nachrichten. Starte die Unterhaltung!',
    'chat.sendMessage': 'Senden',
    'chat.replyAction': 'Antworten',
    'chat.replyingTo': 'Antwort an',
    'chat.replyVideo': 'Video',
    'chat.replyVoice': 'Sprachnachricht',
    'chat.replyQuoteJump': 'Zur Originalnachricht springen',
    'chat.cancelReply': 'Antwort abbrechen',
    'chat.editAction': 'Bearbeiten',
    'chat.editingMessage': 'Nachricht bearbeiten',
    'chat.cancelEdit': 'Bearbeitung abbrechen',
    'chat.editNotAllowed': 'In diesem Raum kannst du keine Nachrichten bearbeiten',
    'chat.threadAction': 'Thread',
    'chat.threadStartedBy': 'Begonnen von',
    'chat.threadClosePanel': 'Thread schließen',
    'chat.threadOneReply': '1 Antwort',
    'chat.threadManyReplies': '{count} Antworten',
    'chat.threadBackToChannel': 'Zurück zum Kanal',
    'chat.messageEdited': 'bearbeitet',
    'chat.messageDeleted': 'Nachricht gelöscht',
    'chat.roomThreads': 'Threads',
    'chat.roomThreadsEmpty': 'In diesem Raum gibt es noch keine Threads.',
    'chat.openRoomThreads': 'Thread-Liste öffnen',
    'chat.closeRoomThreads': 'Thread-Liste schließen',
    'chat.pinnedMessages': 'Angepinnte Nachrichten',
    'chat.openPinnedMessages': 'Angepinnte Nachrichten öffnen',
    'chat.closePinnedMessages': 'Angepinnte Nachrichten schließen',
    'chat.pinnedMessagesEmpty':
      'In diesem Raum sind noch keine Nachrichten angepinnt.',
    'chat.pinAction': 'Anheften',
    'chat.unpinAction': 'Lösen',
    'chat.pinnedAt': 'Angepinnt {time}',
    'chat.pinnedMessageUnavailable': 'Nachricht nicht verfügbar',
    'chat.pinNotAllowed':
      'Du kannst in diesem Raum keine Nachrichten anheften',
    'chat.messagePinnedLabel': 'Angepinnte Nachricht',
    'chat.noticePinnedMessage': '{name} hat eine Nachricht angepinnt',
    'chat.noticeUnpinnedMessage': '{name} hat eine Nachricht gelöst',
    'chat.noticeUpdatedPinnedMessages':
      '{name} hat die angepinnten Nachrichten geändert',
    'chat.sendImage': 'Bild senden',
    'chat.attachMedia': 'Datei anhängen',
    'chat.sendVideo': 'Video senden',
    'chat.sendAudio': 'Audio senden',
    'chat.imageUploading': 'Bild wird hochgeladen…',
    'chat.imageUploadFailed': 'Bild-Upload fehlgeschlagen.',
    'chat.videoUploading': 'Video wird hochgeladen…',
    'chat.videoUploadFailed': 'Video-Upload fehlgeschlagen.',
    'chat.videoInvalidType': 'Nur MP4- und WebM-Videos werden unterstützt.',
    'chat.videoTooLarge': 'Videos dürfen höchstens {maxMb} MB groß sein.',
    'chat.audioUploading': 'Audio wird hochgeladen…',
    'chat.audioUploadFailed': 'Audio-Upload fehlgeschlagen.',
    'chat.audioInvalidType':
      'Nur MP3-, M4A-, OGG-, WAV- und WebM-Audiodateien werden unterstützt.',
    'chat.audioTooLarge':
      'Audiodateien dürfen höchstens {maxMb} MB groß sein.',
    'chat.videoLoading': 'Video wird geladen…',
    'chat.videoUnavailable': 'Video nicht verfügbar',
    'chat.dropMediaHint': 'Bild oder Video zum Anhängen ablegen',
    'chat.dismissUploadError': 'Schließen',
    'chat.recordVoice': 'Sprachnachricht aufnehmen',
    'chat.recording': 'Aufnahme',
    'chat.pauseRecording': 'Pause',
    'chat.resumeRecording': 'Fortsetzen',
    'chat.stopRecording': 'Stopp',
    'chat.cancelRecording': 'Abbrechen',
    'chat.voicePreview': 'Sprachvorschau',
    'chat.discardVoice': 'Verwerfen',
    'chat.sendVoice': 'Sprachnachricht senden',
    'chat.microphonePermissionDenied':
      'Mikrofonzugriff verweigert. Erlaube den Zugriff fuer Sprachnachrichten.',
    'chat.recordingFailed':
      'Aufnahme fehlgeschlagen. Bitte erneut versuchen.',
    'chat.voiceUploadFailed':
      'Sprachnachricht konnte nicht hochgeladen werden.',
    'chat.voiceRecordingUnsupported':
      'Sprachaufnahme wird in diesem Browser nicht unterstuetzt.',
    'chat.dismissVoiceError': 'Schliessen',
    'chat.voicePlay': 'Sprachnachricht abspielen',
    'chat.voiceLoading': 'Audio wird geladen…',
    'chat.insertEmoji': 'Emoji einfügen',
    'chat.emojiAutocompleteHint': 'Emoji-Shortcode-Vorschläge',
    'chat.messagePlaceholder': 'Nachricht eingeben...',
    'chat.typingOne': '{name} schreibt…',
    'chat.typingTwo': '{first} und {second} schreiben…',
    'chat.typingManyOneOther':
      '{first}, {second} und 1 weitere Person schreiben…',
    'chat.typingManyOthers':
      '{first}, {second} und {count} weitere schreiben…',
    'chat.noRooms': 'Keine Räume',
    'layout.spaces': 'Spaces',
    'layout.channels': 'Kanäle',
    'layout.members': 'Mitglieder',
    'layout.noMembers': 'Keine Mitglieder gefunden',
    'layout.noSpaces': 'Keine Spaces verfügbar',
    'layout.noRoomsInSpace': 'Keine Kanäle in diesem Space',
    'layout.generalCategory': 'Allgemein',
    'layout.spaceRoomsCategory': 'Rooms',
    'layout.spaceRoomsContinued': 'Raeume (fortgesetzt)',
    'layout.roomFallback': 'Unbenannter Raum',
    'layout.spaceFallback': 'Unbenannter Space',
    'layout.homeSpace': 'Start',
    'layout.personalChats': 'Persoenliche Chats',
    'layout.groupChats': 'Gruppen',
    'layout.unassignedRooms': 'Nicht zugeordnete Raeume',
    'layout.channelUnreadAria': 'Ungelesene Nachrichten in {name}',
    'layout.channelMentionUnreadAria': 'Erwähnung in {name}',
    'layout.spaceUnreadAria': '{count} ungelesene Nachrichten in Space {name}',
    'layout.spaceMentionUnreadAria': '{count} Erwähnungen in Space {name}',
    'layout.threadUnreadAria': 'Ungelesener Thread {title}',
    'layout.threadMentionUnreadAria': 'Erwähnung im Thread {title}',
    'layout.toggleNavigation': 'Navigation umschalten',
    'layout.toggleMembers': 'Mitglieder umschalten',
    'layout.expandSpaces': 'Spaces erweitern',
    'layout.collapseSpaces': 'Spaces einklappen',
    'layout.openAccountSettings': 'Account-Einstellungen',
    'layout.openSpaceSettings': 'Space-Einstellungen',
    'layout.openRoomSettings': 'Kanal-Einstellungen',
    'layout.roomActionsMenu': 'Kanaloptionen',
    'layout.roomNotifications': 'Benachrichtigungen',
    'layout.spaceNotifications': 'Space-Benachrichtigungen',
    'notifications.title': 'Benachrichtigungen',
    'notifications.description':
      'Lege fest, wann dich dieser Kanal benachrichtigt.',
    'notifications.spaceDescription':
      'Wende eine Benachrichtigungsstufe auf alle Kanäle dieses Space an.',
    'notifications.menuLabel': 'Benachrichtigungseinstellungen',
    'notifications.roomBell.default':
      'Benachrichtigungen: Standardeinstellung',
    'notifications.roomBell.all': 'Benachrichtigungen: alle Nachrichten',
    'notifications.roomBell.mentions':
      'Benachrichtigungen: nur Erwähnungen',
    'notifications.roomBell.mute':
      'Benachrichtigungen: Kanal stummgeschaltet',
    'notifications.level.default': 'Standardeinstellung verwenden',
    'notifications.level.all': 'Alle Nachrichten',
    'notifications.level.mentions': 'Nur Erwähnungen & Schlüsselwörter',
    'notifications.level.mute': 'Kanal stummschalten',
    'notifications.space.default': 'Standardeinstellung verwenden',
    'notifications.space.all': 'Alle Nachrichten',
    'notifications.space.mentions': 'Nur Erwähnungen & Schlüsselwörter',
    'notifications.space.mute': 'Space stummschalten',
    'notifications.space.mixed': 'Gemischt',
    'notifications.applied': 'Benachrichtigung gespeichert',
    'notifications.incomingVisual': 'Nur visuell (Tab-Titel & Badges)',
    'notifications.incomingSound': 'Ton und visuell',
    'notifications.incomingHint':
      'Ton bei neuen Nachrichten in nicht stummen Kanälen, solange du in einem anderen Kanal bist. Browser verlangen oft zuerst einen Klick in der App.',
    'settings.messageNotify': 'Benachrichtigung bei neuen Nachrichten',
    'layout.expandCategory': 'Kategorie aufklappen',
    'layout.collapseCategory': 'Kategorie zuklappen',
    'layout.createSpace': 'Space erstellen',
    'layout.addRoom': 'Raum hinzufuegen',
    'layout.addSubspace': 'Subspace hinzufuegen',
    'invite.title': 'Personen einladen',
    'invite.close': 'Schliessen',
    'invite.spaceMenu': 'In Space einladen',
    'invite.roomButton': 'In Kanal einladen',
    'invite.roomMenu': 'In Kanal einladen',
    'invite.manualLabel': 'Matrix-IDs',
    'invite.manualPlaceholder': '@user:server.org, je Zeile eine',
    'invite.searchHint': 'Oder im Verzeichnis des Homeservers suchen.',
    'invite.searchPlaceholder': 'Name oder @user',
    'invite.searchButton': 'Suchen',
    'invite.addUser': 'Hinzufuegen',
    'invite.submit': 'Einladungen senden',
    'invite.noUsers': 'Mindestens einen Nutzer hinzufuegen.',
    'invite.success': '{count} Nutzer eingeladen.',
    'rooms.createInviteLabel': 'Mitglieder einladen (optional)',
    'rooms.createInviteHint':
      'Suchen oder Matrix-IDs einfuegen. Einladung beim Erstellen.',
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
    'settings.verificationPanelTitle': 'Verifizierung',
    'settings.verificationPanelIntro':
      'Du kannst diese Session auf zwei Arten verifizieren: mit einem anderen ' +
      'angemeldeten Client (Emoji-Vergleich) oder mit deinem Recovery- bzw. Security-Key.',
    'settings.verificationEmojiTitle': 'Verifizierung mit anderem Client (Emoji)',
    'settings.verificationEmojiDescription':
      'Verifiziere diese Session mit einem anderen Client desselben Accounts per Emoji-Vergleich.',
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
    'settings.verificationNeedCrossSigning':
      'Cross-Signing fuer dieses Konto ist noch nicht verfuegbar; richte ihn ' +
      'zuerst in einem anderen Matrix-Client ein.',
    'settings.verificationReadyTimeout':
      'Timeout beim Warten auf den anderen Client. Offne die andere Session, ' +
      'akzeptiere die Verifizierung und versuche es erneut.',
    'settings.verificationUnknownOtherDevice':
      'Das andere Geraet konnte noch nicht geladen werden. Stelle sicher, ' +
      'dass der andere Client online ist, tippe auf Status aktualisieren, ' +
      'und versuche es erneut.',
    'settings.verificationProtocolError':
      'Die Verifizierung konnte nicht fortgesetzt werden — abbrechen und erneut starten.',
    'settings.verificationRecoveryTitle': 'Verifizierung mit Recovery-Key',
    'settings.verificationRecoveryDescription':
      'Wenn du keinen zweiten Client zur Verifizierung hast, gib deinen ' +
      'Matrix-Wiederherstellungsschluessel (Security Key) ein, um Cross-Signing ' +
      'aus dem Secret Storage auf diesem Geraet wiederherzustellen.',
    'settings.verificationRecoveryHint':
      'Nutze zuerst die Emoji-Verifizierung, wenn du einen zweiten vertrauenswuerdigen ' +
      'Client hast; den Recovery-Key nur, wenn das nicht moeglich ist.',
    'settings.verificationRecoveryKeyLabel': 'Recovery- oder Security-Key',
    'settings.secretShowRecoveryKey': 'Recovery-Key anzeigen',
    'settings.secretHideRecoveryKey': 'Recovery-Key verbergen',
    'settings.verificationRecoverySubmit': 'Verschluesselung wiederherstellen',
    'settings.verificationRecoverySuccess':
      'Schluessel wurden wiederhergestellt und diese Session ist jetzt ' +
      'verifiziert. Andere Matrix-Clients benoetigen ' +
      'eventuell ein paar Minuten, bis sie diese Session als verifiziert ' +
      'anzeigen.',
    'settings.verificationRecoveryErrorInvalidInput':
      'Bitte den Wiederherstellungsschluessel eingeben.',
    'settings.verificationRecoveryErrorInvalidKey':
      'Dieser Schluessel passt nicht zu deinem Secret Storage. Bitte pruefen und erneut versuchen.',
    'settings.verificationRecoveryErrorNoSecretStorage':
      'Fuer dieses Konto liegt kein Cross-Signing im Secret Storage. Richte ' +
      'Secret Storage zuerst in einem anderen Matrix-Client ein.',
    'settings.verificationRecoveryErrorCryptoUnavailable':
      'Verschluesselung ist auf diesem Geraet nicht bereit. Ab- und wieder anmelden, dann erneut versuchen.',
    'settings.verificationRecoveryErrorUiaRequired':
      'Der Homeserver verlangt zusaetzliche Authentifizierung. Von einer Session ' +
      'mit Interactive Auth versuchen oder einen anderen Client nutzen.',
    'settings.verificationRecoveryErrorNetwork':
      'Netzwerkfehler zum Homeserver. Verbindung pruefen und erneut versuchen.',
    'settings.verificationRecoveryErrorUnknown':
      'Verschluesselung konnte nicht wiederhergestellt werden. Erneut versuchen ' +
      'oder anderen Client nutzen.',
    'settings.backToChat': 'Zurück zum Chat',
    'settings.roomTitle': 'Kanal-Einstellungen',
    'settings.roomDescription': 'Name und Thema dieses Kanals.',
    'settings.roomId': 'Raum-ID',
    'settings.roomName': 'Kanalname',
    'settings.roomTopic': 'Kanal-Thema',
    'settings.roomReadOnlyHint':
      'Einstellungen ansehen, Name und Thema nicht aenderbar.',
    'settings.spaceTitle': 'Space-Einstellungen',
    'settings.spaceDescription': 'Basis-Einstellungen für diesen Space.',
    'settings.spaceId': 'Space-ID',
    'settings.spaceName': 'Space-Name',
    'settings.save': 'Speichern',
    'settings.cancel': 'Abbrechen',
    'settings.saved': 'Einstellungen gespeichert',
    'settings.spaceTopic': 'Space-Thema',
    'settings.spaceAvatar': 'Space-Icon',
    'settings.spaceAvatarRemove': 'Icon entfernen',
    'settings.spaceNavGeneral': 'Allgemein',
    'settings.spaceNavRoles': 'Rollen',
    'settings.spaceNavPermissions': 'Berechtigungen',
    'settings.spaceNavMembers': 'Mitglieder',
    'settings.spaceGeneralProfile': 'Profil',
    'settings.spaceGeneralProfileEdit': 'Bearbeiten',
    'settings.spaceGeneralOptions': 'Optionen',
    'settings.spaceAccess': 'Space-Zugang',
    'settings.spaceAccessHint':
      'Legt fest, wie Nutzer dem Space beitreten koennen.',
    'settings.spaceAccessPublic': 'Oeffentlich',
    'settings.spaceAccessInvite': 'Nur auf Einladung',
    'settings.spaceAccessKnock': 'Klopfen & Einladung',
    'settings.spacePublishDirectory': 'Im Verzeichnis veroeffentlichen',
    'settings.spacePublishDirectoryHint':
      'Space im oeffentlichen Verzeichnis auffindbar machen.',
    'settings.spaceGeneralAddresses': 'Adressen',
    'settings.spacePublishedAddresses': 'Veroeffentlichte Adressen',
    'settings.spacePublishedAddressesHint':
      'Bei oeffentlichem Zugang koennen Nutzer diese Adressen nutzen.',
    'settings.spaceMainAlias': 'Haupt',
    'settings.spaceNoPublishedAddress': 'Noch keine veroeffentlichte Adresse.',
    'settings.spaceLocalAddresses': 'Lokale Adressen',
    'settings.spaceLocalAddressesHint':
      'Lokale Adresse fuer Beitritt ueber deinen Homeserver.',
    'settings.spaceExpand': 'Aufklappen',
    'settings.spaceCollapse': 'Zuklappen',
    'settings.spaceGeneralAdvanced': 'Erweiterte Optionen',
    'settings.spaceUpgrade': 'Space upgraden',
    'settings.spaceUpgradeHint': 'Aktuelle Version: {version}.',
    'settings.spaceUpgradeAvailable':
      'Empfohlene Version: {version}.',
    'settings.spaceUpgradeButton': 'Upgrade',
    'settings.spaceOldSpace': 'Alter Space',
    'settings.spaceRolesHint':
      'Rollen und Rechte nutzen Matrix Power Levels (Cinny/Sable-kompatibel).',
    'settings.spaceRolesDragHint':
      'Rollen ziehen fuer Hierarchie (oben = hoechste Rolle).',
    'settings.spaceRoleCreate': 'Rolle erstellen',
    'settings.spaceRoleNamePlaceholder': 'Rollenname',
    'settings.spaceRoleNameLabel': 'Rollenname',
    'settings.spaceRolePowerLevel': 'Power Level',
    'settings.spaceRoleEdit': 'Bearbeiten',
    'settings.spaceRoleDelete': 'Loeschen',
    'settings.spaceRoleFounder': 'Gruender',
    'settings.spaceFoundersTitle': 'Gruender',
    'settings.spaceFoundersHint':
      'Der Space-Ersteller hat alle Rechte und ist nicht zuweisbar.',
    'settings.spaceRoleColor': 'Farbe',
    'settings.spacePlPermissionsTitle': 'Berechtigungen',
    'settings.spacePlRoleAndAbove': '{name} und hoeher',
    'settings.spacePlGroupUsers': 'Nutzer',
    'settings.spacePlGroupManage': 'Verwalten',
    'settings.spacePlGroupModeration': 'Moderation',
    'settings.spacePlGroupSpaceOverview': 'Space-Uebersicht',
    'settings.spacePlGroupSettings': 'Einstellungen',
    'settings.spacePlGroupOther': 'Sonstiges',
    'settings.spacePlDefaultPower': 'Standard-Power',
    'settings.spacePlManageRooms': 'Space-Raeume verwalten',
    'settings.spacePlMessageEvents': 'Nachrichten-Events',
    'settings.spacePlInvite': 'Einladen',
    'settings.spacePlKick': 'Kicken',
    'settings.spacePlBan': 'Bannen',
    'settings.spacePlSpaceAvatar': 'Space-Avatar',
    'settings.spacePlSpaceName': 'Space-Name',
    'settings.spacePlSpaceTopic': 'Space-Thema',
    'settings.spacePlRedact': 'Nachrichten loeschen',
    'settings.spacePlChangeAccess': 'Space-Zugang aendern',
    'settings.spacePlPublishAddress': 'Adresse veroeffentlichen',
    'settings.spacePlChangeAllPermission': 'Alle Berechtigungen',
    'settings.spacePlEditPowerLevels': 'Power-Levels bearbeiten',
    'settings.spacePlUpgradeSpace': 'Space upgraden',
    'settings.spacePlOtherSettings': 'Weitere Einstellungen',
    'settings.spacePlManageEmojis': 'Emojis & Sticker verwalten',
    'settings.spacePlServerAcls': 'Server-ACLs aendern',
    'settings.spaceVisibleRooms': 'Sichtbare Kanaele',
    'settings.spaceVisibleRoomsAll': 'Alle Kanaele',
    'settings.account': 'Account',
    'settings.space': 'Space',
    'layout.spaceMembersCount': '{count} Mitglieder',
    'spaces.newTitle': 'Space erstellen',
    'spaces.newDescription':
      'Erstellt einen Matrix-Space auf deinem Homeserver.',
    'spaces.name': 'Space-Name',
    'spaces.createSubmit': 'Space erstellen',
    'rooms.createTitle': 'Raum erstellen',
    'rooms.createSpaceTitle': 'Subspace erstellen',
    'rooms.createSpaceDescription':
      'Erstellt einen verschachtelten Space und verknuepft ihn.',
    'rooms.createSpaceSubmit': 'Subspace erstellen',
    'rooms.createInSpaceHint': 'Wird dem aktuellen Space hinzugefuegt.',
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

export default messages
