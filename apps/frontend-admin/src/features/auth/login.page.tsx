import {
  Alert,
  Button,
  Card,
  Container,
  Group,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import type { TFunction } from 'i18next';
import { type ReactElement, type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';

import { LanguageControl } from '../../app/language.component.js';
import { ApiError } from '../../shared/api/api-error.error.js';
import { useLogin, useMe } from './use-me.hook.js';

/** What the person is told of a refusal: the hub's own words say too little of a wrong login. */
function explain(error: Error, t: TFunction): string {
  if (!(error instanceof ApiError)) return t('errors.unreachable');
  if (error.status === 401) return t('login.wrongCredentials');
  if (error.status === 429) {
    const wait =
      error.retryAfterSeconds === null
        ? ''
        : ` ${t('errors.tryAgain', { seconds: error.retryAfterSeconds })}`;

    return `${t('login.tooManyAttempts')}${wait}`;
  }

  return error.message;
}

export function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (me.data !== null && me.data !== undefined) return <Navigate to="/" replace />;

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    login.mutate({ email, password }, { onSuccess: (): void => void navigate('/') });
  };

  return (
    <Container size="xs" mt={96}>
      <Card withBorder padding="xl">
        <form onSubmit={submit}>
          <Stack>
            <Group justify="space-between">
              <Title order={2}>{t('login.title')}</Title>
              <LanguageControl />
            </Group>
            <TextInput
              label={t('login.email')}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event): void => {
                setEmail(event.currentTarget.value);
              }}
            />
            <PasswordInput
              label={t('login.password')}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event): void => {
                setPassword(event.currentTarget.value);
              }}
            />
            {login.error !== null && (
              <Alert color="red" role="alert">
                {explain(login.error, t)}
              </Alert>
            )}
            <Button type="submit" loading={login.isPending}>
              {t('login.submit')}
            </Button>
          </Stack>
        </form>
      </Card>
    </Container>
  );
}
