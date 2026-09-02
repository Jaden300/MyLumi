import { useId } from 'react';

/* Lumi - the guide character.

   A molten-core pebble: one body, reused unchanged in every pose, with drip
   tails at the base and a warm magma glow rising from below. Only the face
   swaps between states. Where a state needs more than a face it gets a single
   accent mark OUTSIDE the silhouette, drawn in magenta so it reads on both the
   dark and light themes.

   Accents are dropped below ACCENT_MIN_SIZE: at topbar scale they turn to mud,
   and the face alone still carries the state.

   Tone rule (see MyLumi_Plan.md section 6): warm, never patronising, and never
   falsely cheerful about a bad day. 'concerned' exists so the character can
   acknowledge a hard day instead of smiling through it. */

const ACCENT_MIN_SIZE = 40;

/* Faces are drawn about the origin and translated to the body's centre, so a
   face can be moved (see 'waving', which shifts to look toward its own hand)
   without touching any of its own coordinates. */
const FACE_ORIGIN = { x: 50, y: 50 };

const STROKE = { fill: 'none', stroke: '#fff', strokeLinecap: 'round' };

/* Eyes that blink. Only open-eye states use these - a closed or curved eye has
   nothing to close. keyTimes keeps the lid shut for ~3% of the cycle so it
   reads as a blink rather than a flicker. */
function BlinkingEye({ cx, cy, rx, ry, dur }) {
  return (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff">
      <animate
        attributeName="ry"
        values={`${ry};${ry};${ry * 0.12};${ry};${ry}`}
        keyTimes="0;0.92;0.95;0.98;1"
        dur={`${dur}s`}
        repeatCount="indefinite"
      />
    </ellipse>
  );
}

