import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateToMock = vi.fn()
const ensureSessionRestoreCompletedMock = vi.fn(async () => undefined)
const isLoggedInState = { value: false }

describe('auth middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    ;(globalThis as Record<string, unknown>).defineNuxtRouteMiddleware = (
      handler: (...args: unknown[]) => unknown
    ) => handler
    ;(globalThis as Record<string, unknown>).navigateTo = navigateToMock
    ;(globalThis as Record<string, unknown>).useAuthSessionStore = () => ({
      isLoggedIn: isLoggedInState.value,
      ensureSessionRestoreCompleted: ensureSessionRestoreCompletedMock
    })
    isLoggedInState.value = false
  })

  it('redirects to root when user is unauthenticated', async () => {
    const middleware = (await import('~/middleware/auth.global')).default
    await middleware({ path: '/chat' })

    expect(ensureSessionRestoreCompletedMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith('/')
  })

  it('allows navigation when user is authenticated', async () => {
    isLoggedInState.value = true
    const middleware = (await import('~/middleware/auth.global')).default
    await middleware({ path: '/chat' })

    expect(ensureSessionRestoreCompletedMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('skips redirect checks for public routes', async () => {
    const middleware = (await import('~/middleware/auth.global')).default
    await middleware({ path: '/login' })

    expect(ensureSessionRestoreCompletedMock).not.toHaveBeenCalled()
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
