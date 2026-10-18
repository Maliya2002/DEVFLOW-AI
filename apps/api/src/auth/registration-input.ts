import { BadRequestException } from '@nestjs/common';
import { dictionary } from '@zxcvbn-ts/language-common';
import { z } from 'zod';
import { toUSVString } from 'node:util';

const blocked = new Set(dictionary['passwords-common'].map((password) => password.toLowerCase()));
const schema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().refine((value) => {
    const length = [...value].length;
    return (
      toUSVString(value) === value &&
      length >= 15 &&
      length <= 128 &&
      !blocked.has(value.toLowerCase()) &&
      !/^(.)\1+$/su.test(value)
    );
  }),
});

export function parseRegistrationInput(value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException('Invalid registration details.');
  return result.data;
}
