import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({ imports: [HealthModule, DatabaseModule, AuthModule] })
export class AppModule {}
