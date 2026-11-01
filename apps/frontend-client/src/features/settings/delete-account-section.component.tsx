import { Button, Card, Group, Modal, Stack, Text, TextInput, Title } from '@mantine/core';
import { ErrorAlert } from 'frontend-shared';
import { type ReactElement, type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useMe } from '../auth/use-me.hook.js';
import { useDeleteAccount } from './use-account.hook.js';

/** The way to delete the account for good, behind a confirmation that asks for its email. */
export function DeleteAccountSection(): ReactElement {
  const { t } = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [email, setEmail] = useState('');
  const remove = useDeleteAccount();
  const accountEmail = me.data?.email ?? '';
  const confirmed =
    email.trim().toLowerCase() === accountEmail.toLowerCase() && accountEmail !== '';

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    remove.mutate(email, { onSuccess: (): void => void navigate('/login') });
  };

  return (
    <Card withBorder style={{ borderColor: 'var(--mantine-color-red-6)' }}>
      <Stack gap="sm" align="flex-start">
        <Title order={4}>{t('settings.deleteAccount')}</Title>
        <Text size="sm" c="dimmed">
          {t('settings.deleteHint')}
        </Text>
        <Button
          color="red"
          onClick={(): void => {
            setAsking(true);
          }}
        >
          {t('settings.deleteAccount')}
        </Button>
      </Stack>
      <Modal
        opened={asking}
        title={t('settings.deleteConfirmTitle')}
        onClose={(): void => {
          setAsking(false);
        }}
      >
        <form onSubmit={submit}>
          <Stack>
            <Text>{t('settings.deleteConfirmText', { email: accountEmail })}</Text>
            <TextInput
              label={t('settings.confirmEmail')}
              autoComplete="off"
              value={email}
              onChange={(event): void => {
                setEmail(event.currentTarget.value);
              }}
            />
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
              <Button type="submit" color="red" disabled={!confirmed} loading={remove.isPending}>
                {t('settings.deleteForever')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
}
