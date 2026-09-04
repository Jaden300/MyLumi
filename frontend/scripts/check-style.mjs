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

/* --- the caption layer -----------------------------------------------------

   docs/design-system.md, "No caption layer": --fs-xs is for labels and data
   annotations, never for prose. This rule was written once, held for a while,
   and came back the moment three new cards were added - which is why it is a
   check now and not only a sentence in a doc.

   What counts as prose rather than a label is a judgement call, so the test is
   deliberately blunt: more than SHORT_ENOUGH words, or a sentence-ending full
   stop. "none", "severe", "of 54" and "tomorrow = today" pass; a sentence
   explaining what the chart means does not.

   Safety copy, screen-reader labels and correctness notes about a specific
   number are exempt - mark those with a caption-ok comment on the line before
   and say why. */

const SHORT_ENOUGH = 6;
const CAPTION_OK = /caption-ok/;

// Opening tag carrying an --fs-xs class, through to its closing tag. Spans
// lines, because that is how the prose was written every time it came back.
const XS_ELEMENT = /<(\w+)[^>]*className=(?:"[^"]*\btext-xs\b[^"]*"|\{[^}]*\btext-xs\b[^}]*\})[^>]*>([\s\S]*?)<\/\1>/g;

function looksLikeProse(inner) {
  const text = inner
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')  // JSX comments, before interpolations
    .replace(/<[^>]*>/g, ' ')               // nested tags
    // An interpolation stands in for one word. Dropping them entirely let
    // "Based on {n} nights - strength {rho}" read as four words and pass; each
    // one is a value the reader still has to take in.
    .replace(/\{[^}]*\}/g, ' _ ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  const words = text.split(' ').filter(Boolean);
  if (words.length > SHORT_ENOUGH) return text;
  if (/\.\s/.test(text)) return text;             // "One thing. Then another."
  if (words.length > 2 && /\.$/.test(text)) return text;
  return null;
}

const violations = [];
const captions = [];

for (const file of walk(ROOT)) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');

  lines.forEach((line, i) => {
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

  if (extname(file) !== '.jsx') continue;

  for (const match of text.matchAll(XS_ELEMENT)) {
    const prose = looksLikeProse(match[2]);
    if (!prose) continue;
    const lineNo = text.slice(0, match.index).split('\n').length;
    /* The lines above, so the escape hatch can sit above a wrapping conditional
       as well as directly above the element. Wide enough for a multi-line
       comment explaining itself, which is the whole point of requiring one. */
    const preceding = lines.slice(Math.max(0, lineNo - 9), lineNo - 1).join(' ');
    if (CAPTION_OK.test(preceding)) continue;
    captions.push({
      file: relative(ROOT, file), line: lineNo, excerpt: prose.slice(0, 90),
    });
  }
}

if (violations.length === 0 && captions.length === 0) {
  console.log('check:style - clean, no banned characters and no caption layer.');
  process.exit(0);
}

if (violations.length > 0) {
  console.error(`check:style - found ${violations.length} typographic violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}:${v.col}  ${v.name} (${v.fix})`);
    console.error(`    ${v.excerpt}`);
  }
  console.error('\nSee docs/workflow.md, "Writing conventions".');
}

if (captions.length > 0) {
  console.error(`\ncheck:style - found ${captions.length} caption(s) in --fs-xs:\n`);
  for (const c of captions) {
    console.error(`  ${c.file}:${c.line}  prose at --fs-xs`);
    console.error(`    ${c.excerpt}`);
  }
  console.error(
    '\nSmall print under a chart or card is not the place for an explanation - ' +
    'it stops being read.\nPut it on the About page, or cut it. See ' +
    'docs/design-system.md, "No caption layer".\nIf this is safety copy, a ' +
    'screen-reader label, or a note about a specific wrong number,\nadd a ' +
    '{/* caption-ok: why */} comment on the line above.',
  );
}

process.exit(1);
