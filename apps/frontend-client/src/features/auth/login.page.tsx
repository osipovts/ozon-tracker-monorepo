import {
  Alert,
  Button,
  Card,
  Container,
  PasswordInput,
  Stack,
  Tabs,
  TextInput,
  Title,
} from '@mantine/core';
import { type ReactElement, type SyntheticEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { ApiError } from '../../shared/api/api-error.error.js';
import { useLogin, useMe, useRegister } from './use-me.hook.js';

/** What the person is told of a refusal: the hub's own words say too little of a wrong login. */
function explain(error: Error): string {
  if (!(error instanceof ApiError)) return 'The hub could not be reached.';
  if (error.status === 401) {
    return 'The email or the password is wrong. If you have signed up just now with an email that already has an account, log in with the password of that account.';
  }
  if (error.status === 429) {
    return `Too many attempts.${error.retryAfterSeconds === null ? '' : ` Try again in ${String(error.retryAfterSeconds)} s.`}`;
  }

  return error.message;
}

export function LoginPage(): ReactElement {
  const me = useMe();
  const login = useLogin();
  const register = useRegister();
  const navigate = useNavigate();
  const [mode, setMode] = useState<string | null>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signingUp = mode === 'register';
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
    <Container size="xs" mt={96}>
      <Card withBorder padding="xl">
        <form onSubmit={submit}>
          <Stack>
            <Title order={2}>Price tracker</Title>
            <Tabs value={mode} onChange={setMode}>
              <Tabs.List grow>
                <Tabs.Tab value="login">Log in</Tabs.Tab>
                <Tabs.Tab value="register">Sign up</Tabs.Tab>
              </Tabs.List>
            </Tabs>
            <TextInput
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event): void => {
                setEmail(event.currentTarget.value);
              }}
            />
            <PasswordInput
              label="Password"
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(event): void => {
                setPassword(event.currentTarget.value);
              }}
            />
            {failure !== null && (
              <Alert color="red" role="alert">
                {explain(failure)}
              </Alert>
            )}
            <Button type="submit" loading={login.isPending || register.isPending}>
              {signingUp ? 'Sign up' : 'Log in'}
            </Button>
          </Stack>
        </form>
      </Card>
    </Container>
  );
}
