import chai from 'chai'

chai.should()

const englishMessages: Record<string, string> = {
  'layout.members': 'Members',
  'layout.noMembers': 'No members found',
  'layout.online': 'Online',
  'layout.away': 'Away',
  'layout.offline': 'Offline',
  'layout.unknown': 'Unknown',
  'chat.noRooms': 'No rooms',
  'layout.channels': 'Channels'
}

;(globalThis as Record<string, unknown>).useAppI18n = () => ({
  locale: { value: 'en' },
  locales: ['en', 'de'],
  setLocale: () => undefined,
  translateText: (key: string) => englishMessages[key] ?? key
})
