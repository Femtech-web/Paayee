import { describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../src/config';
import { FeeService } from '../src/wallet/fee.service';
import type { SponsorshipRepository } from '../src/wallet/sponsorship.repository';

describe('FeeService', () => {
  it('always returns a zero user fee while Paayee app-pays sponsorship is enabled', async () => {
    const recordQuote = vi.fn().mockResolvedValue(undefined);
    const service = new FeeService(
      { chainId: 1 } as AppConfig,
      { recordQuote } as unknown as SponsorshipRepository,
    );

    const quote = await service.quote('did:privy:test', {
      amountMinorUnits: '5000000',
      assetCode: 'USDC',
      chainId: 1,
      displayCurrency: 'USD',
      kind: 'shield',
    });

    expect(quote.feeAssetMinorUnits).toBe('0');
    expect(quote.collectionEnabled).toBe(false);
    expect(quote.collectionStatus).toBe('waived');
    expect(recordQuote).toHaveBeenCalledWith(expect.objectContaining({
      feeMinorUnits: '0',
      gasUnits: '0',
      markupBps: 0,
    }));
  });
});
