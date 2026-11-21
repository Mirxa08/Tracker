// The DST tests are meaningless in a zone without transitions, so pin the test timezone.
process.env.TZ = 'Europe/London'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/Tracker/',
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    // theme.test.ts, zorder.test.ts and sakuga.test.ts read these stylesheets as text; vitest
    // otherwise blanks CSS imports. Anchored to a path segment and the file extension (plus an
    // optional ?query such as ?raw), so only these exact files match.
    // tailwind.css is deliberately NOT here: it is the Tailwind entry, it is imported only by
    // main.tsx (which no test loads), and nothing asserts on its text.
    css: { include: [/[\\/](?:theme|timeline|event-bar|detail|dialog|sakuga)\.css(?:\?.*)?$/] },
  },
})
