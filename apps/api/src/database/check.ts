import { createDatabaseClient } from './client.js';
import { parseDatabaseUrl } from './config.js';

async function check() {
  const url = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!url) throw new Error('Missing database configuration.');
  const client = createDatabaseClient(url);
  try {
    await client.$queryRaw`SELECT 1`;
    console.log('Database connection verified.');
  } finally {
    await client.$disconnect();
  }
}

void check().catch(() => {
  console.error(
    'Database check failed. Check DATABASE_URL, network access, and database availability.',
  );
  process.exitCode = 1;
});
