import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';

@Module({ imports: [HealthModule, DatabaseModule] })
export class AppModule {}
