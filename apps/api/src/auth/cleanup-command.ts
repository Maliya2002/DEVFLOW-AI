import { createDatabaseClient } from '../database/client.js';
import { parseDatabaseUrl } from '../database/config.js';
import { cleanupAuthHistory } from './cleanup.js';

async function main() {
  const url = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!url) throw new Error('Database is required.');
  const db = createDatabaseClient(url);
  try {
    console.log(JSON.stringify(await cleanupAuthHistory(db)));
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error('Authentication cleanup failed.');
  process.exitCode = 1;
});
