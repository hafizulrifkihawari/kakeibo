import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts so unit tests do not start the Workers runtime.
export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
