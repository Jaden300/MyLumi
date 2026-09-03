/* Nine symptoms x every logged night, as a heatmap.

   This is the densest view in the app and the one the nine PCSS items were
   always worth collecting for. A 22-night history is 198 individual ratings;
   the summary sentences above it are conclusions drawn from this, and a reader
   who wants to check them can look.

   What it makes visible that no summary can:

   - Bands. The cognitive row staying dark while the somatic rows fade is the
     whole per-symptom finding, seen directly rather than asserted.
   - Columns. A single bad day shows as a vertical stripe across every symptom,
     which is a different thing from one symptom worsening, and the difference is
     obvious here and invisible in a list of nine slopes.
   - Gaps. Unlogged nights are drawn as an explicit hatched column, never closed
     up, so a sparse fortnight cannot masquerade as a dense one.

   ## Colour is not the only channel

   These users have light sensitivity and may be reading at minimum brightness,
   and the severity ramp runs green to red, which is the worst case for the most
   common colour vision deficiency. So each cell also carries its value as an
   inset square whose SIZE scales with severity: a 6 fills its cell, a 1 is a
   dot. The pattern is legible in greyscale. */

import { SYMPTOMS, MAX_SYMPTOM_BURDEN } from '../../lib/constants.js';
import { severityToken } from '../../lib/severity.js';
import { formatShortDate } from '../../lib/dates.js';

const SYMPTOM_MAX = 6;

/* Geometry in abstract units; CSS scales the whole thing. The row label gutter
   is wide because the labels are real words, not codes. */
const LABEL_W = 92;
const ROW_H = 15;
const GAP = 1.5;
const TOP = 14;

function daysApart(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/** Every calendar day across the span, so unlogged nights keep their place. */
function buildColumns(nights) {
  if (!nights.length) return [];
  const span = daysApart(nights[0], nights[nights.length - 1]);
  const logged = new Map(nights.map((n, i) => [daysApart(nights[0], n), i]));
  const columns = [];
  for (let offset = 0; offset <= span; offset += 1) {
    columns.push({ offset, index: logged.has(offset) ? logged.get(offset) : null });
  }
  return columns;
}

export function SymptomHeatmap({ grid }) {
  const nights = grid?.nights ?? [];
  const values = grid?.values ?? [];
  if (nights.length < 3 || values.length === 0) return null;

  const columns = buildColumns(nights);
  const cellW = Math.max(4, Math.min(14, 620 / columns.length));
  const plotW = columns.length * cellW;
  const width = LABEL_W + plotW + 4;
  const height = TOP + values.length * ROW_H + 14;

  /* Row order follows the check-in order in constants.js rather than being
     sorted by severity. A row that moves between visits is a row you cannot
     learn the position of, and this chart is meant to be re-read over weeks. */
  const rows = grid.keys.map((key, i) => ({
    key,
    label: SYMPTOMS.find((s) => s.key === key)?.label ?? grid.labels[i] ?? key,
    values: values[i] ?? [],
  }));

  return (
    <div className="heatmap-wrap">
      <svg
        className="heatmap"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={describe(grid, rows)}
      >
        <text x={LABEL_W} y={9} className="heatmap__axis">
          {formatShortDate(nights[0])}
        </text>
        <text x={LABEL_W + plotW} y={9} className="heatmap__axis" textAnchor="end">
          {formatShortDate(nights[nights.length - 1])}
        </text>

        {rows.map((row, r) => {
          const y = TOP + r * ROW_H;
          return (
            <g key={row.key}>
              <text x={LABEL_W - 6} y={y + ROW_H / 2 + 3} className="heatmap__label" textAnchor="end">
                {row.label}
              </text>
              {columns.map((column) => {
                const x = LABEL_W + column.offset * cellW;
                if (column.index === null) {
                  /* Never logged. Drawn, not skipped - a gap the chart closes up
                     is a gap the reader cannot see. */
                  return (
                    <rect
                      key={column.offset}
                      x={x}
                      y={y}
                      width={cellW - GAP}
                      height={ROW_H - GAP}
                      className="heatmap__cell heatmap__cell--empty"
                    />
                  );
                }
                const value = row.values[column.index];
                if (!Number.isFinite(value)) return null;

                // Severity as a fraction of a single item's 0-6 range, mapped
                // onto the same ramp the rest of the app uses for 0-54 burden.
                const scaled = (value / SYMPTOM_MAX) * MAX_SYMPTOM_BURDEN;
                // Inset size is the redundant, colour-free channel.
                const inset = ((SYMPTOM_MAX - value) / SYMPTOM_MAX) * ((ROW_H - GAP) / 2.4);
                return (
                  <rect
                    key={column.offset}
                    x={x + inset}
                    y={y + inset}
                    width={Math.max(1, cellW - GAP - inset * 2)}
                    height={Math.max(1, ROW_H - GAP - inset * 2)}
                    rx={1}
                    fill={value > 0 ? severityToken(scaled) : 'var(--border)'}
                    className="heatmap__cell"
                  >
                    <title>
                      {row.label}, {formatShortDate(nights[column.index])}: {value} of{' '}
                      {SYMPTOM_MAX}
                    </title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>

      <div className="heatmap__key" aria-hidden="true">
        <span className="text-muted text-xs">none</span>
        {[0, 1, 2, 3, 4, 5, 6].map((value) => (
          <span
            key={value}
            className="heatmap__swatch"
            style={{
              background:
                value > 0 ? severityToken((value / SYMPTOM_MAX) * MAX_SYMPTOM_BURDEN) : 'var(--border)',
            }}
          />
        ))}
        <span className="text-muted text-xs">severe</span>
      </div>
    </div>
  );
}

/* One sentence a screen reader can use instead of 198 cells. Describes the
   shape - which symptoms sit heaviest - rather than reading out the grid. */
function describe(grid, rows) {
  const means = rows
    .map((row) => {
      const numbers = row.values.filter(Number.isFinite);
      if (!numbers.length) return null;
      return { label: row.label, mean: numbers.reduce((a, b) => a + b, 0) / numbers.length };
    })
    .filter(Boolean)
    .sort((a, b) => b.mean - a.mean);

  if (!means.length) return 'Symptom heatmap - no ratings yet.';
  const heaviest = means.slice(0, 2).map((m) => m.label).join(' and ');
  const lightest = means[means.length - 1].label;
  return (
    `Heatmap of nine symptoms across ${grid.nights.length} logged nights. ` +
    `Heaviest on average: ${heaviest}. Lightest: ${lightest}. ` +
    'Each row is one symptom over time; darker and larger means more severe.'
  );
}
