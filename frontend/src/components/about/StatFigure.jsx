/* One published figure, with the source it came from attached to it.

   This is deliberately not `ui/Stat.jsx`, which shows the user their own data.
   The distinction matters more here than the near-identical markup suggests: a
   Stat is a reading taken from this person's entries, and a StatFigure is a
   number from a paper about a population they are only probably like. Merging
   the two would put "your average sleep this week" and "30 to 70 percent of
   people" in the same visual register, which is exactly the conflation the rest
   of the app spends its effort avoiding.

   Hence `source` is required rather than optional. A population figure without
   a visible attribution is the thing MyLumi refuses to do everywhere else, and
   making the prop mandatory means nobody can add one in a hurry without one. */

export function StatFigure({ value, label, source, size = 'lg' }) {
  return (
    <div className="stat-figure stack stack--tight">
      <strong className={`stat-figure__value stat-figure__value--${size}`}>{value}</strong>
      <span className="stat-figure__label">{label}</span>
      {/* caption-ok: an attribution, not an explanation. The rule exists to stop
          prose shrinking into the small print; a citation is the one thing that
          belongs there, and it has to sit with its figure rather than collect in
          a footnote nobody links back from. */}
      <span className="stat-figure__source text-xs">{source}</span>
    </div>
  );
}
