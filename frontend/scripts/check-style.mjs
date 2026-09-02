#!/usr/bin/env node
/* Typographic style guard. See docs/workflow.md.

   The project uses plain hyphens and straight quotes everywhere - in UI copy,
   comments, docs, test names and commit messages alike. This catches a
   regression before it is committed.

   The banned characters are written as escape sequences on purpose, so that
   this file does not itself contain the characters it bans and can be scanned
   by its own check. */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// Built from code points so this file contains none of the characters it bans
// and therefore passes its own check.
const BANNED = [
  ['\u2013', 'en dash', 'use a hyphen -'],
  ['\u2014', 'em dash', 'use a spaced hyphen - '],
  ['\u2018', 'left single quote', "use '"],
  ['\u2019', 'right single quote', "use '"],
  ['\u201C', 'left double quote', 'use a straight double quote'],
  ['\u201D', 'right double quote', 'use a straight double quote'],
  ['\u2212', 'minus sign', 'use a hyphen -'],
];

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.venv', 'dist', 'build',
  '__pycache__', '.pytest_cache', 'coverage',
]);

const CHECK_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.css', '.html',
  '.md', '.py', '.json', '.yaml', '.yml', '.txt', '.mjs',
]);

const SKIP_FILES = new Set(['package-lock.json']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (CHECK_EXT.has(extname(name)) && !SKIP_FILES.has(name)) yield full;
  }
}

const violations = [];

for (const file of walk(ROOT)) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    for (const [char, name, fix] of BANNED) {
      const col = line.indexOf(char);
      if (col !== -1) {
        violations.push({
          file: relative(ROOT, file), line: i + 1, col: col + 1, name, fix,
          excerpt: line.trim().slice(0, 90),
        });
      }
    }
  });
}

if (violations.length === 0) {
  console.log('check:style - clean, no banned typographic characters found.');
  process.exit(0);
}

console.error(`check:style - found ${violations.length} violation(s):\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}:${v.col}  ${v.name} (${v.fix})`);
  console.error(`    ${v.excerpt}`);
}
console.error('\nSee docs/workflow.md, "Writing conventions".');
process.exit(1);
