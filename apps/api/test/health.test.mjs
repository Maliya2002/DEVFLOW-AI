import request from 'supertest';
import { createApplication } from '../dist/app.js';

describe('API liveness contract', () => {
  let app;

  beforeAll(async () => {
    app = await createApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns a minimal, non-cacheable JSON status at the versioned route', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toEqual({ status: 'ok', service: 'devflow-api' });
  });

  it('does not expose an unversioned health route', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('does not accept state-changing requests to the health route', async () => {
    await request(app.getHttpServer()).post('/api/v1/health').expect(404);
  });
});
