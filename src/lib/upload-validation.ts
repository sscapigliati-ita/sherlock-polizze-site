export type SupportedUploadMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
type UploadError = 'EMPTY_FILE' | 'INVALID_BASE64' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE_SIGNATURE' | 'MIME_SIGNATURE_MISMATCH';

function detectedMime(bytes: Uint8Array): SupportedUploadMime | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v, i) => bytes[i] === v)) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export function validateBase64Upload(opts: { data: string; declaredMime: string; maxBytes: number }):
  | { ok: true; mime: SupportedUploadMime; bytes: number }
  | { ok: false; code: UploadError } {
  if (!opts.data) return { ok: false, code: 'EMPTY_FILE' };
  const clean = opts.data.replace(/\s/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clean)) return { ok: false, code: 'INVALID_BASE64' };
  let buffer: Buffer;
  try { buffer = Buffer.from(clean, 'base64'); } catch { return { ok: false, code: 'INVALID_BASE64' }; }
  if (buffer.length === 0) return { ok: false, code: 'EMPTY_FILE' };
  if (buffer.length > opts.maxBytes) return { ok: false, code: 'FILE_TOO_LARGE' };
  const mime = detectedMime(buffer);
  if (!mime) return { ok: false, code: 'UNSUPPORTED_FILE_SIGNATURE' };
  if (mime !== opts.declaredMime) return { ok: false, code: 'MIME_SIGNATURE_MISMATCH' };
  return { ok: true, mime, bytes: buffer.length };
}
