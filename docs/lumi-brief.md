# Lumi - character design brief

> Copy the block below into Claude Design. Everything in it is derived from the
> live code: `components/lumi/Lumi.jsx`, its 12 call sites, and `tokens.css`.

---

Design a mascot character called **Lumi** for MyLumi, a concussion-recovery journaling app. I need one character drawn in **4 expression states**, plus a standalone app icon.

## What the app is

MyLumi is used by people recovering from a concussion. Twice a day - once before bed, once after waking - they rate 9 symptoms (headache, light sensitivity, nausea, brain fog, dizziness, fatigue and so on), log their sleep, and write a short journal entry. Lumi is the guide who walks them through it and delivers what the app notices.

Lumi is the emotional core of a clinical product. Everything else on screen is numbers and scales; Lumi is the part that makes it feel like something made for a person.

## Who is looking at this

This matters more than usual, and it should drive the design:

- **Light sensitivity (photophobia) is a core symptom.** Many users are on a phone, at minimum brightness, in a dark room, at 11pm. High contrast, bright whites, hard edges and saturated blocks are physically uncomfortable for them.
- **Cognitive fatigue is a core symptom.** Busy, detailed, or visually noisy artwork is tiring to parse.
- **No flashing, no strobing, no rapid movement, ever.** Some users have post-traumatic headache triggered by exactly that.
- Users are having a genuinely hard time. Lumi cannot be relentlessly perky.

Soft edges, soft gradients, generous negative space. Restraint here is a clinical decision, not just an aesthetic one.

## Tone - the rule that matters most

**Warm, never patronising, and never falsely cheerful about a bad day.**

Lumi is a calm companion, not a cheerleader and not a nurse. Think of a friend who sits with you rather than one who tells you to look on the bright side. When someone logs a terrible day, Lumi must be able to acknowledge it rather than smiling through it - that is why one of the four states below exists.

Avoid: mascot-with-big-thumbs-up, corporate wellness blob, anything childish or cutesy enough to feel condescending to an adult managing a head injury, anything medical (no stethoscopes, crosses, lab coats, bandages, or head-injury imagery - never depict Lumi as injured).

## Visual identity

- **Palette:** deep purple `#4C1D95` to magenta `#D6249F`, as a soft 135° gradient. Support colours: deepest purple `#2E1065`, soft magenta `#E85DB8`. Face/details in white or near-white.
- **Backgrounds Lumi sits on:** dark purple `#140A2E` (primary, dark mode) and off-white `#FAF8FF` (light mode). **Lumi must read clearly on both** - no white outlines that vanish on light, no dark details that vanish on dark.
- The name means light. A soft glow or halo around the character is very welcome. Luminous, not glossy - think a lamp seen through frosted glass, not a shiny 3D plastic ball.
- **Simple, rounded, geometric.** It has to survive being rendered at 28px.

## Form

The current placeholder is a simple gradient circle with a face - deliberately boring, and meant to be replaced. Please design something with more character while keeping it very simple.

A direction that fits the name and the brand, if useful: a soft crescent-moon-meets-spark form - something that reads as a small friendly light. But treat this as an invitation, not a constraint. A rounded abstract character, a small glowing creature, or a soft blob with real personality would all work if they carry warmth without cuteness. **The whole character should be recognisable as a silhouette.**

**Critical constraint:** all four states must share one identical body. Only the face changes - the eyes and mouth. This is one character in four moods, not four characters. The body, colour, proportions, and halo stay pixel-identical between states so switching between them in the UI reads as an expression change, never a swap.

## The four states

Deliver all four, side by side, same body, same size, same framing.

**1. `idle`** - the default, used most often
Calm, attentive, neutral-positive. A gentle closed-mouth smile. This is Lumi just being present while someone answers questions. Not bored, not excited. Appears in the header on every screen, on the check-in prompt card, and mid-check-in.

**2. `encouraging`** - the most emotionally important state
A warmer, more open smile. Kind and steady. Used when someone is on the last step of a check-in, when they've just finished one, when they're being offered a streak rescue after missing a day, and on the welcome screen. This is the "you're doing fine, keep going" face - reassuring without being congratulatory. **The one to get right.**

**3. `celebrating`** - used sparingly
Genuine delight. Biggest smile of the set, eyes bright or happily curved. A small sparkle or light-burst accent is appropriate here and **only** here. Used when both daily check-ins are complete and at milestones (7, 14, 30 nights logged). Should feel like quiet pride, not confetti - someone who managed both check-ins on a bad day deserves warmth, not a party.

**4. `concerned`** - the hardest one, and the reason the set has four states
**Gentle and attentive, NOT sad and NOT pitying.** The current placeholder uses a flat, level mouth for exactly this reason: a downturned frown reads as "I feel sorry for you", which is the single worst thing this character can communicate to someone in recovery. Aim for softly attentive - the face of someone listening carefully, leaning in slightly. Eyes may be marginally smaller or softer. **No tears, no droop, no worry lines, no distress.** Used when someone missed a day and their streak broke, and on the not-found page.

## Sizes it must work at

Design at high resolution but verify legibility at every one of these - these are the real sizes in the app:

- **28px** - header, every screen (the hardest constraint; the face must still read)
- **44px** - streak rescue prompt
- **48px** - during a check-in
- **56px** - completion screens, about page, not-found
- **64px** - the main dashboard card
- **96px** - welcome/onboarding screen, the largest and most detailed appearance

At 28px the expression still needs to be distinguishable. This is the main reason to keep detail minimal.

## Also needed: app icon / favicon

A separate simplified mark - Lumi's silhouette or head only, no facial expression needed if it doesn't survive the size, on the purple-to-magenta gradient. Must read at 16px and 32px in a browser tab. Square, works as a rounded-square app icon.

## Animation

Only one, and it must be extremely subtle: a slow blink every ~3 seconds. Nothing else moves. No bouncing, floating, pulsing, or spinning. If you show motion, keep it to the blink, and note that the app disables even that for users with reduced-motion enabled.

## Deliverables

1. All 4 expression states side by side, identical bodies, on the dark background `#140A2E`
2. The same 4 states on the light background `#FAF8FF`
3. A size test: the `idle` state at 28px, 48px, 64px and 96px
4. The simplified app icon / favicon mark
5. Ideally flat vector-style artwork suitable for export as SVG

---

## Notes for whoever integrates the result

`components/lumi/Lumi.jsx` is one self-contained file with a `FACES` map keyed by the four state names above, and a `viewBox="-50 -50 100 100"` (origin at centre). Swapping in the real art means replacing that file and nothing else - no call site changes. The state names `idle` / `encouraging` / `celebrating` / `concerned` are referenced across 12 call sites, so keep them.

Keep using CSS custom properties (`var(--brand-purple)`, `var(--brand-magenta)`) for the gradient rather than hardcoded hex, so Lumi tracks the theme. Keep the blink inside `<animate>` elements - `components.css` disables them under `prefers-reduced-motion` via `.lumi animate { display: none; }`.
