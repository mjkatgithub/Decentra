import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/integration/**/*.spec.ts', 'tests/integration/**/*.nuxt.spec.ts']
  }
})
