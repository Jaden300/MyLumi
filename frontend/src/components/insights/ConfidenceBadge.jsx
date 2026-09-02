/* Confidence, always shown next to a number.

   The design system requires every prediction to display its confidence and for
   low confidence to say so explicitly. This is the shared pill that does it.

   The label is plain language, not a tier name: "based on 9 nights" tells a
   patient something real, where "low confidence" alone invites them to guess
   what that means. */

const TIER_TEXT = {
  low: 'Early estimate',
  moderate: 'Getting personal',
  good: 'Personalised',
};

export function ConfidenceBadge({ confidence, nDays }) {
  if (!confidence || confidence === 'none') return null;
  return (
    <span className={`confidence confidence--${confidence}`}>
      {TIER_TEXT[confidence]}
      {Number.isFinite(nDays) && nDays > 0 && (
        <span className="confidence__count"> · {nDays} nights</span>
      )}
    </span>
  );
}
