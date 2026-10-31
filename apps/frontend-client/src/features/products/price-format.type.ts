const rubles = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });

/** Amounts of the hub are in kopecks. */
export function formatPrice(amountMinor: number): string {
  return rubles.format(amountMinor / 100);
}
