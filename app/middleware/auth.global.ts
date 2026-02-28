const protectedPathPrefixes = [
  '/chat',
  '/settings',
  '/spaces/new'
]

export default defineNuxtRouteMiddleware(async (to) => {
  if (typeof window === 'undefined') {
    return
  }

  const requiresAuth = protectedPathPrefixes.some((pathPrefix) => {
    return to.path === pathPrefix || to.path.startsWith(`${pathPrefix}/`)
  })
  if (!requiresAuth) {
    return
  }

  const { isLoggedIn, ensureSessionRestoreCompleted } = useMatrixClient()
  await ensureSessionRestoreCompleted()

  if (!isLoggedIn.value) {
    return navigateTo('/')
  }
})
