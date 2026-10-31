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
import { Link } from 'react-router';

import { ErrorAlert } from '../../shared/api/error-alert.component.js';
import { formatPrice } from './price-format.type.js';
import { productPageSize, useAddProduct, useProducts } from './use-products.hook.js';

function AddProduct(): ReactElement {
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
              label="Link to a product"
              placeholder="https://www.ozon.ru/product/..."
              type="url"
              required
              value={url}
              onChange={(event): void => {
                setUrl(event.currentTarget.value);
              }}
            />
            <Button type="submit" loading={add.isPending}>
              Track
            </Button>
          </Group>
          {add.error !== null && <ErrorAlert error={add.error} />}
        </Stack>
      </form>
    </Card>
  );
}

export function ProductsPage(): ReactElement {
  const [page, setPage] = useState(1);
  const products = useProducts(page);
  const data = products.data;

  return (
    <Stack>
      <Title order={2}>Products</Title>
      <AddProduct />
      {products.isError && <ErrorAlert error={products.error} />}
      {data === undefined ? (
        !products.isError && <Loader />
      ) : (
        <>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th>Price</Table.Th>
                <Table.Th>Checked</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((item): ReactElement => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Text component={Link} to={`/products/${item.id}`} fw={500}>
                      {item.latest?.title ?? `${item.marketplace} ${item.externalId}`}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {item.latest === null ? (
                      <Badge color="gray">waiting for the first price</Badge>
                    ) : item.latest.prices[0] === undefined ? (
                      <Badge color="yellow">no price</Badge>
                    ) : (
                      formatPrice(item.latest.prices[0].amountMinor)
                    )}
                  </Table.Td>
                  <Table.Td>
                    {item.lastCheckedAt === null
                      ? '-'
                      : new Date(item.lastCheckedAt).toLocaleString()}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {data.items.length === 0 && <Text c="dimmed">Nothing is tracked yet.</Text>}
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
