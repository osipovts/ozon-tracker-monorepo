/** A date and a time as a person reads them in the list: short, without the seconds. */
export function formatMoment(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}
