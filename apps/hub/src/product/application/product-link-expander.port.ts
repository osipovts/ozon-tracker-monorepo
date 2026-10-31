import type { RouteInterface } from '../../job/application/index.js';

export const PRODUCT_LINK_EXPANDER = Symbol('ProductLinkExpanderPort');

export interface ProductLinkExpansionInterface {
  /** A short link of a marketplace. */
  url: string;
  routes: RouteInterface[];
  timeoutMs: number;
}

export interface ProductLinkExpanderPort {
  /** The canonical address of the product the short link leads to; rejects when it leads to none. */
  expand(request: ProductLinkExpansionInterface): Promise<string>;
}
