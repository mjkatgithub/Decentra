import chai from 'chai'
import { computed, ref, watch } from 'vue'

chai.should()

const englishMessages: Record<string, string> = {
  'layout.members': 'Members',
  'layout.noMembers': 'No members found',
  'layout.online': 'Online',
  'layout.away': 'Away',
  'layout.offline': 'Offline',
  'layout.unknown': 'Unknown',
  'chat.noRooms': 'No rooms',
  'layout.channels': 'Channels',
  'layout.noRoomsInSpace': 'No channels in this space',
  'layout.openSpaceSettings': 'Space settings',
  'invite.spaceMenu': 'Invite to space',
  'spaceHome.welcome': 'Welcome to {space}',
  'spaceHome.subtitle': 'Pick a channel or manage this space.',
  'spaceHome.emptyChannels': 'No channels joined yet.',
  'spaceHome.channelsSection': 'Channels',
  'spaceHome.lobby': 'Lobby',
  'spaceHome.joinChannel': 'Join',
  'spaceHome.joinSubspace': 'Join subspace',
  'spaceHome.openChannel': 'Open {name}',
  'spaceHome.emptySubspaceChannels':
    'Join this subspace to see its channels.',
  'layout.expandCategory': 'Expand category',
  'layout.collapseCategory': 'Collapse category',
  'layout.channelUnreadAria': 'Unread messages in {name}',
  'layout.channelMentionUnreadAria': 'Mentioned in {name}',
  'layout.spaceUnreadAria': '{count} unread messages in space {name}',
  'layout.spaceMentionUnreadAria': '{count} mentions in space {name}',
  'layout.threadUnreadAria': 'Unread thread {title}',
  'layout.threadMentionUnreadAria': 'Mentioned in thread {title}',
  'chat.noMessages': 'No messages yet',
  'chat.loadOlder': 'Load older',
  'chat.sendImage': 'Send image',
  'chat.attachMedia': 'Attach file',
  'chat.sendVideo': 'Send video',
  'chat.sendAudio': 'Send audio',
  'chat.audioUploading': 'Uploading audio…',
  'chat.audioInvalidType':
    'Only MP3, M4A, OGG, WAV, and WebM audio files are supported.',
  'chat.audioTooLarge': 'Audio must be {maxMb} MB or smaller.',
  'chat.audioUploadFailed': 'Failed to upload audio.',
  'chat.imageUploading': 'Uploading image…',
  'chat.videoInvalidType': 'Only MP4 and WebM videos are supported.',
  'chat.videoTooLarge': 'Video must be {maxMb} MB or smaller.',
  'chat.videoUploadFailed': 'Failed to upload video.',
  'chat.videoLoading': 'Loading video…',
  'chat.recordVoice': 'Record voice message',
  'chat.recording': 'Recording',
  'chat.voicePreview': 'Voice preview',
  'chat.sendVoice': 'Send voice',
  'chat.microphonePermissionDenied': 'Microphone access was denied.',
  'chat.replyVoice': 'Voice message',
  'chat.voicePlay': 'Play voice message',
}

const globalScope = globalThis as Record<string, unknown>
globalScope.ref = ref
globalScope.computed = computed
globalScope.watch = watch
globalScope.useState = <T>(key: string, init: () => T) => {
  const state = ref(init())
  return state
}

globalScope.useAppI18n = () => ({
  locale: { value: 'en' },
  locales: ['en', 'de'],
  setLocale: () => undefined,
  translateText: (
    key: string,
    placeholders?: Record<string, string>,
  ) => {
    let text = englishMessages[key] ?? key
    if (placeholders) {
      for (const [placeholder, value] of Object.entries(placeholders)) {
        text = text.replaceAll(`{${placeholder}}`, value)
      }
    }
    return text
  },
})
