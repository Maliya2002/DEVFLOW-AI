import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export function createDatabaseClient(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 5000,
    query_timeout: 6000,
  });
  return new PrismaClient({ adapter });
}
