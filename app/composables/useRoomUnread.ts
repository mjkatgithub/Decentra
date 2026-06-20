import { RoomEvent } from 'matrix-js-sdk'
import type { MatrixClient } from 'matrix-js-sdk'
import { buildUnreadByRoomId } from '~/utils/roomUnread'

const MARK_ROOM_READ_DEBOUNCE_MS = 300
const REFRESH_UNREAD_DEBOUNCE_MS = 120

export function useRoomUnread(options: {
  client: Ref<MatrixClient | null>
  matrixRooms: Ref<Array<Record<string, unknown>>>
  selectedRoomId: Ref<string | null>
  markRoomAsRead: (roomId: string) => Promise<void>
}) {
  const unreadVersion = ref(0)
  let markReadTimerId: number | null = null
  let refreshUnreadTimerId: number | null = null

  function refreshUnread(): void {
    unreadVersion.value += 1
  }

  function scheduleRefreshUnread(): void {
    if (!import.meta.client) {
      refreshUnread()
      return
    }
    if (refreshUnreadTimerId !== null) {
      window.clearTimeout(refreshUnreadTimerId)
    }
    refreshUnreadTimerId = window.setTimeout(() => {
      refreshUnreadTimerId = null
      refreshUnread()
    }, REFRESH_UNREAD_DEBOUNCE_MS)
  }

  const unreadByRoomId = computed(() => {
    unreadVersion.value
    return buildUnreadByRoomId(options.matrixRooms.value, {
      activeRoomId: options.selectedRoomId.value,
    })
  })

  async function markActiveRoomRead(): Promise<void> {
    const roomId = options.selectedRoomId.value
    if (!roomId) {
      return
    }
    await options.markRoomAsRead(roomId)
    refreshUnread()
  }

  function scheduleMarkActiveRoomRead(): void {
    if (!import.meta.client) {
      void markActiveRoomRead()
      return
    }
    const roomId = options.selectedRoomId.value
    if (!roomId) {
      return
    }
    if (markReadTimerId !== null) {
      window.clearTimeout(markReadTimerId)
    }
    markReadTimerId = window.setTimeout(() => {
      markReadTimerId = null
      void markActiveRoomRead()
    }, MARK_ROOM_READ_DEBOUNCE_MS)
  }

  watch(
    () => options.selectedRoomId.value,
    () => {
      refreshUnread()
    },
  )

  watch(
    () => options.client.value,
    (matrixClient, _previousClient, onCleanup) => {
      if (!matrixClient) {
        return
      }

      const receiptHandler = (): void => {
        scheduleRefreshUnread()
      }

      const unreadNotificationsHandler = (): void => {
        scheduleRefreshUnread()
      }

      const timelineHandler = (
        _timelineEvent: unknown,
        room: { roomId?: string } | undefined,
      ): void => {
        if (!room?.roomId) {
          return
        }
        if (room.roomId === options.selectedRoomId.value) {
          return
        }
        scheduleRefreshUnread()
      }

      matrixClient.on(RoomEvent.Receipt, receiptHandler)
      matrixClient.on(
        RoomEvent.UnreadNotifications,
        unreadNotificationsHandler,
      )
      matrixClient.on(RoomEvent.Timeline, timelineHandler)

      onCleanup(() => {
        matrixClient.off(RoomEvent.Receipt, receiptHandler)
        matrixClient.off(
          RoomEvent.UnreadNotifications,
          unreadNotificationsHandler,
        )
        matrixClient.off(RoomEvent.Timeline, timelineHandler)
        if (markReadTimerId !== null) {
          window.clearTimeout(markReadTimerId)
          markReadTimerId = null
        }
        if (refreshUnreadTimerId !== null) {
          window.clearTimeout(refreshUnreadTimerId)
          refreshUnreadTimerId = null
        }
      })
    },
    { immediate: true },
  )

  return {
    unreadByRoomId,
    refreshUnread,
    markActiveRoomRead,
    scheduleMarkActiveRoomRead,
  }
}
