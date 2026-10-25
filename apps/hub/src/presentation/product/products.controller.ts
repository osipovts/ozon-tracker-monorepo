import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { AddProductUseCase } from '../../application/product/add-product.use-case.js';
import { ListPriceHistoryUseCase } from '../../application/product/list-price-history.use-case.js';
import { ListProductsUseCase } from '../../application/product/list-products.use-case.js';
import { RequestPriceObservationUseCase } from '../../application/product/request-price-observation.use-case.js';
import type { PriceObservationInterface } from '../../domain/product/price-observation.interface.js';
import type { TrackedProductEntity } from '../../domain/product/tracked-product.entity.js';
import {
  jobAcceptedResponseSchema,
  type JobAcceptedResponseType,
} from '../proxy/proxy-source-refresh.type.js';
import {
  paginationQuerySchema,
  type PaginationQueryType,
} from '../shared/pagination-query.type.js';
import { priceHistoryResponseSchema, type PriceHistoryResponseType } from './price-history.type.js';
import type { PriceObservationType } from './price-observation.type.js';
import {
  productCreateBodySchema,
  type ProductCreateBodyType,
  productIdParamSchema,
  productListResponseSchema,
  type ProductListResponseType,
  productSchema,
  type ProductType,
} from './product.type.js';

function toProduct(product: TrackedProductEntity): ProductType {
  return {
    id: product.id,
    marketplace: product.marketplace,
    externalId: product.externalId,
    url: product.url,
    lastStatus: product.lastStatus,
    lastCheckedAt: product.lastCheckedAt?.toISOString() ?? null,
  };
}

function toObservation(observation: PriceObservationInterface): PriceObservationType {
  return {
    id: observation.id,
    observedAt: observation.observedAt.toISOString(),
    title: observation.title,
    availability: observation.availability,
    prices: observation.prices,
    exitIp: observation.exitIp,
  };
}

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    @Inject(AddProductUseCase) private readonly addProduct: AddProductUseCase,
    @Inject(ListProductsUseCase) private readonly listProducts: ListProductsUseCase,
    @Inject(RequestPriceObservationUseCase)
    private readonly requestObservation: RequestPriceObservationUseCase,
    @Inject(ListPriceHistoryUseCase) private readonly listHistory: ListPriceHistoryUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tracked products with their newest price, the newest first' })
  @ApiOkResponse({ standardSchema: productListResponseSchema })
  async list(
    @Query({ schema: paginationQuerySchema }) query: PaginationQueryType,
  ): Promise<ProductListResponseType> {
    const page = await this.listProducts.execute({ page: query.page, pageSize: query.pageSize });
    return {
      items: page.items.map(({ product, latest }) => ({
        ...toProduct(product),
        latest: latest === null ? null : toObservation(latest),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: page.total,
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Track a product by its URL',
    description:
      'Any link to the product page works: it is canonicalized and a product is tracked once. ' +
      'No price is read yet: use `POST /products/{id}/prices`.',
  })
  @ApiCreatedResponse({ standardSchema: productSchema, description: 'The product is tracked now' })
  @ApiOkResponse({ standardSchema: productSchema, description: 'The product was already tracked' })
  @ApiBadRequestResponse({ description: 'Unsupported marketplace or product URL' })
  async add(
    @Body({ schema: productCreateBodySchema }) body: ProductCreateBodyType,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProductType> {
    const { product, created } = await this.addProduct.execute(body.url);
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return toProduct(product);
  }

  @Post(':id/prices')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue a read of the fresh price',
    description:
      'Adds an item to the price history once a worker has read the product. ' +
      'Follow the progress with `GET /jobs/{jobId}`.',
  })
  @ApiAcceptedResponse({ standardSchema: jobAcceptedResponseSchema })
  @ApiNotFoundResponse({ description: 'The product is not tracked' })
  @ApiConflictResponse({ description: 'No alive proxies or sessions are available' })
  request(
    @Param('id', { schema: productIdParamSchema }) id: string,
  ): Promise<JobAcceptedResponseType> {
    return this.requestObservation.execute(id);
  }

  @Get(':id/prices')
  @ApiOperation({ summary: 'Price history of a product, the newest first' })
  @ApiOkResponse({ standardSchema: priceHistoryResponseSchema })
  @ApiNotFoundResponse({ description: 'The product is not tracked' })
  async prices(
    @Param('id', { schema: productIdParamSchema }) id: string,
    @Query({ schema: paginationQuerySchema }) query: PaginationQueryType,
  ): Promise<PriceHistoryResponseType> {
    const { product, page } = await this.listHistory.execute(id, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      product: toProduct(product),
      items: page.items.map(toObservation),
      page: query.page,
      pageSize: query.pageSize,
      total: page.total,
    };
  }
}
