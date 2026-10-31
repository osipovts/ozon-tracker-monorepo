import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { applyBodyLimits } from '../shared/presentation/body-limits.type.js';

/**
 * What the hub does to its HTTP application before it listens: the limits of the body, the proxies it
 * stands behind, the shutdown hooks and the docs. The application must be created with `bodyParser: false`.
 */
export function configureApplication(app: NestExpressApplication): void {
  const config = app.get<AppConfigInterface>(APP_CONFIG);

  applyBodyLimits(app);
  // Behind a reverse proxy the address of a client is in X-Forwarded-For; the limits count by it.
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);
  app.enableShutdownHooks();
  SwaggerModule.setup(
    'docs',
    app,
    () =>
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle('Hub')
          .setDescription('Proxies, browser sessions and price tracking of marketplace products')
          .setVersion('1.0')
          .addBearerAuth()
          .addCookieAuth('session')
          .build(),
      ),
    { jsonDocumentUrl: 'docs/json' },
  );
}
