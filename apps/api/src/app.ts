import 'reflect-metadata';
import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';

export async function createApplication(options: NestApplicationOptions = {}) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    ...options,
    bodyParser: false,
  });
  app.use('/api/v1/auth', (_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useBodyParser('json', { limit: '8kb' });
  app.use((error: { type?: string }, _request: Request, response: Response, next: NextFunction) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      const status = error.type === 'entity.too.large' ? 413 : 400;
      response.status(status).json({ statusCode: status, message: 'Invalid JSON body.' });
      return;
    }
    next(error);
  });
  app.setGlobalPrefix('api/v1');
  return app;
}
