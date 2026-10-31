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
import { type ReactElement, type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useLocale } from '../../i18n/use-locale.hook.js';
import { ErrorAlert } from '../../shared/api/error-alert.component.js';
import { DeleteProduct } from './delete-product.component.js';
import { describeNextCheck } from './next-check.type.js';
import { formatPrice } from './price-format.type.js';
import { productPageSize, useAddProduct, useProducts } from './use-products.hook.js';

function NextCheck({ at }: { at: string | null }): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const next = describeNextCheck(at, new Date(), locale);

  if (next === null) return <>-</>;

  return <>{next.soon ? t('products.soon') : next.when}</>;
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
              flex={1}
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

export function ProductsPage(): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const products = useProducts(page);
  const data = products.data;

  return (
    <Stack>
      <Title order={2}>{t('products.title')}</Title>
      <AddProduct />
      {products.isError && <ErrorAlert error={products.error} />}
      {data === undefined ? (
        !products.isError && <Loader />
      ) : (
        <>
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
              {data.items.map((item): ReactElement => (
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
                      title={item.latest?.title ?? `${item.marketplace} ${item.externalId}`}
                    >
                      {item.latest?.title ?? `${item.marketplace} ${item.externalId}`}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {item.latest === null ? (
                      <Badge color="gray">{t('products.waiting')}</Badge>
                    ) : item.latest.prices[0] === undefined ? (
                      <Badge color="yellow">{t('products.noPrice')}</Badge>
                    ) : (
                      formatPrice(item.latest.prices[0].amountMinor)
                    )}
                  </Table.Td>
                  <Table.Td>
                    {item.lastCheckedAt === null
                      ? '-'
                      : new Date(item.lastCheckedAt).toLocaleString(locale)}
                  </Table.Td>
                  <Table.Td>
                    <NextCheck at={item.nextCheckAt} />
                  </Table.Td>
                  <Table.Td>
                    <DeleteProduct
                      productId={item.id}
                      title={item.latest?.title ?? `${item.marketplace} ${item.externalId}`}
                      onDeleted={(): void => {
                        // The last product of a page is gone: the page goes with it.
                        if (data.items.length === 1 && page > 1) setPage(page - 1);
                      }}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
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
