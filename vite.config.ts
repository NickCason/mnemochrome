/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/mnemochrome/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  test: {
    environment: 'jsdom',
  },
})
