import {
  Alert,
  Button,
  Card,
  Container,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type { TFunction } from 'i18next';
import { type ReactElement, type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { LanguageControl } from '../../app/language.component.js';
import { ApiError } from '../../shared/api/api-error.error.js';
import { LegalFooter } from '../legal/legal-footer.component.js';
import {
  type OauthProviderType,
  useLogin,
  useMe,
  useOauthProviders,
  useRegister,
} from './use-me.hook.js';

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

const providerNames: Record<OauthProviderType, string> = { google: 'Google', github: 'GitHub' };

/** Buttons that take the browser to the login of a provider, which brings it back logged in. */
function ProviderButtons(): ReactElement | null {
  const { t } = useTranslation();
  const providers = useOauthProviders();

  if (providers.data === undefined || providers.data.length === 0) return null;

  return (
    <Stack gap="xs" mt="md">
      <Divider label={t('login.or')} labelPosition="center" />
      {providers.data.map((provider): ReactElement => (
        <Button
          key={provider}
          component="a"
          href={`/auth/oauth/${provider}/start`}
          variant="default"
        >
          {t('login.continueWith', { provider: providerNames[provider] })}
        </Button>
      ))}
    </Stack>
  );
}

export function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const me = useMe();
  const login = useLogin();
  const register = useRegister();
  const navigate = useNavigate();
  const [mode, setMode] = useState<string | null>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signingUp = mode === 'register';
  const [params] = useSearchParams();
  const oauthFailed = params.get('error') === 'oauth';
  const failure = signingUp ? (register.error ?? login.error) : login.error;

  if (me.data !== null && me.data !== undefined) return <Navigate to="/" replace />;

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const enter = (): void => {
      login.mutate({ email, password }, { onSuccess: (): void => void navigate('/') });
    };
    // Signing up starts no session: the person is logged in right after.
    if (signingUp) register.mutate({ email, password }, { onSuccess: enter });
    else enter();
  };

  return (
    <Container size="xs" mt={{ base: 24, sm: 96 }}>
      <Card withBorder padding="xl">
        <form onSubmit={submit}>
          <Stack>
            <Group justify="space-between">
              <Stack gap={0}>
                <Title order={2}>{t('login.title')}</Title>
                <Text size="sm" c="dimmed">
                  {t('brand.slogan')}
                </Text>
              </Stack>
              <LanguageControl />
            </Group>
            <Tabs value={mode} onChange={setMode}>
              <Tabs.List grow>
                <Tabs.Tab value="login">{t('login.logIn')}</Tabs.Tab>
                <Tabs.Tab value="register">{t('login.signUp')}</Tabs.Tab>
              </Tabs.List>
            </Tabs>
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
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(event): void => {
                setPassword(event.currentTarget.value);
              }}
            />
            {oauthFailed && failure === null && (
              <Alert color="red" role="alert">
                {t('login.oauthFailed')}
              </Alert>
            )}
            {failure !== null && (
              <Alert color="red" role="alert">
                {explain(failure, t)}
              </Alert>
            )}
            <Button type="submit" loading={login.isPending || register.isPending}>
              {signingUp ? t('login.signUp') : t('login.logIn')}
            </Button>
          </Stack>
        </form>
        <ProviderButtons />
      </Card>
      <LegalFooter />
    </Container>
  );
}
