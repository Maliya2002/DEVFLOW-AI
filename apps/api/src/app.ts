import 'reflect-metadata';
import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

export async function createApplication(options: NestApplicationOptions = {}) {
  const app = await NestFactory.create(AppModule, options);
  app.setGlobalPrefix('api/v1');
  return app;
}
