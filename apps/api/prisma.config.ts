import { defineConfig } from 'prisma/config';

// Generation works without credentials. Migration commands require DIRECT_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL ?? '' },
});
