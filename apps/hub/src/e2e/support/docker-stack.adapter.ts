import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** apps/hub: where the Prisma config and the migrations are, from dist/e2e/support. */
const hubDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export interface S3StackInterface {
  /** Where the hub reaches the service, and where a browser does: here the same address. */
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface DockerStackInterface {
  databaseUrl: string;
  redisUrl: string;
  /** Present when the stack was started with an S3 service. */
  s3?: S3StackInterface;
}

export interface StackOptionsInterface {
  /** Starts an S3 service as well: the pictures of the products are kept in it. */
  s3?: boolean;
}

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject): void => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', (): void => {
      const address = server.address();
      server.close((): void => {
        if (address === null || typeof address === 'string') reject(new Error('No free port'));
        else resolve(address.port);
      });
    });
  });
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve): void => {
    setTimeout(resolve, ms);
  });

/**
 * The real Postgres and Redis of a test of the whole hub, in throwaway containers of their own on free
 * ports (never the ones of another project), with the migrations of the hub applied.
 */
export class DockerStackAdapter {
  private readonly names: string[] = [];

  async start(options: StackOptionsInterface = {}): Promise<DockerStackInterface> {
    const [postgresPort, redisPort] = [await freePort(), await freePort()];
    const [postgres, redis] = [this.name('postgres'), this.name('redis')];

    await Promise.all([
      run('docker', [
        'run',
        '-d',
        '--rm',
        '--name',
        postgres,
        '-e',
        'POSTGRES_PASSWORD=e2e',
        '-e',
        'POSTGRES_DB=hub',
        '-p',
        `127.0.0.1:${String(postgresPort)}:5432`,
        'postgres:17-alpine',
      ]),
      run('docker', [
        'run',
        '-d',
        '--rm',
        '--name',
        redis,
        '-p',
        `127.0.0.1:${String(redisPort)}:6379`,
        'redis:7-alpine',
      ]),
    ]);

    await Promise.all([
      // Over TCP: the server that the image starts first listens on a socket only, and is then restarted.
      this.untilReady(postgres, [
        'psql',
        '-U',
        'postgres',
        '-d',
        'hub',
        '-h',
        '127.0.0.1',
        '-c',
        'select 1',
      ]),
      this.untilReady(redis, ['redis-cli', 'ping']),
    ]);

    const databaseUrl = `postgresql://postgres:e2e@127.0.0.1:${String(postgresPort)}/hub`;
    await run(
      process.execPath,
      [join(hubDirectory, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
      { cwd: hubDirectory, env: { ...process.env, DATABASE_URL: databaseUrl } },
    );

    return {
      databaseUrl,
      redisUrl: `redis://127.0.0.1:${String(redisPort)}`,
      ...(options.s3 === true ? { s3: await this.startS3() } : {}),
    };
  }

  /** A real S3 service (SeaweedFS), with keys of the test. */
  private async startS3(): Promise<S3StackInterface> {
    const [port, name] = [await freePort(), this.name('s3')];
    const [accessKeyId, secretAccessKey] = ['e2e-key', 'e2e-secret-0123456789'];

    await run('docker', [
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      '-e',
      `AWS_ACCESS_KEY_ID=${accessKeyId}`,
      '-e',
      `AWS_SECRET_ACCESS_KEY=${secretAccessKey}`,
      '-p',
      `127.0.0.1:${String(port)}:8333`,
      'chrislusf/seaweedfs:4.50',
      'server',
      '-dir=/data',
      '-s3',
      '-s3.port=8333',
      '-ip.bind=0.0.0.0',
    ]);
    // The gateway answers once it is up, with a refusal of an anonymous request, which is an answer.
    await this.untilReady(name, ['curl', '-s', '-o', '/dev/null', 'http://localhost:8333/']);

    return { endpoint: `http://127.0.0.1:${String(port)}`, accessKeyId, secretAccessKey };
  }

  async stop(): Promise<void> {
    await Promise.all(
      this.names.map((name): Promise<unknown> =>
        run('docker', ['stop', '-t', '1', name]).catch((): null => null),
      ),
    );
  }

  private name(kind: string): string {
    const name = `pt-e2e-${kind}-${randomBytes(4).toString('hex')}`;
    this.names.push(name);

    return name;
  }

  private async untilReady(container: string, command: string[]): Promise<void> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try {
        await run('docker', ['exec', container, ...command]);

        return;
      } catch {
        await wait(500);
      }
    }

    throw new Error(`${container} did not become ready`);
  }
}
