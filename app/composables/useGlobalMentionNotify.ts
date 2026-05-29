import type { MatrixClient } from 'matrix-js-sdk'
import { RoomEvent } from 'matrix-js-sdk'
import { summarizeGlobalUnread } from '~/utils/roomUnread'
import type { RoomUnreadState } from '~/utils/roomUnread'

const MENTION_NOTIFY_DEBOUNCE_MS = 4000
const DEFAULT_DOCUMENT_TITLE = 'Decentra'

export function useGlobalMentionNotify(options: {
  client: Ref<MatrixClient | null>
  unreadByRoomId: Ref<Record<string, RoomUnreadState>>
  selectedRoomId: Ref<string | null>
  getRoomDisplayName: (roomId: string) => string
}) {
  const baseDocumentTitle = ref(DEFAULT_DOCUMENT_TITLE)
  const lastMentionNotifyAtByRoom = new Map<string, number>()

  function applyDocumentTitle(): void {
    if (!import.meta.client) {
      return
    }
    const { unreadRoomCount, mentionRoomCount } = summarizeGlobalUnread(
      options.unreadByRoomId.value,
    )
    if (mentionRoomCount > 0) {
      document.title = `(${mentionRoomCount} @) ${baseDocumentTitle.value}`
      return
    }
    if (unreadRoomCount > 0) {
      document.title = `(${unreadRoomCount}) ${baseDocumentTitle.value}`
      return
    }
    document.title = baseDocumentTitle.value
  }

  function maybeShowMentionNotification(roomId: string): void {
    if (!import.meta.client) {
      return
    }
    if (document.visibilityState !== 'hidden') {
      return
    }
    if (typeof Notification === 'undefined') {
      return
    }
    if (Notification.permission !== 'granted') {
      return
    }
    if (roomId === options.selectedRoomId.value) {
      return
    }
    const state = options.unreadByRoomId.value[roomId]
    if (!state?.hasMentionUnread) {
      return
    }
    const nowMs = Date.now()
    const lastAt = lastMentionNotifyAtByRoom.get(roomId) ?? 0
    if (nowMs - lastAt < MENTION_NOTIFY_DEBOUNCE_MS) {
      return
    }
    lastMentionNotifyAtByRoom.set(roomId, nowMs)
    const roomName = options.getRoomDisplayName(roomId)
    try {
      new Notification(roomName, {
        body: 'You were mentioned',
        tag: `mention-${roomId}`,
      })
    } catch {
      // Permission revoked or unsupported — ignore.
    }
  }

  watch(
    () => options.unreadByRoomId.value,
    (nextUnread, previousUnread) => {
      applyDocumentTitle()
      if (!previousUnread) {
        return
      }
      for (const [roomId, state] of Object.entries(nextUnread)) {
        if (!state.hasMentionUnread) {
          continue
        }
        const previousState = previousUnread[roomId]
        if (
          previousState?.hasMentionUnread &&
          previousState.highlightCount >= state.highlightCount
        ) {
          continue
        }
        maybeShowMentionNotification(roomId)
      }
    },
    { deep: true },
  )

  watch(
    () => options.client.value,
    (matrixClient, _previousClient, onCleanup) => {
      if (!matrixClient) {
        return
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
        maybeShowMentionNotification(room.roomId)
      }

      matrixClient.on(RoomEvent.Timeline, timelineHandler)
      onCleanup(() => {
        matrixClient.off(RoomEvent.Timeline, timelineHandler)
      })
    },
    { immediate: true },
  )

  onMounted(() => {
    if (!import.meta.client) {
      return
    }
    const configuredTitle = document.title.trim()
    if (configuredTitle) {
      baseDocumentTitle.value = configuredTitle
    }
    applyDocumentTitle()
  })

  return {
    applyDocumentTitle,
  }
}
