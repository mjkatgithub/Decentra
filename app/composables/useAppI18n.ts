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
    'auth.secretShowPassword': 'Show password',
    'auth.secretHidePassword': 'Hide password',
    'auth.signInFailed': 'Sign in failed',
    'auth.signUpFailed': 'Sign up failed',
    'auth.signUpUnavailable': 'Sign-up is not available on this homeserver',
    'auth.signUpRegisterApiClosed':
      'Sign-up through this Decentra page is not available on this ' +
      'homeserver: registration is restricted to portals or approved ' +
      'web entry points—the generic Matrix registration API Decentra ' +
      'uses is blocked or disabled here.\n\n' +
      'If the operator offers account creation on the web, try their ' +
      'site starting at:\n{homeserverPortal}\n\n' +
      'After you have an account, sign in below.',
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
      'This homeserver only accepts SSO for new accounts. Complete ' +
      'sign-up via your homeserver operator\'s SSO or web registration ' +
      'page, then sign in here once the account exists.',
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
      'On this homeserver new accounts use the delegated Matrix login ' +
      'service (MAS / OAuth), not the classic /register form in this dialog.',
    'auth.matrixOidcSignupButton': 'Continue Matrix sign-up in browser…',
    'auth.matrixOidcSignupFinePrint':
      'After you confirm in the Matrix window, Decentra continues here.',
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
      'Unable to reach the Matrix client API from this page. Use ' +
      'https:// for public servers (not plain http://). Check your ' +
      'network. Some operators also limit which browser origins may ' +
      'call the login API—even when the homeserver URL is correct.',
    'auth.restoringSession': 'Restoring session...',
    'chat.loggedInAs': 'Signed in as',
    'chat.signOut': 'Sign out',
    'chat.selectRoom': 'Select a room',
    'chat.loadOlder': 'Load older messages',
    'chat.noMessages': 'No messages yet. Start the conversation.',
    'chat.sendMessage': 'Send',
    'chat.replyAction': 'Reply',
    'chat.replyingTo': 'Replying to',
    'chat.replyVideo': 'Video',
    'chat.replyVoice': 'Voice message',
    'chat.replyQuoteJump': 'Jump to original message',
    'chat.cancelReply': 'Cancel reply',
    'chat.editAction': 'Edit',
    'chat.editingMessage': 'Editing message',
    'chat.cancelEdit': 'Cancel edit',
    'chat.editNotAllowed': 'You cannot edit messages in this room',
    'chat.threadAction': 'Thread',
    'chat.threadStartedBy': 'Started by',
    'chat.threadClosePanel': 'Close thread panel',
    'chat.threadOneReply': '1 reply',
    'chat.threadManyReplies': '{count} replies',
    'chat.threadBackToChannel': 'Back to channel',
    'chat.messageEdited': 'edited',
    'chat.messageDeleted': 'Message deleted',
    'chat.roomThreads': 'Threads',
    'chat.roomThreadsEmpty': 'No threads in this room yet.',
    'chat.openRoomThreads': 'Open thread list',
    'chat.closeRoomThreads': 'Close thread list',
    'chat.pinnedMessages': 'Pinned messages',
    'chat.openPinnedMessages': 'Open pinned messages',
    'chat.closePinnedMessages': 'Close pinned messages',
    'chat.pinnedMessagesEmpty': 'No pinned messages in this room yet.',
    'chat.pinAction': 'Pin',
    'chat.unpinAction': 'Unpin',
    'chat.pinnedAt': 'Pinned {time}',
    'chat.pinnedMessageUnavailable': 'Message unavailable',
    'chat.pinNotAllowed': 'You cannot pin messages in this room',
    'chat.messagePinnedLabel': 'Pinned message',
    'chat.noticePinnedMessage': '{name} pinned a message',
    'chat.noticeUnpinnedMessage': '{name} unpinned a message',
    'chat.noticeUpdatedPinnedMessages': '{name} updated pinned messages',
    'chat.sendImage': 'Send image',
    'chat.attachMedia': 'Attach file',
    'chat.sendVideo': 'Send video',
    'chat.sendAudio': 'Send audio',
    'chat.imageUploading': 'Uploading image…',
    'chat.imageUploadFailed': 'Failed to upload image.',
    'chat.videoUploading': 'Uploading video…',
    'chat.videoUploadFailed': 'Failed to upload video.',
    'chat.videoInvalidType': 'Only MP4 and WebM videos are supported.',
    'chat.videoTooLarge': 'Video must be {maxMb} MB or smaller.',
    'chat.audioUploading': 'Uploading audio…',
    'chat.audioUploadFailed': 'Failed to upload audio.',
    'chat.audioInvalidType':
      'Only MP3, M4A, OGG, WAV, and WebM audio files are supported.',
    'chat.audioTooLarge': 'Audio must be {maxMb} MB or smaller.',
    'chat.videoLoading': 'Loading video…',
    'chat.videoUnavailable': 'Video unavailable',
    'chat.dropMediaHint': 'Drop an image or video to attach',
    'chat.dismissUploadError': 'Dismiss',
    'chat.recordVoice': 'Record voice message',
    'chat.recording': 'Recording',
    'chat.pauseRecording': 'Pause',
    'chat.resumeRecording': 'Resume',
    'chat.stopRecording': 'Stop',
    'chat.cancelRecording': 'Cancel',
    'chat.voicePreview': 'Voice preview',
    'chat.discardVoice': 'Discard',
    'chat.sendVoice': 'Send voice',
    'chat.microphonePermissionDenied':
      'Microphone access was denied. Allow access to record voice messages.',
    'chat.recordingFailed': 'Recording failed. Please try again.',
    'chat.voiceUploadFailed': 'Failed to upload voice message.',
    'chat.voiceRecordingUnsupported':
      'Voice recording is not supported in this browser.',
    'chat.dismissVoiceError': 'Dismiss',
    'chat.voicePlay': 'Play voice message',
    'chat.voiceLoading': 'Loading audio…',
    'chat.insertEmoji': 'Insert emoji',
    'chat.emojiAutocompleteHint': 'Emoji shortcode suggestions',
    'chat.messagePlaceholder': 'Write a message...',
    'chat.typingOne': '{name} is typing…',
    'chat.typingTwo': '{first} and {second} are typing…',
    'chat.typingManyOneOther': '{first}, {second} and 1 other are typing…',
    'chat.typingManyOthers': '{first}, {second} and {count} others are typing…',
    'chat.noRooms': 'No rooms',
    'layout.spaces': 'Spaces',
    'layout.channels': 'Channels',
    'layout.members': 'Members',
    'layout.noMembers': 'No members found',
    'layout.noSpaces': 'No spaces available',
    'layout.noRoomsInSpace': 'No channels in this space',
    'layout.generalCategory': 'General',
    'layout.spaceRoomsCategory': 'Rooms',
    'layout.spaceRoomsContinued': 'Rooms (continued)',
    'layout.roomFallback': 'Unnamed room',
    'layout.spaceFallback': 'Unnamed space',
    'layout.homeSpace': 'Home',
    'layout.personalChats': 'Personal chats',
    'layout.groupChats': 'Groups',
    'layout.unassignedRooms': 'Unassigned rooms',
    'layout.channelUnreadAria': 'Unread messages in {name}',
    'layout.channelMentionUnreadAria': 'Mentioned in {name}',
    'layout.spaceUnreadAria': '{count} unread messages in space {name}',
    'layout.spaceMentionUnreadAria': '{count} mentions in space {name}',
    'layout.threadUnreadAria': 'Unread thread {title}',
    'layout.threadMentionUnreadAria': 'Mentioned in thread {title}',
    'layout.toggleNavigation': 'Toggle navigation',
    'layout.toggleMembers': 'Toggle members',
    'layout.expandSpaces': 'Expand spaces',
    'layout.collapseSpaces': 'Collapse spaces',
    'layout.openAccountSettings': 'Account settings',
    'layout.openSpaceSettings': 'Space settings',
    'layout.openRoomSettings': 'Channel settings',
    'layout.roomActionsMenu': 'Channel options',
    'layout.roomNotifications': 'Notifications',
    'layout.spaceNotifications': 'Space notifications',
    'notifications.title': 'Notifications',
    'notifications.description':
      'Choose when this channel notifies you.',
    'notifications.spaceDescription':
      'Apply a notification level to every channel in this space.',
    'notifications.menuLabel': 'Notification settings',
    'notifications.roomBell.default': 'Notifications: match default settings',
    'notifications.roomBell.all': 'Notifications: all messages',
    'notifications.roomBell.mentions': 'Notifications: mentions only',
    'notifications.roomBell.mute': 'Notifications: channel muted',
    'notifications.level.default': 'Match default settings',
    'notifications.level.all': 'All messages',
    'notifications.level.mentions': 'Mentions & keywords only',
    'notifications.level.mute': 'Mute channel',
    'notifications.space.default': 'Match default settings',
    'notifications.space.all': 'All messages',
    'notifications.space.mentions': 'Mentions & keywords only',
    'notifications.space.mute': 'Mute space',
    'notifications.space.mixed': 'Mixed',
    'notifications.applied': 'Notification setting saved',
    'layout.expandCategory': 'Expand category',
    'layout.collapseCategory': 'Collapse category',
    'layout.createSpace': 'Create space',
    'layout.addRoom': 'Add room',
    'layout.addSubspace': 'Add subspace',
    'invite.title': 'Invite people',
    'invite.close': 'Close',
    'invite.spaceMenu': 'Invite to space',
    'invite.roomButton': 'Invite to channel',
    'invite.roomMenu': 'Invite to channel',
    'invite.manualLabel': 'Matrix IDs',
    'invite.manualPlaceholder': '@user:server.org, one per line',
    'invite.searchHint': 'Or search your homeserver directory.',
    'invite.searchPlaceholder': 'Name or @user',
    'invite.searchButton': 'Search',
    'invite.addUser': 'Add',
    'invite.submit': 'Send invites',
    'invite.noUsers': 'Add at least one user.',
    'invite.success': 'Invited {count} user(s).',
    'rooms.createInviteLabel': 'Invite members (optional)',
    'rooms.createInviteHint':
      'Search or paste Matrix IDs. They are invited when the room is created.',
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
    'settings.verificationPanelTitle': 'Verification',
    'settings.verificationPanelIntro':
      'You can verify this session in two ways: with another signed-in client ' +
      '(emoji comparison) or with your recovery / security key.',
    'settings.verificationEmojiTitle': 'Verification with another client (emoji)',
    'settings.verificationEmojiDescription':
      'Verify this session with another client of the same account by comparing emojis.',
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
    'settings.verificationNeedCrossSigning':
      'Cross-signing is not available on this account yet; set it up ' +
      'in another Matrix client before verifying this device.',
    'settings.verificationReadyTimeout':
      'Timed out waiting for the other client. Open your other session, ' +
      'accept verification, then try again.',
    'settings.verificationUnknownOtherDevice':
      'Could not load the other device yet. Confirm the other client is ' +
      'online and tap Refresh status, then try again.',
    'settings.verificationProtocolError':
      'Verification could not continue — try cancelling and starting again.',
    'settings.verificationRecoveryTitle': 'Verification with recovery key',
    'settings.verificationRecoveryDescription':
      'If you cannot verify with another client, enter your Matrix ' +
      'recovery / security key to restore cross-signing secrets from ' +
      'secret storage on this device.',
    'settings.verificationRecoveryHint':
      'Prefer emoji verification when you have a second trusted client; use ' +
      'the recovery key only when that is not possible.',
    'settings.verificationRecoveryKeyLabel': 'Recovery or security key',
    'settings.secretShowRecoveryKey': 'Show recovery key',
    'settings.secretHideRecoveryKey': 'Hide recovery key',
    'settings.verificationRecoverySubmit': 'Restore encryption',
    'settings.verificationRecoverySuccess':
      'Encryption secrets were restored and this session is now verified. ' +
      'Other Matrix clients may need a few minutes ' +
      'to refresh their device list before they show this session as verified.',
    'settings.verificationRecoveryErrorInvalidInput': 'Enter your recovery key.',
    'settings.verificationRecoveryErrorInvalidKey':
      'That key does not match your secret storage. Check the key and try again.',
    'settings.verificationRecoveryErrorNoSecretStorage':
      'This account has no cross-signing keys in secret storage yet. Set up ' +
      'secret storage in another Matrix client first.',
    'settings.verificationRecoveryErrorCryptoUnavailable':
      'Encryption is not ready on this device. Try signing out and in, then retry.',
    'settings.verificationRecoveryErrorUiaRequired':
      'The homeserver needs extra authentication to finish this step. Try ' +
      'again from a session that can complete interactive auth, or use another client.',
    'settings.verificationRecoveryErrorNetwork':
      'Network error talking to the homeserver. Check your connection and retry.',
    'settings.verificationRecoveryErrorUnknown':
      'Could not restore encryption. Try again or use another client.',
    'settings.backToChat': 'Back to chat',
    'settings.roomTitle': 'Channel settings',
    'settings.roomDescription': 'Name and topic for this channel.',
    'settings.roomId': 'Room ID',
    'settings.roomName': 'Channel name',
    'settings.roomTopic': 'Channel topic',
    'settings.roomReadOnlyHint':
      'You can view settings but cannot change name or topic.',
    'settings.spaceTitle': 'Space settings',
    'settings.spaceDescription': 'Basic settings for this space.',
    'settings.spaceId': 'Space ID',
    'settings.spaceName': 'Space name',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',
    'settings.saved': 'Settings saved',
    'settings.spaceTopic': 'Space topic',
    'settings.spaceAvatar': 'Space icon',
    'settings.spaceAvatarRemove': 'Remove icon',
    'settings.spaceNavGeneral': 'General',
    'settings.spaceNavRoles': 'Roles',
    'settings.spaceNavPermissions': 'Permissions',
    'settings.spaceNavMembers': 'Members',
    'settings.spaceGeneralProfile': 'Profile',
    'settings.spaceGeneralProfileEdit': 'Edit',
    'settings.spaceGeneralOptions': 'Options',
    'settings.spaceAccess': 'Space access',
    'settings.spaceAccessHint':
      'Change how people can join the space.',
    'settings.spaceAccessPublic': 'Public',
    'settings.spaceAccessInvite': 'Invite only',
    'settings.spaceAccessKnock': 'Knock & invite',
    'settings.spacePublishDirectory': 'Publish to directory',
    'settings.spacePublishDirectoryHint':
      'List the space in the public directory so others can discover it.',
    'settings.spaceGeneralAddresses': 'Addresses',
    'settings.spacePublishedAddresses': 'Published addresses',
    'settings.spacePublishedAddressesHint':
      'If access is public, published addresses are used to join.',
    'settings.spaceMainAlias': 'Main',
    'settings.spaceNoPublishedAddress': 'No published address yet.',
    'settings.spaceLocalAddresses': 'Local addresses',
    'settings.spaceLocalAddressesHint':
      'Set a local address so users can join through your homeserver.',
    'settings.spaceExpand': 'Expand',
    'settings.spaceCollapse': 'Collapse',
    'settings.spaceGeneralAdvanced': 'Advanced options',
    'settings.spaceUpgrade': 'Upgrade space',
    'settings.spaceUpgradeHint': 'Current version: {version}.',
    'settings.spaceUpgradeAvailable':
      'Recommended version: {version}.',
    'settings.spaceUpgradeButton': 'Upgrade',
    'settings.spaceOldSpace': 'Old space',
    'settings.spaceRolesHint':
      'Roles and permissions use Matrix power levels (Cinny/Sable compatible).',
    'settings.spaceRolesDragHint':
      'Drag roles to change hierarchy (top = highest).',
    'settings.spaceRoleCreate': 'Create role',
    'settings.spaceRoleNamePlaceholder': 'Role name',
    'settings.spaceRoleNameLabel': 'Role name',
    'settings.spaceRolePowerLevel': 'Power level',
    'settings.spaceRoleEdit': 'Edit',
    'settings.spaceRoleDelete': 'Delete',
    'settings.spaceRoleFounder': 'Founder',
    'settings.spaceFoundersTitle': 'Founders',
    'settings.spaceFoundersHint':
      'The space creator has full permissions and cannot be reassigned.',
    'settings.spaceRoleColor': 'Color',
    'settings.spacePlPermissionsTitle': 'Permissions',
    'settings.spacePlRoleAndAbove': '{name} & Above',
    'settings.spacePlGroupUsers': 'Users',
    'settings.spacePlGroupManage': 'Manage',
    'settings.spacePlGroupModeration': 'Moderation',
    'settings.spacePlGroupSpaceOverview': 'Space overview',
    'settings.spacePlGroupSettings': 'Settings',
    'settings.spacePlGroupOther': 'Other',
    'settings.spacePlDefaultPower': 'Default power',
    'settings.spacePlManageRooms': 'Manage space rooms',
    'settings.spacePlMessageEvents': 'Message events',
    'settings.spacePlInvite': 'Invite',
    'settings.spacePlKick': 'Kick',
    'settings.spacePlBan': 'Ban',
    'settings.spacePlSpaceAvatar': 'Space avatar',
    'settings.spacePlSpaceName': 'Space name',
    'settings.spacePlSpaceTopic': 'Space topic',
    'settings.spacePlRedact': 'Redact messages',
    'settings.spacePlChangeAccess': 'Change space access',
    'settings.spacePlPublishAddress': 'Publish address',
    'settings.spacePlChangeAllPermission': 'Change all permission',
    'settings.spacePlEditPowerLevels': 'Edit power levels',
    'settings.spacePlUpgradeSpace': 'Upgrade space',
    'settings.spacePlOtherSettings': 'Other settings',
    'settings.spacePlManageEmojis': 'Manage emojis & stickers',
    'settings.spacePlServerAcls': 'Change server ACLs',
    'settings.spaceVisibleRooms': 'Visible channels',
    'settings.spaceVisibleRoomsAll': 'All channels',
    'settings.account': 'Account',
    'settings.space': 'Space',
    'layout.spaceMembersCount': '{count} members',
    'spaces.newTitle': 'Create space',
    'spaces.newDescription':
      'Create a Matrix space on your homeserver.',
    'spaces.name': 'Space name',
    'spaces.createSubmit': 'Create space',
    'rooms.createTitle': 'Create room',
    'rooms.createSpaceTitle': 'Create subspace',
    'rooms.createSpaceDescription':
      'Create a nested Matrix space and link it to the parent.',
    'rooms.createSpaceSubmit': 'Create subspace',
    'rooms.createInSpaceHint': 'Will be added to the current space.',
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

  function translateText(
    key: string,
    placeholders?: Record<string, string>
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
