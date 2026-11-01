import { Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { useLocale } from '../../i18n/use-locale.hook.js';
import { ErrorAlert } from '../../shared/api/error-alert.component.js';
import { formatMoment } from '../products/moment-format.type.js';
import { describeDevice } from './device-name.type.js';
import {
  type DeviceSessionType,
  useDeviceSessions,
  useRevokeOtherSessions,
  useRevokeSession,
} from './use-account.hook.js';

function DeviceRow({ session }: { session: DeviceSessionType }): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const revoke = useRevokeSession();

  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Stack gap={2}>
        <Group gap="xs">
          <Text fw={500}>{describeDevice(session.userAgent) ?? t('settings.unknownDevice')}</Text>
          {session.current && <Badge>{t('settings.thisDevice')}</Badge>}
        </Group>
        <Text size="xs" c="dimmed">
          {session.ip ?? '-'} ·{' '}
          {t('settings.lastSeen', { when: formatMoment(session.lastSeenAt, locale) })}
        </Text>
        {revoke.error !== null && <ErrorAlert error={revoke.error} />}
      </Stack>
      {!session.current && (
        <Button
          size="xs"
          variant="light"
          color="red"
          loading={revoke.isPending}
          onClick={(): void => {
            revoke.mutate(session.id);
          }}
        >
          {t('settings.signOut')}
        </Button>
      )}
    </Group>
  );
}

/** The devices the person is signed in on, and the way to sign the others out. */
export function SessionsSection(): ReactElement {
  const { t } = useTranslation();
  const sessions = useDeviceSessions();
  const revokeOthers = useRevokeOtherSessions();
  const others = sessions.data?.filter((session): boolean => !session.current) ?? [];

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>{t('settings.sessions')}</Title>
        <Text size="sm" c="dimmed">
          {t('settings.sessionsHint')}
        </Text>
        {sessions.isError && <ErrorAlert error={sessions.error} />}
        {sessions.data === undefined
          ? !sessions.isError && <Loader size="sm" />
          : sessions.data.map((session): ReactElement => (
              <DeviceRow key={session.id} session={session} />
            ))}
        {revokeOthers.error !== null && <ErrorAlert error={revokeOthers.error} />}
        {others.length > 0 && (
          <Group>
            <Button
              color="red"
              loading={revokeOthers.isPending}
              onClick={(): void => {
                revokeOthers.mutate();
              }}
            >
              {t('settings.signOutOthers')}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
