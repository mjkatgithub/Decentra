import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'happy-dom',
    pool: 'forks',
    fileParallelism: false,
    include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['app/**/*.{ts,vue}'],
      exclude: ['node_modules', 'tests', '**/*.spec.ts', '**/*.test.ts'],
      thresholds: {
        lines: 10,
        functions: 20,
        branches: 20,
        statements: 10
      }
    }
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url))
    }
  }
})
