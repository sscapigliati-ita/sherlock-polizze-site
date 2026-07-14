import { describe, expect, it } from 'vitest';
import { applySecurityHeaders } from '../../src/lib/security-headers';

describe('security headers', () => {
  it('aggiunge la policy globale senza perdere gli header esistenti', async () => {
    const input = new Response('ok', { status: 201, headers: { 'Content-Type': 'text/plain', 'X-Custom': 'kept' } });
    const response = applySecurityHeaders(input);
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('x-custom')).toBe('kept');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('permissions-policy')).toContain('camera=()');
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin-allow-popups');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toContain("object-src 'none'");
    expect(await response.text()).toBe('ok');
  });
});
