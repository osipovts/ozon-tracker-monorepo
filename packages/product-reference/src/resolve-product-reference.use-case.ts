import type { MarketplaceReferenceParserPort } from './marketplace-reference-parser.port.js';
import type { ProductReferenceEntity } from './product-reference.entity.js';

export class ResolveProductReferenceUseCase {
  constructor(private readonly parsers: readonly MarketplaceReferenceParserPort[]) {}

  execute(input: string): ProductReferenceEntity {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new Error('Expected a product URL');
    }
    for (const parser of this.parsers) {
      const reference = parser.parse(url);
      if (reference !== null) return reference;
    }
    throw new Error('Unsupported marketplace or product URL');
  }
}
