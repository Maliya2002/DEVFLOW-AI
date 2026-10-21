import { BadRequestException } from '@nestjs/common';
import { toUSVString } from 'node:util';
import { z } from 'zod';
import { newPassword } from './password-policy.js';
const password = z
  .string()
  .refine(
    (value) => toUSVString(value) === value && [...value].length > 0 && [...value].length <= 128,
  );
export const loginInput = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password,
  rememberMe: z.boolean().default(false),
});
export const reauthInput = z.strictObject({ password });
export const passwordChangeInput = z
  .strictObject({ currentPassword: password, newPassword })
  .refine((value) => value.currentPassword !== value.newPassword);
export const emptyInput = z.strictObject({});
export const sessionIdInput = z.uuid();
export function parseInput<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException('Invalid authentication details.');
  return result.data;
}
