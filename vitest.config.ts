import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Tests unitaires de la logique pure (services main + helpers renderer).
 * Environnement Node ; alias alignés sur tsconfig (@shared / @renderer).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
