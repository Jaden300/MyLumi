/* Lumi — the guide character.

   PLACEHOLDER ART. Deliberately one self-contained file so swapping in the real
   illustrated logo later touches nothing else. A soft crescent-moon-meets-spark
   form on the brand gradient; expression is carried entirely by the eyes and
   mouth path so the states share one body.

   Tone rule (see MyLumi_Plan.md §6): warm, never patronising, and never falsely
   cheerful about a bad day. 'concerned' exists so the character can acknowledge
   a hard day instead of smiling through it. */

const FACES = {
  idle: { eyes: [-7, 7], mouth: 'M -7 7 Q 0 12 7 7', blink: 3.2 },
  encouraging: { eyes: [-7, 7], mouth: 'M -8 6 Q 0 14 8 6', blink: 3 },
  celebrating: { eyes: [-7, 7], mouth: 'M -9 5 Q 0 16 9 5', blink: 2.6 },
  // Gentle, not sad — a flat mouth reads as attentive rather than pitying.
  concerned: { eyes: [-6, 6], mouth: 'M -7 9 Q 0 7 7 9', blink: 3.4 },
};

export function Lumi({ state = 'idle', size = 72, title }) {
  const face = FACES[state] ?? FACES.idle;
  const gradientId = `lumi-grad-${state}`;

  return (
    <svg
      className="lumi"
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-purple)" />
          <stop offset="100%" stopColor="var(--brand-magenta)" />
        </linearGradient>
      </defs>

      {/* Soft halo — the "lumi" in the name */}
      <circle cx="0" cy="0" r="44" fill={`url(#${gradientId})`} opacity="0.16" />

      {/* Body */}
      <circle cx="0" cy="0" r="34" fill={`url(#${gradientId})`} />

      {/* Highlight, giving the form a little dimension */}
      <ellipse cx="-11" cy="-13" rx="10" ry="7" fill="#fff" opacity="0.18" />

      {/* Face */}
      <g fill="#fff">
        {face.eyes.map((cx) => (
          <ellipse key={cx} cx={cx} cy="-4" rx="2.6" ry="3.4">
            <animate
              attributeName="ry"
              values="3.4;3.4;0.4;3.4;3.4"
              keyTimes="0;0.92;0.95;0.98;1"
              dur={`${face.blink}s`}
              repeatCount="indefinite"
            />
          </ellipse>
        ))}
      </g>
      <path d={face.mouth} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />

      {/* Spark — only when there's something to celebrate */}
      {state === 'celebrating' && (
        <g fill="#fff" opacity="0.9">
          <path d="M 30 -30 l 2.2 6 l 6 2.2 l -6 2.2 l -2.2 6 l -2.2 -6 l -6 -2.2 l 6 -2.2 z" />
        </g>
      )}
    </svg>
  );
}
