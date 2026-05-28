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
  'layout.expandCategory': 'Expand category',
  'layout.collapseCategory': 'Collapse category',
  'layout.channelUnreadAria': 'Unread messages in {name}',
  'chat.noMessages': 'No messages yet',
  'chat.loadOlder': 'Load older',
  'chat.sendImage': 'Send image',
  'chat.attachMedia': 'Attach file',
  'chat.sendVideo': 'Send video',
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
