import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { hash, verify, parseOptions, Algorithm, Version } from '@node-rs/argon2';

export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$9rY/XLmrbY+M6F1ei7wD6Q$XgNW4Hxog5165dLoXLahFrjmo95F5lKlZP10TsrpzGw';

@Injectable()
export class PasswordHasher {
  private active = 0;
  private readonly queue: (() => void)[] = [];

  hash(password: string): Promise<string> {
    return this.run(() =>
      hash(password, {
        algorithm: Algorithm.Argon2id,
        version: Version.V0x13,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
        outputLen: 32,
      }),
    );
  }
  verify(encoded: string, password: string): Promise<boolean> {
    return this.run(() => verify(encoded, password));
  }
  needsRehash(encoded: string): boolean {
    const p = parseOptions(encoded);
    return (
      p.algorithm !== Algorithm.Argon2id ||
      p.version !== Version.V0x13 ||
      p.memoryCost < 19456 ||
      p.timeCost < 2 ||
      p.outputLen < 32 ||
      p.saltLen < 16
    );
  }
  private async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= 2) {
      if (this.queue.length >= 8)
        throw new ServiceUnavailableException('Authentication is busy. Try again later.');
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await work();
    } catch {
      throw new ServiceUnavailableException('Authentication is unavailable.');
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.active--;
    }
  }
}
