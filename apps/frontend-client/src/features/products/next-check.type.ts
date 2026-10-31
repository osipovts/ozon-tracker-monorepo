/**
 * When the price is read again, as a person reads it: the time of day; or "soon" when the time
 * has passed, since the product then waits only for the next look of the schedule. Null when unknown.
 */
export function describeNextCheck(
  nextCheckAt: string | null,
  now: Date,
  locale: string,
): { soon: true } | { soon: false; when: string } | null {
  if (nextCheckAt === null) return null;

  const next = new Date(nextCheckAt);
  if (next <= now) return { soon: true };

  return {
    soon: false,
    when: next.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
  };
}
