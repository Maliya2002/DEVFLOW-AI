export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export type AuthConfig = { origin: string; rateSecret: string };

export function parseAuthConfig(env: NodeJS.ProcessEnv): AuthConfig | null {
  if (!env.APP_ORIGIN && !env.AUTH_RATE_LIMIT_SECRET) return null;
  const message = 'Configure APP_ORIGIN and a 64-character hexadecimal AUTH_RATE_LIMIT_SECRET.';
  if (!env.APP_ORIGIN || !/^[a-f0-9]{64}$/i.test(env.AUTH_RATE_LIMIT_SECRET ?? ''))
    throw new Error(message);
  let url: URL;
  try {
    url = new URL(env.APP_ORIGIN);
  } catch {
    throw new Error(message);
  }
  const local =
    env.NODE_ENV !== 'production' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (
    url.origin !== env.APP_ORIGIN ||
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
  )
    throw new Error(message);
  return { origin: url.origin, rateSecret: env.AUTH_RATE_LIMIT_SECRET! };
}
