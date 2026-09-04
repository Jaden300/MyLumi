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

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist', 'assets');
const INDEX_HTML = join(ROOT, 'dist', 'index.html');

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

/* The subtler failure, and the one that actually shipped once.

   The three chunk can be absent from the entry chunk's CONTENT while the entry
   still imports it at the top - which happens when manualChunks sweeps a shared
   dependency (React, in the case that caught this) into the same chunk. The
   entry then needs that chunk to boot, so the browser fetches the whole 3D
   stack on first paint. Every marker check above passes, the chunk listing
   looks correct, and the split is nonetheless doing nothing. */
const staticImports = [...source.matchAll(/from\s*["']\.\/([^"']+)["']/g)].map((m) => m[1]);
const eager = staticImports.filter((f) => f.startsWith('three-'));

if (eager.length > 0) {
  console.error(
    `check:bundle - the entry chunk statically imports ${eager.join(', ')}.\n` +
      '  The browser will fetch the 3D stack on first paint even though the code\n' +
      '  is split. This usually means manualChunks pulled a shared dependency\n' +
      '  into the three chunk. Narrow the rule in vite.config.js.',
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

/* Being absent from the entry chunk is only half of it. Vite emits
   <link rel="modulepreload"> for lazy chunks by default, and a preload link in
   index.html makes the browser fetch the whole thing on first paint - so the
   split still holds structurally while every visitor pays for it anyway. That
   regression is invisible in the chunk listing and was live until measured. */
if (existsSync(INDEX_HTML)) {
  const html = readFileSync(INDEX_HTML, 'utf8');
  if (html.includes(threeChunk)) {
    console.error(
      `check:bundle - index.html references ${threeChunk} directly.\n` +
        '  A preload or script tag makes every visitor download the 3D stack on\n' +
        '  first paint, which defeats the lazy import. Check `modulePreload` in\n' +
        '  vite.config.js.',
    );
    process.exit(1);
  }
}

console.log(`check:bundle - clean, three.js is isolated in ${threeChunk} and not preloaded.`);
