import { jest } from '@jest/globals';
import { parseDatabaseUrl } from '../dist/database/config.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { ReadinessController } from '../dist/database/readiness.controller.js';

const remote = 'postgresql://demo:secret@ep-demo-pooler.region.aws.neon.tech/neondb';

describe('Database configuration', () => {
  it('allows missing credentials for the foundation preview', () => {
    expect(parseDatabaseUrl(undefined)).toBeUndefined();
  });
  it('requires certificate and hostname verification for remote connections', () => {
    expect(new URL(parseDatabaseUrl(remote + '?sslmode=require')).searchParams.get('sslmode')).toBe(
      'verify-full',
    );
  });
  it('allows explicit local PostgreSQL for isolated CI tests', () => {
    expect(
      parseDatabaseUrl('postgresql://test:test@127.0.0.1:5432/test?sslmode=disable'),
    ).toContain('127.0.0.1');
  });
  it.each([
    '',
    'not-a-url',
    'https://user:secret@example.com/db',
    remote,
    remote + '?sslmode=disable',
    remote + '?sslmode=no-verify',
    remote + '?sslmode=require&sslmode=disable',
    remote + '?sslmode=require&sslcert=bad',
    'postgresql://user@localhost/db',
    'postgresql://user:secret@localhost/',
  ])('rejects unsafe or malformed configuration without exposing credentials (%#)', (url) => {
    expect(() => parseDatabaseUrl(url)).toThrow('PostgreSQL URL');
    try {
      parseDatabaseUrl(url);
    } catch (error) {
      expect(error.message).not.toContain('secret');
    }
  });
});

describe('Database readiness and cleanup', () => {
  it('reports unavailable without a configured client', async () => {
    const service = new DatabaseService(null);
    expect(await service.isReady()).toBe(false);
    await service.onModuleDestroy();
  });
  it('runs a read-only probe and closes the pool on shutdown', async () => {
    const client = {
      $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DatabaseService(client);
    expect(await service.isReady()).toBe(true);
    expect(client.$queryRaw.mock.calls[0][0][0]).toBe('SELECT 1');
    await service.onModuleDestroy();
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });
  it('does not return connection errors or credentials to callers', async () => {
    const service = new DatabaseService({
      $queryRaw: jest.fn().mockRejectedValue(new Error(remote)),
    });
    const controller = new ReadinessController(service);
    try {
      await controller.getReadiness();
      throw new Error('Expected 503');
    } catch (error) {
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toEqual({ status: 'unavailable', service: 'devflow-api' });
    }
  });
  it('returns ready after a successful query', async () => {
    const controller = new ReadinessController(
      new DatabaseService({ $queryRaw: jest.fn().mockResolvedValue([]) }),
    );
    expect(await controller.getReadiness()).toEqual({ status: 'ready', service: 'devflow-api' });
  });
});
