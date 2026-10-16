import { createDatabaseClient } from '../dist/database/client.js';
import { parseDatabaseUrl } from '../dist/database/config.js';
import { DatabaseService } from '../dist/database/database.service.js';

const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;
databaseTests('Real PostgreSQL adapter integration (TEST_DATABASE_URL)', () => {
  it('executes a Prisma probe and releases its connection', async () => {
    const url = parseDatabaseUrl(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');
    const service = new DatabaseService(createDatabaseClient(url));
    try {
      expect(await service.isReady()).toBe(true);
    } finally {
      await service.onModuleDestroy();
    }
  }, 15000);
});
