import {
  Alert,
  Button,
  Card,
  Container,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { type ReactElement, type SyntheticEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { ApiError } from '../../shared/api/api-error.error.js';
import { useLogin, useMe } from './use-me.hook.js';

/** What the person is told of a refusal: the hub's own words say too little of a wrong login. */
function explain(error: Error): string {
  if (!(error instanceof ApiError)) return 'The hub could not be reached.';
  if (error.status === 401) return 'The email or the password is wrong.';
  if (error.status === 429) {
    return `Too many attempts.${error.retryAfterSeconds === null ? '' : ` Try again in ${String(error.retryAfterSeconds)} s.`}`;
  }

  return error.message;
}

export function LoginPage(): ReactElement {
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
            <Title order={2}>Hub admin</Title>
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(event): void => {
                setPassword(event.currentTarget.value);
              }}
            />
            {login.error !== null && (
              <Alert color="red" role="alert">
                {explain(login.error)}
              </Alert>
            )}
            <Button type="submit" loading={login.isPending}>
              Log in
            </Button>
          </Stack>
        </form>
      </Card>
    </Container>
  );
}
