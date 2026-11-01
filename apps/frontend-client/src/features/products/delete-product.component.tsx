import { Button, CloseButton, Group, Modal, Stack, Text } from '@mantine/core';
import { ErrorAlert } from 'frontend-shared';
import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDeleteProduct } from './use-products.hook.js';

/** A button that asks to confirm, and stops tracking the product for the user. */
export function DeleteProduct({
  productId,
  title,
  onDeleted,
}: {
  productId: string;
  title: string;
  onDeleted?: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const remove = useDeleteProduct();

  return (
    <>
      <CloseButton
        aria-label={t('product.delete')}
        title={t('product.delete')}
        c="red"
        onClick={(): void => {
          setAsking(true);
        }}
      />
      <Modal
        opened={asking}
        title={t('product.deleteTitle')}
        onClose={(): void => {
          setAsking(false);
        }}
      >
        <Stack>
          <Text>{t('product.deleteText', { title })}</Text>
          {remove.error !== null && <ErrorAlert error={remove.error} />}
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={(): void => {
                setAsking(false);
              }}
            >
              {t('product.cancel')}
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              onClick={(): void => {
                remove.mutate(productId, {
                  onSuccess: (): void => {
                    setAsking(false);
                    onDeleted?.();
                  },
                });
              }}
            >
              {t('product.delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
