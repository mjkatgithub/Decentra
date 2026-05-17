import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import {
  HOVER_CAPABLE_MEDIA_QUERY,
  readHoverCapableFromWindow,
  useHoverCapable
} from '~/composables/useHoverCapable'

function createMatchMediaMock(matches: boolean) {
  const listeners = new Set<() => void>()
  return {
    matches,
    media: HOVER_CAPABLE_MEDIA_QUERY,
    addEventListener: (_event: string, listener: () => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener)
    },
    dispatchChange(nextMatches: boolean) {
      Object.defineProperty(this, 'matches', { value: nextMatches })
      for (const listener of listeners) {
        listener()
      }
    }
  }
}

describe('readHoverCapableFromWindow', () => {
  it('returns true when matchMedia is unavailable', () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      configurable: true
    })
    expect(readHoverCapableFromWindow()).to.equal(true)
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      configurable: true
    })
  })
})

describe('useHoverCapable', () => {
  let mediaQueryMock: ReturnType<typeof createMatchMediaMock>

  beforeEach(() => {
    mediaQueryMock = createMatchMediaMock(true)
    vi.stubGlobal('matchMedia', () => mediaQueryMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reflects initial matchMedia matches on mount', async () => {
    const Probe = defineComponent({
      setup() {
        const { canUseHover } = useHoverCapable()
        return { canUseHover }
      },
      template: '<span data-probe>{{ canUseHover }}</span>'
    })

    const wrapper = mount(Probe)
    await nextTick()
    expect(wrapper.get('[data-probe]').text()).to.equal('true')
  })

  it('updates when the media query changes', async () => {
    mediaQueryMock = createMatchMediaMock(false)
    vi.stubGlobal('matchMedia', () => mediaQueryMock)

    const Probe = defineComponent({
      setup() {
        const { canUseHover } = useHoverCapable()
        return { canUseHover }
      },
      template: '<span data-probe>{{ canUseHover }}</span>'
    })

    const wrapper = mount(Probe)
    await nextTick()
    expect(wrapper.get('[data-probe]').text()).to.equal('false')

    mediaQueryMock.dispatchChange(true)
    await nextTick()
    expect(wrapper.get('[data-probe]').text()).to.equal('true')
  })
})
