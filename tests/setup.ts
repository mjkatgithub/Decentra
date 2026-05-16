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
}

const globalScope = globalThis as Record<string, unknown>
globalScope.ref = ref
globalScope.computed = computed
globalScope.watch = watch

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
