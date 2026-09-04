import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    /* Do NOT emit <link rel="modulepreload"> for lazily-imported chunks.
       Vite adds those by default to hide latency, but for the 3D stack it
       defeats the entire split: the browser would fetch ~980KB of three.js
       from index.html on the dashboard, for every visitor, whether or not they
       ever open the pain step. Keeping the chunk out of the entry bundle is
       only half the job if the page then asks for it anyway. Measured, not
       assumed - the chunk was being fetched on first paint until this was set,
       and scripts/check-bundle.mjs now fails the build if it returns. */
    modulePreload: false,
    rollupOptions: {
      output: {
        /* Pin three.js itself into its own chunk, so it caches independently of
           app code that changes far more often.

           Deliberately NOT @react-three/*. Those packages depend on React, and
           naming them here dragged React into the same chunk - at which point
           the entry bundle had to import that chunk statically to get React,
           and the whole 3D stack was fetched on first paint again. The dynamic
           import in PainBodySurface is what actually defers the code; this rule
           only decides where the largest dependency lands. Verified by watching
           the network on the dashboard, not by reading the chunk listing. */
        manualChunks: (id) => (/node_modules\/three\//.test(id) ? 'three' : undefined),
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
