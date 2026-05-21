export const TYPING_SERVER_TIMEOUT_MS = 30_000
/** Must be greater than {@link TYPING_REFRESH_MS} so refresh can extend typing. */
export const TYPING_IDLE_MS = 12_000
export const TYPING_REFRESH_MS = 5_000

export type SendTypingFn = (
  roomId: string,
  isTyping: boolean,
  timeoutMs: number,
) => Promise<unknown>

export interface ComposerTypingNotifierOptions {
  getRoomId: () => string | null
  sendTyping: SendTypingFn
  isEnabled: () => boolean
}

export interface ComposerTypingNotifier {
  notifyInput: () => void
  notifyStopped: () => void
}

export function createComposerTypingNotifier(
  options: ComposerTypingNotifierOptions,
): ComposerTypingNotifier {
  let isTypingActive = false
  let idleTimerId: ReturnType<typeof setTimeout> | null = null
  let refreshTimerId: ReturnType<typeof setTimeout> | null = null

  function clearIdleTimer(): void {
    if (idleTimerId !== null) {
      clearTimeout(idleTimerId)
      idleTimerId = null
    }
  }

  function clearRefreshTimer(): void {
    if (refreshTimerId !== null) {
      clearTimeout(refreshTimerId)
      refreshTimerId = null
    }
  }

  function clearTimers(): void {
    clearIdleTimer()
    clearRefreshTimer()
  }

  async function publishTyping(isTyping: boolean): Promise<void> {
    const roomId = options.getRoomId()
    if (!roomId || !options.isEnabled()) {
      return
    }
    try {
      await options.sendTyping(
        roomId,
        isTyping,
        TYPING_SERVER_TIMEOUT_MS,
      )
    } catch {
      // Homeserver may disable typing; fail silently.
    }
  }

  function scheduleRefresh(): void {
    clearRefreshTimer()
    refreshTimerId = setTimeout(() => {
      refreshTimerId = null
      if (!isTypingActive) {
        return
      }
      void publishTyping(true)
      scheduleRefresh()
    }, TYPING_REFRESH_MS)
  }

  function scheduleIdleStop(): void {
    clearIdleTimer()
    idleTimerId = setTimeout(() => {
      idleTimerId = null
      notifyStopped()
    }, TYPING_IDLE_MS)
  }

  function notifyInput(): void {
    if (!options.isEnabled() || !options.getRoomId()) {
      return
    }
    scheduleIdleStop()
    if (isTypingActive) {
      scheduleRefresh()
      return
    }
    isTypingActive = true
    void publishTyping(true)
    scheduleRefresh()
  }

  function notifyStopped(): void {
    clearTimers()
    if (!isTypingActive) {
      return
    }
    isTypingActive = false
    void publishTyping(false)
  }

  return { notifyInput, notifyStopped }
}
