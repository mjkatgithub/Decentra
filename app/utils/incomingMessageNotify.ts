import type { RoomNotificationLevel } from '~/utils/matrixNotificationRules'
import type { RoomUnreadState } from '~/utils/roomUnread'

export function shouldNotifyIncomingMessage(options: {
  roomId: string
  selectedRoomId: string | null
  notificationLevel: RoomNotificationLevel
  current: RoomUnreadState
  previous?: RoomUnreadState
  soundEnabled: boolean
}): boolean {
  if (!options.soundEnabled) {
    return false
  }
  if (options.notificationLevel === 'mute') {
    return false
  }
  if (options.roomId === options.selectedRoomId) {
    return false
  }
  if (!options.previous) {
    return false
  }

  const { current, previous, notificationLevel } = options

  if (notificationLevel === 'mentions') {
    return (
      current.hasMentionUnread &&
      current.highlightCount > previous.highlightCount
    )
  }

  return (
    current.totalCount > previous.totalCount ||
    current.highlightCount > previous.highlightCount
  )
}
