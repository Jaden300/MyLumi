import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubjectCard, SUBJECT_KEYS } from '../about/SubjectCard.jsx';

/* These cards carry claims about what the app does with a user's data, so the
   assertions here are mostly about the copy staying honest and readable rather
   than about the markup.

   The whitespace test is not hypothetical: the first version of this file wrote
   the paragraphs as wrapped template literals, which embed the source newline
   and indentation into the rendered string. HTML collapses that visually, so it
   looks fine in a browser while the accessible name carries runs of spaces. */

const NEGATED = /\b(not|never|no|cannot|won't|doesn't|will not|does not)\b/i;
const CLAIMS = [
  /\bdiagnos(e|es|ed|ing|is|tic)\b/i,
  /\bcures?\b/i,
  /\brecovery date\b/i,
];

describe('SubjectCard', () => {
  it.each(SUBJECT_KEYS)('%s renders a titled card', (subject) => {
    render(<SubjectCard subject={subject} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
  });

  it('renders nothing for an unknown subject rather than an empty card', () => {
    const { container } = render(<SubjectCard subject="not-a-subject" />);
    expect(container.firstChild).toBeNull();
  });

  it('covers the five subjects the About page asks for', () => {
    expect(new Set(SUBJECT_KEYS)).toEqual(
      new Set(['mental', 'physical', 'concussion', 'ai', 'ml']),
    );
  });

  describe('copy', () => {
    it.each(SUBJECT_KEYS)('%s has no collapsed whitespace in its prose', (subject) => {
      const { container } = render(<SubjectCard subject={subject} />);
      for (const p of container.querySelectorAll('p')) {
        expect(p.textContent).not.toMatch(/\s{2,}/);
        expect(p.textContent).not.toContain('\n');
      }
    });

    /* The framing rule for these cards: they describe the product, not the
       people who built it. First person turns a feature description into a
       pitch, and this is the one place it would be easy to slip. */
    it.each(SUBJECT_KEYS)('%s describes the app, not its authors', (subject) => {
      const { container } = render(<SubjectCard subject={subject} />);
      const text = container.textContent;
      expect(text).not.toMatch(/\b(we|our|us)\b/i);
    });

    /* Only the asserting forms. "Lumi will not estimate a recovery date" is the
       commitment itself, and a check that banned the phrase outright would
       delete the sentence that makes it - so the claim is looked for per
       sentence, and a sentence carrying a negator is the app refusing rather
       than promising. */
    it.each(SUBJECT_KEYS)('%s claims no diagnosis and promises no date', (subject) => {
      const { container } = render(<SubjectCard subject={subject} />);
      const offenders = container.textContent
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => CLAIMS.some((r) => r.test(sentence)) && !NEGATED.test(sentence));
      expect(offenders).toEqual([]);
    });
  });

  describe('accessibility', () => {
    it('the decorative Lumi is hidden from assistive tech', () => {
      const { container } = render(<SubjectCard subject="ml" />);
      const svg = container.querySelector('svg');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('role')).toBe('presentation');
    });

    /* The heading is what a screen-reader user navigates by, so it has to be
       the card's actual subject and not the mascot. */
    it.each(SUBJECT_KEYS)('%s names its subject in the heading', (subject) => {
      render(<SubjectCard subject={subject} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.textContent.trim().length).toBeGreaterThan(0);
      expect(heading.textContent).not.toMatch(/^\s*Lumi\s*$/);
    });
  });

  it('passes className through so About can span the last card', () => {
    const { container } = render(<SubjectCard subject="ml" className="grid__span" />);
    expect(container.firstChild.className).toContain('grid__span');
    expect(container.firstChild.className).toContain('card--highlight');
  });
});
