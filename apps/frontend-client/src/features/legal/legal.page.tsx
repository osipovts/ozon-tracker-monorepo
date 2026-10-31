import { Anchor, Container, Stack, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LanguageControl } from '../../app/language.component.js';
import { useLocale } from '../../i18n/use-locale.hook.js';
import type { LegalDocumentsType } from './legal-document.type.js';
import { LegalFooter } from './legal-footer.component.js';
import { privacyPolicy } from './privacy-policy.type.js';
import { termsOfService } from './terms-of-service.type.js';

/** A legal text, in the language of the interface (English when it has none in that one). Open to anybody. */
function LegalPage({ documents }: { documents: LegalDocumentsType }): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const document = locale === 'ru' ? documents.ru : documents.en;

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Stack gap="xs" align="flex-start">
          <Anchor component={Link} to="/" size="sm">
            {t('legal.back')}
          </Anchor>
          <LanguageControl size="xs" />
        </Stack>
        <Stack gap={4}>
          <Title order={1}>{document.title}</Title>
          <Text size="sm" c="dimmed">
            {document.updated}
          </Text>
        </Stack>
        {document.sections.map((section): ReactElement => (
          <Stack key={section.heading} gap="xs">
            <Title order={3}>{section.heading}</Title>
            {section.paragraphs.map((paragraph): ReactElement => (
              <Text key={paragraph}>{paragraph}</Text>
            ))}
          </Stack>
        ))}
        <LegalFooter />
      </Stack>
    </Container>
  );
}

export function PrivacyPolicyPage(): ReactElement {
  return <LegalPage documents={privacyPolicy} />;
}

export function TermsOfServicePage(): ReactElement {
  return <LegalPage documents={termsOfService} />;
}
