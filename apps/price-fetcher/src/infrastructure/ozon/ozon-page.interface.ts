export interface OzonPageInterface {
  /** The final URL after redirects. */
  url: string;
  title: string;
  heading: string;
  body: string;
  priceText: string;
  purchaseText: string;
  structuredData: string[];
  /** The picture the page names for sharing (`og:image`); empty when it names none. */
  imageUrl: string;
}
