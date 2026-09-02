import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Two projects rather than one environment for everything: the lib suite is
    // pure logic and runs in node, so it stays fast and cannot accidentally
    // start depending on a DOM. Only component and hook tests pay for jsdom.
    projects: [
      {
        extends: true,
        test: {
          name: 'lib',
          environment: 'node',
          include: ['src/lib/**/*.test.{js,jsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/{components,hooks,pages}/**/*.test.{js,jsx}'],
          setupFiles: ['./src/test/setup.js'],
        },
      },
    ],
  },
})
