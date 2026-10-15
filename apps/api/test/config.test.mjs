import { parsePort } from '../dist/config.js';

describe('API port configuration', () => {
  it('defaults to 3001 when omitted', () => {
    expect(parsePort(undefined)).toBe(3001);
  });

  it.each(['1', '3001', '65535'])('accepts valid port %s', (value) => {
    expect(parsePort(value)).toBe(Number(value));
  });

  it.each(['', ' ', '0', '-1', '65536', '3001x', '1.5', '1e3', 'Infinity'])
    ('rejects invalid port %s', (value) => {
      expect(() => parsePort(value)).toThrow('PORT must be an integer');
    });
});
