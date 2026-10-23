import { sayHello } from './lib.js';

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`Received ${signal}, shutting down`);
  // Close servers, database connections, etc. here
  process.exit(0);
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

sayHello();
