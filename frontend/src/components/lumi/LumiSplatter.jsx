/* The page-wide field of scattered Lumi marks that sits behind everything.

   This replaced the three-radial gradient mesh as the thing that keeps a page
   from being a flat field of one colour. Where .lumi-deco is one oversized
   mascot clipped inside a single card, this is many small ones across the whole
   viewport, far fainter - texture you notice only if you look for it.

   Positions are a hardcoded constant, never Math.random(). A random layout
   reshuffles on every re-render, so the background would crawl each time a
   check-in saved or the theme flipped, which is exactly the kind of unbidden
   motion this audience should not be given. Fixed to the viewport, so scrolling
   moves content across the marks rather than dragging them along - the same
   behaviour the old --bg-mesh had.

   Every mark is decorative: no title, so Lumi renders it aria-hidden with
   role="presentation", and the layer is pointer-events: none so it can never
   intercept a click. */

import { Lumi } from './Lumi.jsx';

/* Hand-placed rather than generated. The centre column (roughly 30-70% on wide
   screens) is kept sparse so marks fall around the content rather than behind
   the middle of a paragraph, and sizes and rotations are varied so no two
   neighbours read as a repeated stamp.

   `depth` scales the shared --splatter-opacity per mark: the small ones sit
   further back, which is what stops the field reading as a regular pattern. */
const MARKS = [
  { top: '3%', left: '6%', size: 54, rotate: -14, depth: 0.9, state: 'idle' },
  { top: '9%', left: '78%', size: 38, rotate: 22, depth: 0.7, state: 'resting' },
  { top: '16%', left: '24%', size: 30, rotate: 8, depth: 0.55, state: 'waking' },
  { top: '21%', left: '91%', size: 66, rotate: -9, depth: 1, state: 'presenting' },
  { top: '28%', left: '2%', size: 42, rotate: 31, depth: 0.75, state: 'thinking' },
  { top: '35%', left: '68%', size: 28, rotate: -25, depth: 0.5, state: 'idle' },
  { top: '41%', left: '13%', size: 72, rotate: 5, depth: 1, state: 'reading' },
  { top: '47%', left: '86%', size: 34, rotate: 18, depth: 0.65, state: 'sleepy' },
  { top: '54%', left: '30%', size: 26, rotate: -6, depth: 0.5, state: 'idle' },
  { top: '60%', left: '73%', size: 58, rotate: 27, depth: 0.9, state: 'encouraging' },
  { top: '67%', left: '4%', size: 46, rotate: -19, depth: 0.8, state: 'waving' },
  { top: '73%', left: '94%', size: 32, rotate: 11, depth: 0.6, state: 'idle' },
  { top: '79%', left: '21%', size: 62, rotate: -3, depth: 0.95, state: 'proud' },
  { top: '85%', left: '61%', size: 36, rotate: 24, depth: 0.7, state: 'resting' },
  { top: '91%', left: '9%', size: 28, rotate: -12, depth: 0.5, state: 'idle' },
  { top: '94%', left: '83%', size: 50, rotate: 16, depth: 0.85, state: 'thinking' },
];

export function LumiSplatter() {
  return (
    <div className="lumi-splatter" aria-hidden="true">
      {MARKS.map((mark, i) => (
        <span
          /* Index is a safe key: MARKS is a module constant that never reorders. */
          key={i}
          className="lumi-splatter__mark"
          style={{
            top: mark.top,
            left: mark.left,
            transform: `rotate(${mark.rotate}deg)`,
            opacity: `calc(var(--splatter-opacity) * ${mark.depth})`,
          }}
        >
          <Lumi size={mark.size} state={mark.state} />
        </span>
      ))}
    </div>
  );
}
