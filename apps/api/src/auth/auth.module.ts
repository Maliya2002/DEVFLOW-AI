import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AUTH_CONFIG, parseAuthConfig } from './config.js';
import { PasswordHasher } from './password-hasher.js';
import { RegistrationController } from './registration.controller.js';
import { RegistrationService } from './registration.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [RegistrationController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: () => parseAuthConfig(process.env) },
    PasswordHasher,
    RegistrationService,
  ],
})
export class AuthModule {}
