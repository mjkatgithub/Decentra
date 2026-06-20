import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, watchEffect } from 'vue'
import { mount } from '@vue/test-utils'
import IndexPage from '~/pages/index.vue'

const navigateToMock = vi.fn(async () => undefined)

const UButtonStub = {
  template: '<a><slot /></a>'
}

const UCardStub = {
  template: '<div><slot /></div>'
}

describe('index page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as Record<string, unknown>).watchEffect = watchEffect
    ;(globalThis as Record<string, unknown>).navigateTo = navigateToMock
    ;(globalThis as Record<string, unknown>).useAppI18n = () => ({
      translateText: (key: string) => {
        const messages: Record<string, string> = {
          'common.loading': 'Loading...',
          'landing.kicker': 'OPEN AND FEDERATED TEAM CHAT',
          'landing.title': 'Own your collaboration with Decentra.',
          'landing.subtitle': 'Keep communication in your control while staying connected through Matrix.',
          'landing.loginCta': 'Sign in',
          'landing.signupCta': 'Sign up',
          'auth.signIn': 'Sign in',
          'auth.signUp': 'Sign up'
        }
        return messages[key] ?? key
      }
    })
  })

  function mountIndexPage(options: {
    isLoggedIn: boolean;
    isSessionRestoreFinished: boolean;
  }) {
    ;(globalThis as Record<string, unknown>).useMatrixClient = () => ({
      isLoggedIn: ref(options.isLoggedIn),
      isSessionRestoreFinished: ref(options.isSessionRestoreFinished)
    })

    return mount(IndexPage, {
      global: {
        stubs: {
          UButton: UButtonStub,
          UCard: UCardStub
        }
      }
    })
  }

  it('shows loading text while restore is running', () => {
    const wrapper = mountIndexPage({
      isLoggedIn: false,
      isSessionRestoreFinished: false
    })

    wrapper.text().includes('Loading...').should.equal(true)
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('shows landing content after restore when logged out', () => {
    const wrapper = mountIndexPage({
      isLoggedIn: false,
      isSessionRestoreFinished: true
    })

    wrapper.text().includes('Own your collaboration with Decentra.')
      .should.equal(true)
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('shows sign in and sign up actions', () => {
    const wrapper = mountIndexPage({
      isLoggedIn: false,
      isSessionRestoreFinished: true
    })

    expect(wrapper.text().includes('Sign in')).toBe(true)
    expect(wrapper.text().includes('Sign up')).toBe(true)
  })

  it('redirects to chat after restore when logged in', async () => {
    mountIndexPage({
      isLoggedIn: true,
      isSessionRestoreFinished: true
    })

    await Promise.resolve()

    expect(navigateToMock).toHaveBeenCalledWith('/chat')
  })
})
