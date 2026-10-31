export interface DnsPageInterface {
  /** The final URL after redirects. */
  url: string;
  heading: string;
  /** What the buying block of the card shows as the price. */
  priceText: string;
  /** The button to put the product into the cart: the product is in stock. */
  hasBuyButton: boolean;
  /** The button to be told when the product arrives: the product is out of stock. */
  hasNotifyButton: boolean;
  /** The picture of the product; empty when the page names none. */
  imageUrl: string;
}