const FACES = {
  idle: () => (
    <>
      <path d="M-10,-5.6 Q-6,0.6 -2,-5.6" {...STROKE} strokeWidth="3.2" />
      <path d="M2,-5.6 Q6,0.6 10,-5.6" {...STROKE} strokeWidth="3.2" />
      <path d="M-5,5.6 Q0,10 5,5.6" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  encouraging: () => (
    <>
      <path d="M-9.6,-11.4 Q-6,-13.8 -2.4,-11.4" {...STROKE} strokeWidth="2.4" />
      <path d="M2.4,-11.4 Q6,-13.8 9.6,-11.4" {...STROKE} strokeWidth="2.4" />
      <BlinkingEye cx={-6} cy={-4} rx={3.4} ry={4.2} dur={3} />
      <BlinkingEye cx={6} cy={-4} rx={3.4} ry={4.2} dur={3} />
      <path d="M-7,5 Q0,11.6 7,5" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  celebrating: () => (
    <>
      <path d="M-9.6,-2.4 Q-6,-8.6 -2.4,-2.4" {...STROKE} strokeWidth="3.2" />
      <path d="M2.4,-2.4 Q6,-8.6 9.6,-2.4" {...STROKE} strokeWidth="3.2" />
      <path d="M-6.4,4.6 A6.4,6.4 0 0 0 6.4,4.6 Z" fill="#fff" />
    </>
  ),
  /* Inner brows up, mouth level. Gentle, not sad - a flat mouth reads as
     attentive rather than pitying. */
  concerned: () => (
    <>
      <path d="M-9.8,-10.6 L-3.6,-12.6" {...STROKE} strokeWidth="2.4" />
      <path d="M3.6,-12.6 L9.8,-10.6" {...STROKE} strokeWidth="2.4" />
      <BlinkingEye cx={-6} cy={-4} rx={3.2} ry={4} dur={3.4} />
      <BlinkingEye cx={6} cy={-4} rx={3.2} ry={4} dur={3.4} />
      <path d="M-4.8,8 Q0,4.6 4.8,8" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  resting: () => (
    <>
      <path d="M-9.8,-4 L-2.2,-4" {...STROKE} strokeWidth="3.2" />
      <path d="M2.2,-4 L9.8,-4" {...STROKE} strokeWidth="3.2" />
      <path d="M-4.4,5.8 Q0,9.4 4.4,5.8" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  waking: () => (
    <>
      <path d="M-9.8,-3.2 Q-6,-9 -2.2,-3.2 Z" fill="#fff" />
      <path d="M2.2,-3.2 Q6,-9 9.8,-3.2 Z" fill="#fff" />
      <path d="M-5,5.6 Q0,10.2 5,5.6" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  reading: () => (
    <>
      <path d="M-10,-6.6 Q-6,-2.6 -2,-6.6" {...STROKE} strokeWidth="2.8" />
      <path d="M2,-6.6 Q6,-2.6 10,-6.6" {...STROKE} strokeWidth="2.8" />
      <circle cx="-6" cy="-0.6" r="1.5" fill="#fff" />
      <circle cx="6" cy="-0.6" r="1.5" fill="#fff" />
      <path d="M-4.4,6.4 Q0,9.8 4.4,6.4" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  waving: () => (
    <>
      <BlinkingEye cx={-6} cy={-4} rx={3.4} ry={4.2} dur={2.8} />
      <BlinkingEye cx={6} cy={-4} rx={3.4} ry={4.2} dur={2.8} />
      <path d="M-6.6,5.2 Q0,11.2 6.6,5.2" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  thinking: () => (
    <>
      <BlinkingEye cx={-4.6} cy={-5.4} rx={3.2} ry={4} dur={3.6} />
      <BlinkingEye cx={7.4} cy={-5.4} rx={3.2} ry={4} dur={3.6} />
      <path d="M-4.4,6.2 L4.4,6.2" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  presenting: () => (
    <>
      <BlinkingEye cx={-6} cy={-4} rx={3.4} ry={4.2} dur={3.2} />
      <BlinkingEye cx={6} cy={-4} rx={3.4} ry={4.2} dur={3.2} />
      <path d="M-6,5.4 Q0,10.6 6,5.4" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  empty: () => (
    <>
      <circle cx="-6" cy="-4" r="2.4" fill="#fff" />
      <circle cx="6" cy="-4" r="2.4" fill="#fff" />
      <path d="M-4,6.2 L4,6.2" {...STROKE} strokeWidth="3" />
    </>
  ),
  attentive: () => (
    <>
      <BlinkingEye cx={-6.4} cy={-4} rx={4} ry={4.8} dur={3.8} />
      <BlinkingEye cx={6.4} cy={-4} rx={4} ry={4.8} dur={3.8} />
      <path d="M-4.4,6 Q0,8.8 4.4,6" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  proud: () => (
    <>
      <path d="M-9.6,-2.6 Q-6,-8.8 -2.4,-2.6" {...STROKE} strokeWidth="3.2" />
      <path d="M2.4,-2.6 Q6,-8.8 9.6,-2.6" {...STROKE} strokeWidth="3.2" />
      <path d="M-7,5 Q0,11.8 7,5" {...STROKE} strokeWidth="3.4" />
    </>
  ),
  cheering: () => (
    <>
      <path d="M-9.6,-2.4 Q-6,-9 -2.4,-2.4" {...STROKE} strokeWidth="3.4" />
      <path d="M2.4,-2.4 Q6,-9 9.6,-2.4" {...STROKE} strokeWidth="3.4" />
      <path d="M-7,4.4 A7,7 0 0 0 7,4.4 Z" fill="#fff" />
    </>
  ),
  sleepy: () => (
    <>
      <path d="M-9.8,-3.6 L-2.2,-3.6" {...STROKE} strokeWidth="3" />
      <path d="M2.2,-3.6 L9.8,-3.6" {...STROKE} strokeWidth="3" />
      <path d="M-3.8,6 Q0,8.8 3.8,6" {...STROKE} strokeWidth="3" />
    </>
  ),
  lost: () => (
    <>
      <BlinkingEye cx={-6} cy={-4} rx={3.4} ry={4.2} dur={3.4} />
      <path d="M2,-5.8 Q6,-0.4 10,-5.8" {...STROKE} strokeWidth="3" />
      <path d="M-4.2,6.6 L4.2,6.6" {...STROKE} strokeWidth="3.2" />
    </>
  ),
  offline: () => (
    <>
      <path d="M-9.6,-4 L-2.4,-4" {...STROKE} strokeWidth="3" />
      <path d="M2.4,-4 L9.6,-4" {...STROKE} strokeWidth="3" />
      <path d="M-4,6.4 L4,6.4" {...STROKE} strokeWidth="3" />
    </>
  ),
};

/* Accent marks. Each sits outside the silhouette so it can be dropped at small
   sizes without leaving a hole in the body. Magenta holds on both themes. */
const ACCENT = '#d6249f';

const ACCENTS = {
  celebrating: () => (
    <>
      <path d="M84,20 L86.6,25 L84,30 L81.4,25 Z" fill={ACCENT} />
      <path d="M17,26 L18.8,29.6 L17,33.2 L15.2,29.6 Z" fill={ACCENT} />
    </>
  ),
  resting: () => (
    <path
      d="M88,16 C84.4,16 81.5,18.9 81.5,22.5 C81.5,26.1 84.4,29 88,29 C85.6,27.4 84,24.8 84,22.5 C84,20.2 85.6,17.6 88,16 Z"
      fill={ACCENT}
    />
  ),
  waking: () => (
    <>
      <path d="M50,4 L50,9" {...STROKE} stroke={ACCENT} strokeWidth="2.4" />
      <path d="M28,10 L31,14" {...STROKE} stroke={ACCENT} strokeWidth="2.4" />
      <path d="M72,10 L69,14" {...STROKE} stroke={ACCENT} strokeWidth="2.4" />
    </>
  ),
  reading: () => (
    <>
      <path d="M62,72 L86,72" {...STROKE} stroke={ACCENT} strokeWidth="2.6" />
      <path d="M66,78 L82,78" {...STROKE} stroke={ACCENT} strokeWidth="2.6" />
    </>
  ),
  thinking: () => (
    <>
      <circle cx="78" cy="24" r="2.4" fill={ACCENT} />
      <circle cx="86" cy="17" r="1.9" fill={ACCENT} />
      <circle cx="93" cy="11" r="1.4" fill={ACCENT} />
    </>
  ),
  presenting: () => (
    <>
      <rect x="78" y="30" width="20" height="26" rx="4" fill="none" stroke={ACCENT} strokeWidth="2.2" />
      <path d="M83,38 L93,38" {...STROKE} stroke={ACCENT} strokeWidth="2.2" />
      <path d="M83,45 L89,45" {...STROKE} stroke={ACCENT} strokeWidth="2.2" />
    </>
  ),
  empty: () => (
    <circle
      cx="50"
      cy="52"
      r="45"
      fill="none"
      stroke={ACCENT}
      strokeWidth="1.8"
      strokeDasharray="3 6"
      strokeLinecap="round"
      opacity="0.55"
    />
  ),
  proud: () => <path d="M66,7 L69,12 L66,17 L63,12 Z" fill={ACCENT} />,
  /* The hand is body-coloured, so it reads as part of Lumi rather than as a
     mark floating beside it. */
  waving: ({ bodyGrad }) => (
    <>
      <path d="M85,48 C90,42 96,44 95.5,50.5 C95,56 89,58 85,55 Z" fill={`url(#${bodyGrad})`} />
      <path d="M97,38 Q100,44 98.6,50" {...STROKE} stroke={ACCENT} strokeWidth="2.2" />
    </>
  ),
  cheering: () => (
    <>
      <path d="M7,40 Q3,52 7,64" {...STROKE} stroke={ACCENT} strokeWidth="2.4" />
      <path d="M93,40 Q97,52 93,64" {...STROKE} stroke={ACCENT} strokeWidth="2.4" />
    </>
  ),
  sleepy: () => (
    <path d="M74,10 L84,10 L74,22 L84,22" {...STROKE} stroke={ACCENT} strokeWidth="2.2" />
  ),
  lost: () => (
    <>
      <path
        d="M74,13 C74,7.6 84,7.6 84,13 C84,17 79,17.6 79,22"
        {...STROKE}
        stroke={ACCENT}
        strokeWidth="2.4"
      />
      <circle cx="79" cy="27" r="1.6" fill={ACCENT} />
    </>
  ),
  offline: () => (
    <path d="M20,80 L80,20" {...STROKE} stroke={ACCENT} strokeWidth="2.4" opacity="0.65" />
  ),
};

/* 'waving' needs a hand outside the body AND a face shifted toward it, so it
   carries both an accent and a face offset. */
const FACE_OFFSET = {
  waving: { x: -2, y: 0 },
  presenting: { x: -2, y: 0 },
};

/* The body silhouette, shared by every state: a rounded pebble with two drip
   tails at the base. Drawn once per instance rather than via <symbol>/<use>,
   because several Lumis mount at the same time and shared global SVG ids would
   collide across React trees. */
const BODY_PATH =
  'M28,84 L33,84 C31.5,88.5 32.5,93 38,93 C43.5,93 44.5,88.5 43,84 L52,84 ' +
  'C51,87.5 52,90.5 55.5,90.5 C59,90.5 59.5,87.5 58.5,84 L66,84 C78,84 88,74 ' +
  '88,56 C88,32 76,14 56,14 C36,14 14,30 14,52 C14,70 18,84 28,84 Z';

/**
 * The Lumi mascot.
 *
 * @param state  one of the keys of FACES. Unknown values fall back to 'idle'
 *               so a bad prop degrades to the neutral face instead of a blank.
 * @param size   rendered px. Below 40 the accent marks are dropped.
 * @param title  accessible name. When omitted the mark is decorative and is
 *               hidden from assistive tech, which is correct at every call site
 *               where adjacent text already says the same thing.
 */
export function Lumi({ state = 'idle', size = 72, title, className = '' }) {
  const key = FACES[state] ? state : 'idle';
  const Face = FACES[key];
  const Accent = ACCENTS[key];
  const offset = FACE_OFFSET[key] ?? { x: 0, y: 0 };

  /* useId keeps gradient ids unique per mounted instance. Two Lumis in the
     same state appear together on the dashboard, and a duplicate id would make
     the second one reference the first one's gradient. */
  const uid = useId().replace(/:/g, '');
  const bodyGrad = `lumi-body-${uid}`;
  const magmaGrad = `lumi-magma-${uid}`;
  const haloGrad = `lumi-halo-${uid}`;

  const showAccent = Boolean(Accent) && size >= ACCENT_MIN_SIZE;

  return (
    <svg
      className={`lumi ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <defs>
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-purple)" />
          <stop offset="1" stopColor="var(--brand-magenta)" />
        </linearGradient>
        {/* Warm core rising from the base, giving the pebble its molten read. */}
        <radialGradient id={magmaGrad} cx="0.5" cy="0.94" r="0.8">
          <stop offset="0" stopColor="var(--brand-warm-core)" stopOpacity="0.92" />
          <stop offset="0.35" stopColor="var(--brand-warm-mid)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--brand-magenta)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={haloGrad}>
          <stop offset="0" stopColor="var(--brand-warm-halo)" stopOpacity="0.4" />
          <stop offset="0.5" stopColor="var(--brand-magenta)" stopOpacity="0.15" />
          <stop offset="1" stopColor="var(--brand-purple)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g opacity={key === 'offline' ? 0.5 : 1}>
        {/* Soft halo - the "lumi" in the name */}
        <circle cx="50" cy="54" r="48" fill={`url(#${haloGrad})`} />
        <path d={BODY_PATH} fill={`url(#${bodyGrad})`} />
        <path d={BODY_PATH} fill={`url(#${magmaGrad})`} />
        {/* A drip that has just left the body */}
        <circle cx="38" cy="96.5" r="2.2" fill="var(--brand-warm-drip)" />
      </g>

      {showAccent && <Accent bodyGrad={bodyGrad} />}

      <g
        transform={`translate(${FACE_ORIGIN.x + offset.x},${FACE_ORIGIN.y + offset.y})`}
        opacity={key === 'offline' ? 0.75 : 1}
      >
        <Face />
      </g>
    </svg>
  );
}
