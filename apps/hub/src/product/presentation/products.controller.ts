import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import {
  paginationQuerySchema,
  type PaginationQueryType,
  toPageResponse,
} from '../../shared/presentation/pagination-query.type.js';
import { requireIdentity } from '../../shared/presentation/request-identity.type.js';
import { AddProductUseCase } from '../application/add-product.use-case.js';
import { GetProductThumbnailUrlUseCase } from '../application/get-product-thumbnail-url.use-case.js';
import { ListPriceHistoryUseCase } from '../application/list-price-history.use-case.js';
import { ListProductsUseCase } from '../application/list-products.use-case.js';
import { nextPriceCheckAt } from '../application/next-price-check.type.js';
import { priceRefreshScheduleOf } from '../application/price-refresh-schedule.type.js';
import { RemoveProductUseCase } from '../application/remove-product.use-case.js';
import type { PriceObservationInterface } from '../domain/price-observation.interface.js';
import type { TrackedProductEntity } from '../domain/tracked-product.entity.js';
import { priceHistoryResponseSchema, type PriceHistoryResponseType } from './price-history.type.js';
import type { PriceObservationType } from './price-observation.type.js';
import {
  productAddedSchema,
  type ProductAddedType,
  productCreateBodySchema,
  type ProductCreateBodyType,
  productIdParamSchema,
  type ProductListItemType,
  productListResponseSchema,
  type ProductListResponseType,
  type ProductType,
} from './product.type.js';

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
    @Inject(ListPriceHistoryUseCase) private readonly listHistory: ListPriceHistoryUseCase,
    @Inject(RemoveProductUseCase) private readonly removeProduct: RemoveProductUseCase,
    @Inject(GetProductThumbnailUrlUseCase)
    private readonly thumbnailUrl: GetProductThumbnailUrlUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfigInterface,
  ) {}

  private async toProduct({ snapshot }: TrackedProductEntity): Promise<ProductType> {
    const next = nextPriceCheckAt(
      snapshot,
      {
        schedule: priceRefreshScheduleOf({
          intervalMs: this.config.priceRefreshIntervalMs,
          minute: this.config.priceRefreshMinute,
        }),
        maxAgeMs: this.config.priceRefreshMaxAgeMs,
      },
      new Date(),
    );

    return {
      id: snapshot.id,
      marketplace: snapshot.marketplace,
      externalId: snapshot.externalId,
      url: snapshot.url,
      lastStatus: snapshot.lastStatus,
      lastCheckedAt: snapshot.lastCheckedAt?.toISOString() ?? null,
      nextCheckAt: next?.toISOString() ?? null,
      thumbnailUrl: await this.thumbnailUrl.execute(snapshot.thumbnailKey),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List tracked products with their newest price, the newest first' })
  @ApiOkResponse({ standardSchema: productListResponseSchema })
  async list(
    @Query({ schema: paginationQuerySchema }) query: PaginationQueryType,
    @Req() request: Request,
  ): Promise<ProductListResponseType> {
    const page = await this.listProducts.execute(requireIdentity(request).userId, query);

    const items = await Promise.all(
      page.items.map(async ({ product, latest }): Promise<ProductListItemType> => ({
        ...(await this.toProduct(product)),
        latest: latest === null ? null : toObservation(latest),
      })),
    );

    return { items, page: query.page, pageSize: query.pageSize, total: page.total };
  }

  @Post()
  @ApiOperation({
    summary: 'Track a product by its URL',
    description:
      'Any link to the product page works: it is canonicalized. The users share a product and its ' +
      'price history, each one tracks it for themselves. A product that has no price yet gets the read ' +
      'of its first price queued, which `jobId` names: follow it with `GET /jobs/{jobId}`. A user tracks ' +
      'a limited number of products and adds them at a limited rate.',
  })
  @ApiCreatedResponse({
    standardSchema: productAddedSchema,
    description: 'The product is tracked now',
  })
  @ApiOkResponse({
    standardSchema: productAddedSchema,
    description: 'The user tracked the product already',
  })
  @ApiBadRequestResponse({ description: 'Unsupported marketplace or product URL' })
  @ApiForbiddenResponse({ description: 'The user tracks the most products the hub allows' })
  @ApiTooManyRequestsResponse({ description: 'The user adds products too fast' })
  async add(
    @Body({ schema: productCreateBodySchema }) body: ProductCreateBodyType,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProductAddedType> {
    const { product, created, jobId } = await this.addProduct.execute(
      requireIdentity(request).userId,
      body.url,
    );
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return { ...(await this.toProduct(product)), jobId };
  }

  @Get(':id/prices')
  @ApiOperation({ summary: 'Price history of a product, the newest first' })
  @ApiOkResponse({ standardSchema: priceHistoryResponseSchema })
  @ApiNotFoundResponse({ description: 'The product is not tracked' })
  async prices(
    @Param('id', { schema: productIdParamSchema }) id: string,
    @Query({ schema: paginationQuerySchema }) query: PaginationQueryType,
    @Req() request: Request,
  ): Promise<PriceHistoryResponseType> {
    const { product, page } = await this.listHistory.execute(
      requireIdentity(request).userId,
      id,
      query,
    );

    return {
      product: await this.toProduct(product),
      ...toPageResponse(page, query, toObservation),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Stop tracking a product',
    description:
      'The product is shared: it is deleted with its price history only when nobody tracks it any more.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'The product is not tracked' })
  async remove(
    @Param('id', { schema: productIdParamSchema }) id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.removeProduct.execute(requireIdentity(request).userId, id);
  }
}
