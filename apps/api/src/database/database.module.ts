import { Module } from '@nestjs/common';
import { createDatabaseClient } from './client.js';
import { parseDatabaseUrl } from './config.js';
import { DATABASE_CLIENT, DatabaseService } from './database.service.js';
import { ReadinessController } from './readiness.controller.js';

@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: () => {
        const url = parseDatabaseUrl(process.env.DATABASE_URL);
        return url ? createDatabaseClient(url) : null;
      },
    },
    DatabaseService,
  ],
  controllers: [ReadinessController],
  exports: [DatabaseService, DATABASE_CLIENT],
})
export class DatabaseModule {}
