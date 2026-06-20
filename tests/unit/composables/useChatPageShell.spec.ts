import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useChatPageShell } from '~/composables/chat/useChatPageShell'
import { HOME_SPACE_ID } from '~/utils/spaceUnread'

vi.stubGlobal('navigateTo', vi.fn(async () => undefined))
vi.stubGlobal('useRoute', () => ({ query: {} }))

function createShellOptions() {
  return {
    client: ref<Record<string, unknown> | null>(null),
    matrixRooms: ref<Array<Record<string, unknown>>>([]),
    selectedSpaceId: ref<string | null>(HOME_SPACE_ID),
    selectedRoomId: ref<string | null>('!room:example.org'),
    pendingRootSpaceId: ref<string | null>(null),
    leftSidebarOpen: ref(true),
    rightSidebarOpen: ref(true),
    isMobile: ref(false),
    spaceRailExpanded: ref(false),
    onboardingSubView: ref<'dm' | 'public' | null>('dm'),
    suppressAutoRoomSelect: ref(false),
    refreshRooms: vi.fn(),
    clearLoadMessagesTimer: vi.fn(),
    clearThreadNavRefreshTimer: vi.fn(),
  }
}

describe('useChatPageShell', () => {
  it('selectSpace clears room, onboarding, and suppresses auto-pick', () => {
    const options = createShellOptions()
    const { selectSpace } = useChatPageShell(options)

    selectSpace('!space:example.org')

    expect(options.selectedSpaceId.value).toBe('!space:example.org')
    expect(options.selectedRoomId.value).toBeNull()
    expect(options.onboardingSubView.value).toBeNull()
    expect(options.suppressAutoRoomSelect.value).toBe(true)
  })

  it('selectSpace closes left sidebar on mobile', () => {
    const options = createShellOptions()
    options.isMobile.value = true
    const { selectSpace } = useChatPageShell(options)

    selectSpace('!space:example.org')

    expect(options.leftSidebarOpen.value).toBe(false)
  })
})
