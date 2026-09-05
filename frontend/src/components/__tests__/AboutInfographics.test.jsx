import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { About } from '../../pages/About.jsx';
import { ProblemInfographic } from '../about/ProblemInfographic.jsx';
import { SolutionInfographic } from '../about/SolutionInfographic.jsx';
import { StatFigure } from '../about/StatFigure.jsx';
import { MIN_NIGHTS_FOR_INSIGHT } from '../../lib/constants.js';

/* The About page states population figures, which is the one place in the app
   that does. Everywhere else the rule is that MyLumi does not put a number on
   screen it cannot support, so the thing worth guarding here is not the layout
   but the attribution: every published figure has to keep its source attached.

   Someone adding a seventh statistic in a hurry before a deadline is exactly
   the scenario these tests exist for. */

describe('About infographics', () => {
  describe('StatFigure', () => {
    it('renders the figure, what it counts, and where it came from', () => {
      const { container } = render(
        <StatFigure value="3-4x" label="longer recovery" source="Bramley et al., 2017" />,
      );
      expect(container.textContent).toContain('3-4x');
      expect(container.textContent).toContain('longer recovery');
      expect(container.textContent).toContain('Bramley et al., 2017');
    });

    it('keeps the source at label size rather than in body prose', () => {
      const { container } = render(
        <StatFigure value="30-70%" label="report disturbed sleep" source="Review" />,
      );
      // text-xs is the app's label size. The style guard allows a citation
      // there and forbids prose, so the citation must actually carry the class.
      const source = container.querySelector('.stat-figure__source');
      expect(source.classList.contains('text-xs')).toBe(true);
    });
  });

  describe('ProblemInfographic', () => {
    it('attributes every figure it states', () => {
      const { container } = render(<ProblemInfographic />);
      const figures = container.querySelectorAll('.stat-figure');
      expect(figures.length).toBeGreaterThan(0);
      for (const figure of figures) {
        const source = figure.querySelector('.stat-figure__source');
        expect(source).toBeTruthy();
        expect(source.textContent.trim().length).toBeGreaterThan(0);
      }
    });

    it('says the headline counts are an undercount rather than implying a total', () => {
      const { container } = render(<ProblemInfographic />);
      // The CDC counts exclude anyone not hospitalised, which is most
      // concussions. Stating them without that caveat would overstate what the
      // number means, in the direction that flatters the pitch.
      expect(container.textContent).toMatch(/emergency department/i);
      expect(container.textContent).toMatch(/not known/i);
    });

    it('draws the two courses with an accessible description', () => {
      const { container } = render(<ProblemInfographic />);
      const svg = container.querySelector('svg[role="img"]');
      expect(svg).toBeTruthy();
      expect(svg.getAttribute('aria-label')).toMatch(/peak/i);
      // Both courses, and each carries a <title> for touch.
      expect(container.querySelectorAll('polyline').length).toBe(2);
      expect(container.querySelectorAll('polyline title').length).toBe(2);
    });

    it('distinguishes the two courses by more than colour', () => {
      const { container } = render(<ProblemInfographic />);
      // The persisting course is dashed as well as differently coloured, so it
      // survives colour vision deficiency and a dimmed screen.
      expect(container.querySelector('.problem-curve__persisting')).toBeTruthy();
      expect(container.querySelector('.problem-curve__typical')).toBeTruthy();
    });
  });

  describe('SolutionInfographic', () => {
    it('states the pipeline in order', () => {
      const { container } = render(<SolutionInfographic />);
      const steps = container.querySelectorAll('.pipeline__step');
      expect(steps.length).toBe(4);
      // An ordered list, because the order is the meaning.
      expect(container.querySelector('ol.pipeline')).toBeTruthy();
    });

    it('takes the silence threshold from the shared constant', () => {
      const { container } = render(<SolutionInfographic />);
      // Hardcoding 7 here would let the page and the model disagree.
      expect(container.textContent).toContain(`${MIN_NIGHTS_FOR_INSIGHT} nights`);
    });

    it('reports the coverage failure alongside the fix', () => {
      const { container } = render(<SolutionInfographic />);
      // 87% on its own is a boast. The 51% it replaced is what makes it
      // evidence, and dropping it would turn this card into marketing.
      expect(container.textContent).toContain('51');
      expect(container.textContent).toContain('87');
    });

    it('labels its own figures as self-measured, not population data', () => {
      const { container } = render(<SolutionInfographic />);
      expect(container.textContent).toMatch(/own measurements|test suite/i);
    });
  });

  describe('the page', () => {
    const renderPage = () =>
      render(
        <MemoryRouter>
          <About />
        </MemoryRouter>,
      );

    it('puts the problem before the solution, and the limits after both', () => {
      const { container } = renderPage();
      const text = container.textContent;
      const problem = text.indexOf('Why this exists');
      const solution = text.indexOf('How MyLumi answers that');
      const limits = text.indexOf('What it can and cannot tell you');
      expect(problem).toBeGreaterThan(-1);
      expect(solution).toBeGreaterThan(problem);
      expect(limits).toBeGreaterThan(solution);
    });

    it('still carries the red-flag section at its anchor', () => {
      const { container } = renderPage();
      // The banner links here. Adding cards above it must not disturb it.
      const redFlags = container.querySelector('#red-flags');
      expect(redFlags).toBeTruthy();
      expect(within(redFlags).getByText(/cannot detect an emergency/i)).toBeTruthy();
    });

    it('makes no claim to diagnose or to date a recovery', () => {
      const { container } = renderPage();
      const text = container.textContent.toLowerCase();
      expect(text).not.toMatch(/\bdiagnos(e|is|tic)\b(?!.*not)/);
      expect(text).toContain('will not predict a recovery date');
    });
  });
});
