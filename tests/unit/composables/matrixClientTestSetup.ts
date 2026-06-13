import { computed, ref } from 'vue'
import { vi } from 'vitest'

/** Reset module mocks before each useMatrixClient spec (avoids page-spec leakage). */
export function prepareMatrixClientSpecFile(): void {
  vi.unmock('~/composables/useMatrixClient')
  vi.resetModules()
  vi.clearAllMocks()
}

export function setupMatrixClientTestGlobals(options?: {
  initialRestoreStatus?: 'idle' | 'loading' | 'success' | 'failure'
}): void {
  const stateMap = new Map<string, { value: unknown }>()
  const initialRestoreStatus = options?.initialRestoreStatus ?? 'success'

  const useStateMock = (
    key: string,
    init: () => unknown,
  ) => {
    if (!stateMap.has(key)) {
      const initial =
        key === 'matrix-client-restore-status'
          ? initialRestoreStatus
          : init()
      stateMap.set(key, ref(initial))
    }
    return stateMap.get(key)
  }

  ;(globalThis as Record<string, unknown>).useState = useStateMock
  ;(globalThis as Record<string, unknown>).computed = computed
  localStorage.clear()
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear()
  }
}

export function setupFreshMatrixClientGlobals(): void {
  const stateMap = new Map<string, { value: unknown }>()
  ;(globalThis as Record<string, unknown>).useState = (
    key: string,
    init: () => unknown,
  ) => {
    if (!stateMap.has(key)) {
      stateMap.set(key, ref(init()))
    }
    return stateMap.get(key)
  }
  ;(globalThis as Record<string, unknown>).computed = computed
}
