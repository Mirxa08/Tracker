// The DST tests are meaningless in a zone without transitions, so pin the test timezone.
process.env.TZ = 'Europe/London'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Tracker/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
