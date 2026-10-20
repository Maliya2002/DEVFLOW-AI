import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AUTH_CONFIG, parseAuthConfig } from './config.js';
import { PasswordHasher } from './password-hasher.js';
import { RegistrationController } from './registration.controller.js';
import { RegistrationService } from './registration.service.js';
import { SessionService, AUTH_CLOCK } from './session.service.js';
import { SessionController } from './session.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [RegistrationController, SessionController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: () => parseAuthConfig(process.env) },
    PasswordHasher,
    RegistrationService,
    SessionService,
    { provide: AUTH_CLOCK, useValue: () => new Date() },
  ],
  exports: [SessionService],
})
export class AuthModule {}
