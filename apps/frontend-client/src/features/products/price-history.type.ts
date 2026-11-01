export interface PriceHistoryPageInterface<ProductType, ObservationType> {
  product: ProductType;
  items: ObservationType[];
  total: number;
}

export interface PriceHistoryInterface<ProductType, ObservationType> {
  product: ProductType;
  /** The newest first, all of them. */
  observations: ObservationType[];
}

/** The page of the history the hub gives at most. */
export const historyPageSize = 100;
/** A product read every few hours does not get past this in years. */
const historyPagesMax = 50;

/**
 * The history of a product, the newest observation first. With a history known already, only what is newer
 * is asked for: the pages are read from the newest until the one that is known, and the rest is kept.
 */
export async function loadPriceHistory<ProductType, ObservationType extends { id: string }>(
  fetchPage: (
    page: number,
  ) => Promise<PriceHistoryPageInterface<ProductType, ObservationType> | undefined>,
  known?: PriceHistoryInterface<ProductType, ObservationType>,
): Promise<PriceHistoryInterface<ProductType, ObservationType> | undefined> {
  const newestKnown = known?.observations[0]?.id;
  const fresh: ObservationType[] = [];
  let product: ProductType | undefined;
  let reachedKnown = false;

  for (let page = 1; page <= historyPagesMax; page += 1) {
    const loaded = await fetchPage(page);
    if (loaded === undefined) break;

    product = loaded.product;
    const knownAt = loaded.items.findIndex((item): boolean => item.id === newestKnown);
    if (knownAt !== -1) {
      fresh.push(...loaded.items.slice(0, knownAt));
      reachedKnown = true;
      break;
    }

    fresh.push(...loaded.items);
    if (fresh.length >= loaded.total || loaded.items.length === 0) break;
  }

  if (product === undefined) return undefined;

  return {
    product,
    observations: reachedKnown && known !== undefined ? [...fresh, ...known.observations] : fresh,
  };
}
