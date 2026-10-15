import { createApplication } from './app.js';
import { parsePort } from './config.js';

async function bootstrap(): Promise<void> {
  const port = parsePort(process.env.PORT);
  const app = await createApplication();
  app.enableShutdownHooks();
  await app.listen(port, process.env.HOST ?? '127.0.0.1');
}

void bootstrap().catch(() => {
  console.error('API startup failed. Check configuration and port availability.');
  process.exitCode = 1;
});
