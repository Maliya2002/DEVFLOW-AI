import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client.js';

export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: PrismaClient | null) {}

  async isReady(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
