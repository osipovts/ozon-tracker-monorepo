import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { PasswordHasherPort } from '../application/password-hasher.port.js';

const argon2Async = promisify(argon2);

export interface Argon2idCostInterface {
  /** Memory, in KiB. */
  memoryKib: number;
  passes: number;
  parallelism: number;
}

/** The OWASP minimum for argon2id: 19 MiB, 2 passes, 1 lane. */
const defaultCost: Argon2idCostInterface = { memoryKib: 19456, passes: 2, parallelism: 1 };

const saltLength = 16;
const tagLength = 32;

/** The PHC string format: `$argon2id$v=19$m=<KiB>,t=<passes>,p=<lanes>$<salt>$<hash>`. */
const phcPattern =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/** The cost lives in the hash, so raising the default does not invalidate the stored hashes. */
export class Argon2idPasswordHasherAdapter implements PasswordHasherPort {
  constructor(private readonly cost: Argon2idCostInterface = defaultCost) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(saltLength);
    const tag = await this.derive(password, salt, tagLength, this.cost);
    const { memoryKib, passes, parallelism } = this.cost;

    return `$argon2id$v=19$m=${String(memoryKib)},t=${String(passes)},p=${String(parallelism)}$${salt.toString('base64').replaceAll('=', '')}$${tag.toString('base64').replaceAll('=', '')}`;
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    const match = phcPattern.exec(passwordHash);
    if (match === null) return false;

    const [, memoryKib, passes, parallelism, salt, tag] = match;
    if (
      memoryKib === undefined ||
      passes === undefined ||
      parallelism === undefined ||
      salt === undefined ||
      tag === undefined
    ) {
      return false;
    }

    const expected = Buffer.from(tag, 'base64');

    try {
      const actual = await this.derive(password, Buffer.from(salt, 'base64'), expected.length, {
        memoryKib: Number(memoryKib),
        passes: Number(passes),
        parallelism: Number(parallelism),
      });

      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  private derive(
    password: string,
    salt: Buffer,
    length: number,
    cost: Argon2idCostInterface,
  ): Promise<Buffer> {
    return argon2Async('argon2id', {
      message: password,
      nonce: salt,
      parallelism: cost.parallelism,
      tagLength: length,
      memory: cost.memoryKib,
      passes: cost.passes,
    });
  }
}
