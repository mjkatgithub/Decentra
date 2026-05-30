export type MessageNotifyMode = 'visual' | 'sound'

const STORAGE_KEY = 'decentra.messageNotify.mode'

function isMessageNotifyMode(value: string): value is MessageNotifyMode {
  return value === 'visual' || value === 'sound'
}

export function useMessageNotifyPreference() {
  const mode = useState<MessageNotifyMode>(
    'messageNotifyMode',
    () => 'sound',
  )
  const initialized = useState<boolean>(
    'messageNotifyModeInitialized',
    () => false,
  )

  function initializeMessageNotifyPreference(): void {
    if (!import.meta.client || initialized.value) {
      return
    }
    const savedMode = window.localStorage.getItem(STORAGE_KEY)
    if (savedMode && isMessageNotifyMode(savedMode)) {
      mode.value = savedMode
    }
    initialized.value = true
  }

  function setMessageNotifyMode(nextMode: MessageNotifyMode): void {
    mode.value = nextMode
    if (import.meta.client) {
      window.localStorage.setItem(STORAGE_KEY, nextMode)
    }
  }

  function getMessageNotifyMode(): MessageNotifyMode {
    return mode.value
  }

  function isMessageNotifySoundEnabled(): boolean {
    return mode.value === 'sound'
  }

  return {
    mode,
    initializeMessageNotifyPreference,
    setMessageNotifyMode,
    getMessageNotifyMode,
    isMessageNotifySoundEnabled,
  }
}
