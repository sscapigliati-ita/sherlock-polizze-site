import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/storage', () => ({ salvaCodicePro: vi.fn() }));

import { GET } from '../../src/pages/api/admin/migra-utente';
import { salvaCodicePro } from '../../src/lib/storage';

describe('admin migration commercial classification', () => {
  it('classifica la licenza come amministratore', async () => {
    const url = new URL('https://sherlock.test/api/admin/migra-utente?email=a%40b.it&codice=SHK-ABCD-EF12&piano=annuale');
    const response = await (GET as any)({ url });
    expect(response.status).toBe(200);
    expect(salvaCodicePro).toHaveBeenCalledWith(expect.objectContaining({
      commercialStatus: 'amministratore',
      commercialStatusReason: 'admin_migration',
      paymentEnvironment: 'unknown',
    }));
  });
});
