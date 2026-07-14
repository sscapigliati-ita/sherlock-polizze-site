import { describe, expect, it } from 'vitest';
import { validateBase64Upload } from '../../src/lib/upload-validation';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

describe('upload signature validation', () => {
  it.each([
    ['application/pdf', b64([0x25, 0x50, 0x44, 0x46, 0x2d])],
    ['image/jpeg', b64([0xff, 0xd8, 0xff, 0xe0])],
    ['image/png', b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/webp', b64([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50])],
  ])('accetta firma %s coerente', (declaredMime, data) => {
    expect(validateBase64Upload({ data, declaredMime, maxBytes: 1024 })).toMatchObject({ ok: true, mime: declaredMime });
  });

  it('rifiuta mismatch MIME e firma', () => {
    expect(validateBase64Upload({ data: b64([0x25,0x50,0x44,0x46,0x2d]), declaredMime: 'image/png', maxBytes: 1024 })).toEqual({ ok: false, code: 'MIME_SIGNATURE_MISMATCH' });
  });
  it.each([
    ['', 'EMPTY_FILE'], ['%%%', 'INVALID_BASE64'], [b64([1,2,3]), 'UNSUPPORTED_FILE_SIGNATURE'],
  ])('rifiuta input invalido', (data, code) => {
    expect(validateBase64Upload({ data, declaredMime: 'application/pdf', maxBytes: 1024 })).toEqual({ ok: false, code });
  });
  it('rifiuta dimensione reale oltre limite', () => {
    expect(validateBase64Upload({ data: b64([0x25,0x50,0x44,0x46,0x2d,1]), declaredMime: 'application/pdf', maxBytes: 5 })).toEqual({ ok: false, code: 'FILE_TOO_LARGE' });
  });
});
