import { Button, Container, Stack, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';

import { useLogout } from '../features/auth/use-me.hook.js';

/** For a user who is signed in and is no administrator: the panel is not theirs. */
export function AccessDenied({ email }: { email: string }): ReactElement {
  const logout = useLogout();

  return (
    <Container size="xs" mt={96}>
      <Stack>
        <Title order={2}>No access</Title>
        <Text>
          {email} is not an administrator of the hub. An administrator is a user whose email is on
          the list of the hub and is confirmed.
        </Text>
        <Button
          variant="default"
          loading={logout.isPending}
          onClick={(): void => {
            logout.mutate();
          }}
        >
          Log out
        </Button>
      </Stack>
    </Container>
  );
}
