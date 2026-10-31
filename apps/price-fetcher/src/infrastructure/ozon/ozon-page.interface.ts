export interface OzonPageInterface {
  /** The final URL after redirects. */
  url: string;
  title: string;
  heading: string;
  body: string;
  priceText: string;
  purchaseText: string;
  /** What the widget of a product that is out of stock says; empty when the page has none. */
  outOfStockText: string;
  structuredData: string[];
  /** The picture the page names for sharing (`og:image`); empty when it names none. */
  imageUrl: string;
}
