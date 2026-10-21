import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { newPassword } from './password-policy.js';

const schema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  displayName: z.string().trim().min(1).max(100),
  password: newPassword,
});

export function parseRegistrationInput(value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException('Invalid registration details.');
  return result.data;
}
