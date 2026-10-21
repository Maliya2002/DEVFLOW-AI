import { dictionary } from '@zxcvbn-ts/language-common';
import { z } from 'zod';
import { toUSVString } from 'node:util';

const blocked = new Set(dictionary['passwords-common'].map((password) => password.toLowerCase()));
export const newPassword = z.string().refine((value) => {
  const length = [...value].length;
  return (
    toUSVString(value) === value &&
    length >= 15 &&
    length <= 128 &&
    !blocked.has(value.toLowerCase()) &&
    !/^(.)\1+$/su.test(value)
  );
});
