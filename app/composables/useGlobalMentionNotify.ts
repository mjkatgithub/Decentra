import type { MatrixClient } from 'matrix-js-sdk'
import { RoomEvent } from 'matrix-js-sdk'
import {
  formatDocumentTitle,
  stripDocumentTitlePrefix,
} from '~/utils/documentTitle'
import { shouldNotifyIncomingMessage } from '~/utils/incomingMessageNotify'
import { playMessageNotifySound } from '~/utils/messageNotifySound'
import type { RoomNotificationLevel } from '~/utils/matrixNotificationRules'
import { summarizeGlobalUnread } from '~/utils/roomUnread'
import type { RoomUnreadState } from '~/utils/roomUnread'
import { useMessageNotifyPreference } from '~/composables/useMessageNotifyPreference'

const INCOMING_NOTIFY_DEBOUNCE_MS = 4000
const DEFAULT_DOCUMENT_TITLE = 'Decentra'

export function useGlobalMentionNotify(options: {
  client: Ref<MatrixClient | null>
  unreadByRoomId: Ref<Record<string, RoomUnreadState>>
  selectedRoomId: Ref<string | null>
  getRoomDisplayName: (roomId: string) => string
  getRoomNotificationLevel?: (roomId: string) => RoomNotificationLevel
}) {
  const baseDocumentTitle = ref(DEFAULT_DOCUMENT_TITLE)
  const lastMentionNotifyAtByRoom = new Map<string, number>()
  const lastSoundNotifyAtByRoom = new Map<string, number>()
  const { initializeMessageNotifyPreference, isMessageNotifySoundEnabled } =
    useMessageNotifyPreference()

  function applyDocumentTitle(): void {
    if (!import.meta.client) {
      return
    }
    const { unreadRoomCount } = summarizeGlobalUnread(
      options.unreadByRoomId.value,
    )
    document.title = formatDocumentTitle(
      baseDocumentTitle.value,
      unreadRoomCount > 0,
    )
  }

  function resolveRoomNotificationLevel(roomId: string): RoomNotificationLevel {
    return options.getRoomNotificationLevel?.(roomId) ?? 'default'
  }

  function maybePlayIncomingSound(
    roomId: string,
    previousUnread?: Record<string, RoomUnreadState>,
  ): void {
    if (!import.meta.client) {
      return
    }
    const current = options.unreadByRoomId.value[roomId]
    if (!current) {
      return
    }
    const previous = previousUnread?.[roomId]
    if (
      !shouldNotifyIncomingMessage({
        roomId,
        selectedRoomId: options.selectedRoomId.value,
        notificationLevel: resolveRoomNotificationLevel(roomId),
        current,
        previous,
        soundEnabled: isMessageNotifySoundEnabled(),
      })
    ) {
      return
    }

    const nowMs = Date.now()
    const lastAt = lastSoundNotifyAtByRoom.get(roomId) ?? 0
    if (nowMs - lastAt < INCOMING_NOTIFY_DEBOUNCE_MS) {
      return
    }
    lastSoundNotifyAtByRoom.set(roomId, nowMs)
    void playMessageNotifySound()
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
    if (nowMs - lastAt < INCOMING_NOTIFY_DEBOUNCE_MS) {
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

  function handleUnreadChange(
    nextUnread: Record<string, RoomUnreadState>,
    previousUnread?: Record<string, RoomUnreadState>,
  ): void {
    applyDocumentTitle()
    if (!previousUnread) {
      return
    }
    for (const [roomId, state] of Object.entries(nextUnread)) {
      maybePlayIncomingSound(roomId, previousUnread)

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
  }

  watch(
    () => options.unreadByRoomId.value,
    (nextUnread, previousUnread) => {
      handleUnreadChange(nextUnread, previousUnread)
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
    initializeMessageNotifyPreference()
    baseDocumentTitle.value = stripDocumentTitlePrefix(
      document.title,
      DEFAULT_DOCUMENT_TITLE,
    )
    applyDocumentTitle()
  })

  return {
    applyDocumentTitle,
  }
}
