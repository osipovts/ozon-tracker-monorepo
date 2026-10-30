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
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
  jobAcceptedResponseSchema,
  type JobAcceptedResponseType,
} from '../../shared/presentation/job-accepted.type.js';
import {
  paginationQuerySchema,
  type PaginationQueryType,
  toPageResponse,
} from '../../shared/presentation/pagination-query.type.js';
import { requireIdentity } from '../../shared/presentation/request-identity.type.js';
import { AddProductUseCase } from '../application/add-product.use-case.js';
import { ListPriceHistoryUseCase } from '../application/list-price-history.use-case.js';
import { ListProductsUseCase } from '../application/list-products.use-case.js';
import { RemoveProductUseCase } from '../application/remove-product.use-case.js';
import { RequestPriceObservationUseCase } from '../application/request-price-observation.use-case.js';
import type { PriceObservationInterface } from '../domain/price-observation.interface.js';
import type { TrackedProductEntity } from '../domain/tracked-product.entity.js';
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

function toProduct({ snapshot }: TrackedProductEntity): ProductType {
  return { ...snapshot, lastCheckedAt: snapshot.lastCheckedAt?.toISOString() ?? null };
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
    @Inject(RemoveProductUseCase) private readonly removeProduct: RemoveProductUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tracked products with their newest price, the newest first' })
  @ApiOkResponse({ standardSchema: productListResponseSchema })
  async list(
    @Query({ schema: paginationQuerySchema }) query: PaginationQueryType,
    @Req() request: Request,
  ): Promise<ProductListResponseType> {
    const page = await this.listProducts.execute(requireIdentity(request).userId, query);

    return toPageResponse(page, query, ({ product, latest }) => ({
      ...toProduct(product),
      latest: latest === null ? null : toObservation(latest),
    }));
  }

  @Post()
  @ApiOperation({
    summary: 'Track a product by its URL',
    description:
      'Any link to the product page works: it is canonicalized. The users share a product and its ' +
      'price history, each one tracks it for themselves. ' +
      'No price is read yet: use `POST /products/{id}/prices`.',
  })
  @ApiCreatedResponse({ standardSchema: productSchema, description: 'The product is tracked now' })
  @ApiOkResponse({
    standardSchema: productSchema,
    description: 'The user tracked the product already',
  })
  @ApiBadRequestResponse({ description: 'Unsupported marketplace or product URL' })
  async add(
    @Body({ schema: productCreateBodySchema }) body: ProductCreateBodyType,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProductType> {
    const { product, created } = await this.addProduct.execute(
      requireIdentity(request).userId,
      body.url,
    );
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return toProduct(product);
  }

  @Post(':id/prices')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue a read of the fresh price',
    description:
      'Adds an item to the price history once a worker has read the product. ' +
      'Follow the progress with `GET /jobs/{jobId}`: only you can read your job.',
  })
  @ApiAcceptedResponse({ standardSchema: jobAcceptedResponseSchema })
  @ApiNotFoundResponse({ description: 'The product is not tracked' })
  @ApiConflictResponse({ description: 'No alive proxies or sessions are available' })
  request(
    @Param('id', { schema: productIdParamSchema }) id: string,
    @Req() request: Request,
  ): Promise<JobAcceptedResponseType> {
    return this.requestObservation.execute(requireIdentity(request).userId, id);
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

    return { product: toProduct(product), ...toPageResponse(page, query, toObservation) };
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
