import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { hash, Algorithm, Version } from '@node-rs/argon2';

@Injectable()
export class PasswordHasher {
  private active = 0;
  private readonly queue: (() => void)[] = [];

  async hash(password: string): Promise<string> {
    if (this.active >= 2) {
      if (this.queue.length >= 8)
        throw new ServiceUnavailableException('Registration is busy. Try again later.');
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await hash(password, {
        algorithm: Algorithm.Argon2id,
        version: Version.V0x13,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
        outputLen: 32,
      });
    } catch {
      throw new ServiceUnavailableException('Registration is unavailable.');
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.active--;
    }
  }
}
