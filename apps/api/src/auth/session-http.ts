import {
  ForbiddenException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthConfig } from './config.js';

export function requireBrowserMutation(request: Request, config: AuthConfig | null) {
  if (!config) throw new ServiceUnavailableException('Authentication is unavailable.');
  const site = request.get('sec-fetch-site');
  if (
    request.get('origin') !== config.origin ||
    request.get('x-devflow-request') !== 'browser' ||
    (site !== undefined && site !== 'same-origin' && site !== 'same-site')
  )
    throw new ForbiddenException('Request origin is not allowed.');
  if (request.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
    throw new UnsupportedMediaTypeException('Use application/json.');
}

export function cookieName(config: AuthConfig) {
  return config.origin.startsWith('https:') ? '__Host-devflow_session' : 'devflow_session';
}

export function readSessionCookie(header: string | undefined, config: AuthConfig): string | null {
  const matches = (header ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${cookieName(config)}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(cookieName(config).length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function sessionCookie(config: AuthConfig, token: string | null, maxAge?: number) {
  const secure = config.origin.startsWith('https:') ? '; Secure' : '';
  const age =
    token === null
      ? '; Max-Age=0'
      : maxAge === undefined
        ? ''
        : `; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
  return `${cookieName(config)}=${token ?? ''}; Path=/; HttpOnly; SameSite=Lax${secure}${age}`;
}
