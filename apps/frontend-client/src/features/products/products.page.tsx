import './waiting-glint.css';

import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  type OptionsFilter,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ErrorAlert, useLocale } from 'frontend-shared';
import { type ReactElement, type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { linkHasCities } from './city-link.type.js';
import { DeleteProduct } from './delete-product.component.js';
import { formatMoment } from './moment-format.type.js';
import { describeNextCheck } from './next-check.type.js';
import { type PendingAddInterface, readPendingAdd } from './pending-add.type.js';
import { formatPrice } from './price-format.type.js';
import { ProductThumbnail } from './product-thumbnail.component.js';
import {
  type ProductListItemType,
  productPageSize,
  useAddProduct,
  useCities,
  useProducts,
} from './use-products.hook.js';

/** How long a product may be added before the user is told that it can take minutes. */
const slowAddDelayMs = 5000;

function titleOf(item: ProductListItemType): string {
  return item.latest?.title ?? `${item.marketplace} ${item.externalId}`;
}

/** The hub gives the cities that match, the best first: the list is not filtered again here. */
const keepAll: OptionsFilter = ({ options }) => options;

function cityLabel(city: { name: string; region: string | null }): string {
  return city.region === null ? city.name : `${city.name} (${city.region})`;
}

/** Searches the cities of the marketplace by what is typed, and tells the one that is chosen. */
function CityField({
  disabled,
  chosen,
  onChoose,
}: {
  disabled: boolean;
  chosen: { value: string; label: string } | null;
  onChoose: (city: { value: string; label: string } | null) => void;
}): ReactElement {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const cities = useCities(search, true);
  const found = (cities.data ?? []).map((city): { value: string; label: string } => ({
    value: city.id,
    label: cityLabel(city),
  }));
  // The chosen city stays among the options when the search moves on, or the field would lose its name.
  const options =
    chosen === null || found.some((city): boolean => city.value === chosen.value)
      ? found
      : [chosen, ...found];

  return (
    <Select
      label={t('products.city')}
      description={t('products.cityHint')}
      placeholder={t('products.cityPlaceholder')}
      nothingFoundMessage={t('products.cityNothing')}
      searchable
      clearable
      disabled={disabled}
      data={options}
      value={chosen?.value ?? null}
      searchValue={search}
      filter={keepAll}
      onSearchChange={setSearch}
      onChange={(value, option): void => {
        onChoose(value === null || option === null ? null : { value, label: option.label });
      }}
    />
  );
}

function AddProduct(): ReactElement {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [city, setCity] = useState<{ value: string; label: string } | null>(null);
  const add = useAddProduct();
  const [slow, setSlow] = useState(false);
  const resumed = useRef(false);

  useEffect((): (() => void) | undefined => {
    if (!add.isPending) return undefined;

    const timer = setTimeout((): void => {
      setSlow(true);
    }, slowAddDelayMs);

    return (): void => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [add.isPending]);

  const track = (adding: PendingAddInterface): void => {
    add.mutate(adding, {
      onSuccess: (): void => {
        setUrl('');
        setCity(null);
      },
    });
  };

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    track({ url, cityId: linkHasCities(url) ? (city?.value ?? null) : null });
  };

  // A reload cut the add short, not stopped it: the hub joins it when the same link is sent again.
  useEffect((): void => {
    // Once, when the page opens: React runs the effect twice in development.
    if (resumed.current) return;

    resumed.current = true;
    const pending = readPendingAdd();
    if (pending === null) return;

    setUrl(pending.url);
    track(pending);
  }, []);

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
              disabled={add.isPending}
              value={url}
              onChange={(event): void => {
                setUrl(event.currentTarget.value);
              }}
            />
            <Button type="submit" loading={add.isPending}>
              {t('products.track')}
            </Button>
          </Group>
          {linkHasCities(url) && (
            <CityField disabled={add.isPending} chosen={city} onChoose={setCity} />
          )}
          <Text size="xs" c="dimmed">
            {t('products.supported')}
          </Text>
          {slow && (
            <Text size="xs" c="dimmed">
              {t('products.addSlow')}
            </Text>
          )}
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

  return <>{next.soon ? t('products.soon') : t('products.nextAt', { when: next.when })}</>;
}

function Price({ item }: { item: ProductListItemType }): ReactElement {
  const { t } = useTranslation();
  const price = item.latest?.prices[0];

  if (item.latest === null) return <Badge color="gray">{t('products.waiting')}</Badge>;
  if (price === undefined) return <Badge color="yellow">{t('products.noPrice')}</Badge>;

  return <>{formatPrice(price.amountMinor)}</>;
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
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
      {items.map((item): ReactElement => (
        <Card
          key={item.id}
          withBorder
          padding="sm"
          // Still waiting for the first price: a glint runs over the card until it comes.
          data-waiting={item.latest === null ? 'true' : undefined}
        >
          <Group wrap="nowrap" align="flex-start" gap="sm">
            <ProductThumbnail url={item.thumbnailUrl} alt={titleOf(item)} size={88} />
            <Stack gap={6} flex={1} miw={0}>
              {/* A title can be a paragraph: two lines of the card, the whole of it in the hint. */}
              <Text
                component={Link}
                to={`/products/${item.id}`}
                fw={500}
                lineClamp={2}
                title={titleOf(item)}
              >
                {titleOf(item)}
              </Text>
              {item.cityName !== null && (
                <Text size="xs" c="dimmed">
                  {t('products.cityOf', { name: item.cityName })}
                </Text>
              )}
              <Text fw={600} size="lg">
                <Price item={item} />
              </Text>
              {item.latest === null && (
                <Text size="xs" c="dimmed">
                  {t('products.waitingHint')}
                </Text>
              )}
              {/* The gap above is 6: this block is 9 away from the price (one and a half times) and its lines 1 apart (a third). */}
              <Stack gap={1} mt={3}>
                <Text size="sm" c="dimmed">
                  {t('products.checked')}:{' '}
                  {item.lastCheckedAt === null ? '-' : formatMoment(item.lastCheckedAt, locale)}
                </Text>
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    {t('products.nextCheck')}: <NextCheck at={item.nextCheckAt} />
                  </Text>
                  <DeleteProduct productId={item.id} title={titleOf(item)} onDeleted={onDeleted} />
                </Group>
              </Stack>
            </Stack>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}

export function ProductsPage(): ReactElement {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const products = useProducts(page);
  const data = products.data;
  // The last product of a page is gone: the page goes with it.
  const onDeleted = (): void => {
    if (data?.items.length === 1 && page > 1) setPage(page - 1);
  };

  return (
    <Stack>
      <AddProduct />
      <Title order={2} mt="md">
        {t('products.title')}
      </Title>
      {products.isError && <ErrorAlert error={products.error} />}
      {data === undefined ? (
        !products.isError && <Loader />
      ) : (
        <>
          <ProductCards items={data.items} onDeleted={onDeleted} />
          {data.items.length === 0 && <Text c="dimmed">{t('products.empty')}</Text>}
          {data.total > productPageSize && (
            <Pagination
              total={Math.max(1, Math.ceil(data.total / productPageSize))}
              value={page}
              onChange={setPage}
            />
          )}
        </>
      )}
    </Stack>
  );
}
