import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Pin the 3D stack into its own chunk. The dynamic import in
        // PainBodySurface is what keeps it out of the entry bundle; naming the
        // chunk keeps it stable across builds, so it caches independently of
        // app code that changes far more often. It is by a wide margin the
        // largest dependency in the project and is reached from exactly one
        // check-in step, so it must never be merged back into the main bundle.
        manualChunks: (id) =>
          /node_modules\/(three|@react-three)\//.test(id) ? 'three' : undefined,
      },
    },
  },
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
