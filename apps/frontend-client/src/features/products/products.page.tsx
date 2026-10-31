import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Pagination,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { type ReactElement, type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useLocale } from '../../i18n/use-locale.hook.js';
import { ErrorAlert } from '../../shared/api/error-alert.component.js';
import { DeleteProduct } from './delete-product.component.js';
import { formatMoment } from './moment-format.type.js';
import { describeNextCheck } from './next-check.type.js';
import { formatPrice } from './price-format.type.js';
import {
  type ProductListItemType,
  productPageSize,
  useAddProduct,
  useProducts,
} from './use-products.hook.js';

/** Below this width the list is a stack of cards: a table of five columns does not fit a phone. */
const phoneWidthQuery = '(max-width: 47.99em)';

function titleOf(item: ProductListItemType): string {
  return item.latest?.title ?? `${item.marketplace} ${item.externalId}`;
}

function AddProduct(): ReactElement {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const add = useAddProduct();

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    add.mutate(url, {
      onSuccess: (): void => {
        setUrl('');
      },
    });
  };

  return (
    <Card withBorder>
      <form onSubmit={submit}>
        <Stack gap="xs">
          <Group align="flex-end">
            <TextInput
              flex="1 1 16rem"
              label={t('products.linkLabel')}
              placeholder="https://www.ozon.ru/product/..."
              type="url"
              required
              value={url}
              onChange={(event): void => {
                setUrl(event.currentTarget.value);
              }}
            />
            <Button type="submit" loading={add.isPending}>
              {t('products.track')}
            </Button>
          </Group>
          {add.error !== null && <ErrorAlert error={add.error} />}
        </Stack>
      </form>
    </Card>
  );
}

function NextCheck({ at }: { at: string | null }): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const next = describeNextCheck(at, new Date(), locale);

  if (next === null) return <>-</>;

  return <>{next.soon ? t('products.soon') : next.when}</>;
}

function Price({ item }: { item: ProductListItemType }): ReactElement {
  const { t } = useTranslation();
  const price = item.latest?.prices[0];

  if (item.latest === null) return <Badge color="gray">{t('products.waiting')}</Badge>;
  if (price === undefined) return <Badge color="yellow">{t('products.noPrice')}</Badge>;

  return <>{formatPrice(price.amountMinor)}</>;
}

function RemoveButton({
  item,
  onDeleted,
}: {
  item: ProductListItemType;
  onDeleted: () => void;
}): ReactElement {
  return <DeleteProduct productId={item.id} title={titleOf(item)} onDeleted={onDeleted} />;
}

function ProductTable({
  items,
  onDeleted,
}: {
  items: ProductListItemType[];
  onDeleted: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('products.product')}</Table.Th>
          <Table.Th>{t('products.price')}</Table.Th>
          <Table.Th>{t('products.checked')}</Table.Th>
          <Table.Th>{t('products.nextCheck')}</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((item): ReactElement => (
          <Table.Tr key={item.id}>
            <Table.Td>
              {/* A title can be a paragraph: one line of the table, the whole of it in the hint. */}
              <Text
                component={Link}
                to={`/products/${item.id}`}
                fw={500}
                display="block"
                maw={520}
                truncate="end"
                title={titleOf(item)}
              >
                {titleOf(item)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Price item={item} />
            </Table.Td>
            <Table.Td>
              {item.lastCheckedAt === null ? '-' : formatMoment(item.lastCheckedAt, locale)}
            </Table.Td>
            <Table.Td>
              <NextCheck at={item.nextCheckAt} />
            </Table.Td>
            <Table.Td>
              <RemoveButton item={item} onDeleted={onDeleted} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function ProductCards({
  items,
  onDeleted,
}: {
  items: ProductListItemType[];
  onDeleted: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <Stack gap="sm">
      {items.map((item): ReactElement => (
        <Card key={item.id} withBorder padding="sm">
          <Stack gap={6}>
            <Text component={Link} to={`/products/${item.id}`} fw={500} lineClamp={2}>
              {titleOf(item)}
            </Text>
            <Group justify="space-between" align="center" wrap="nowrap">
              <Text fw={600} size="lg">
                <Price item={item} />
              </Text>
              <RemoveButton item={item} onDeleted={onDeleted} />
            </Group>
            <Text size="xs" c="dimmed">
              {t('products.checked')}:{' '}
              {item.lastCheckedAt === null ? '-' : formatMoment(item.lastCheckedAt, locale)}
              {' · '}
              {t('products.nextCheck')}: <NextCheck at={item.nextCheckAt} />
            </Text>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

export function ProductsPage(): ReactElement {
  const { t } = useTranslation();
  const phone = useMediaQuery(phoneWidthQuery);
  const [page, setPage] = useState(1);
  const products = useProducts(page);
  const data = products.data;
  // The last product of a page is gone: the page goes with it.
  const onDeleted = (): void => {
    if (data?.items.length === 1 && page > 1) setPage(page - 1);
  };

  return (
    <Stack>
      <Title order={2}>{t('products.title')}</Title>
      <AddProduct />
      {products.isError && <ErrorAlert error={products.error} />}
      {data === undefined ? (
        !products.isError && <Loader />
      ) : (
        <>
          {phone ? (
            <ProductCards items={data.items} onDeleted={onDeleted} />
          ) : (
            <ProductTable items={data.items} onDeleted={onDeleted} />
          )}
          {data.items.length === 0 && <Text c="dimmed">{t('products.empty')}</Text>}
          <Pagination
            total={Math.max(1, Math.ceil(data.total / productPageSize))}
            value={page}
            onChange={setPage}
          />
        </>
      )}
    </Stack>
  );
}
