export interface CityInterface {
  /** The id the marketplace gives the city. */
  id: string;
  name: string;
  /** The region of the city; null when the marketplace tells none. */
  region: string | null;
}
