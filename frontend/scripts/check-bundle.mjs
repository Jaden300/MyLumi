#!/usr/bin/env node
/* Guards the code split around the 3D body model.

   three.js plus the R3F runtime is by a wide margin the largest dependency in
   this project - larger than the app itself - and it is reached from exactly
   one check-in step. A single static import of PainBodyCanvas from anywhere
   outside PainBodySurface would pull all of it into the entry bundle, and
   nothing would break: the app would keep working, every page would just get
   slower to load. That is precisely the kind of regression nobody notices, so
   it is checked here rather than left to review.

   Run after `vite build`, against dist/. */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist', 'assets');

// Strings that only three.js defines. If one appears in the entry chunk, the
// library was bundled into it.
const THREE_MARKERS = ['WebGLRenderer', 'PerspectiveCamera'];

if (!existsSync(DIST)) {
  console.error('check:bundle - no dist/assets. Run `npm run build` first.');
  process.exit(1);
}

const files = readdirSync(DIST).filter((f) => f.endsWith('.js'));
const entry = files.find((f) => f.startsWith('index-'));

if (!entry) {
  console.error('check:bundle - no entry chunk found in dist/assets.');
  process.exit(1);
}

const source = readFileSync(join(DIST, entry), 'utf8');
const leaked = THREE_MARKERS.filter((marker) => source.includes(marker));

if (leaked.length > 0) {
  console.error(
    `check:bundle - three.js leaked into the entry chunk (${entry}).\n` +
      `  Found: ${leaked.join(', ')}\n` +
      '  Something now imports the 3D stack statically. The only file allowed to\n' +
      '  reach PainBodyCanvas is PainBodySurface, via its dynamic import.',
  );
  process.exit(1);
}

const threeChunk = files.find((f) => f.startsWith('three-'));
if (!threeChunk) {
  console.error(
    'check:bundle - no separate three chunk was emitted.\n' +
      '  Expected manualChunks in vite.config.js to isolate it.',
  );
  process.exit(1);
}

console.log(`check:bundle - clean, three.js is isolated in ${threeChunk}.`);
