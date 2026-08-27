import { beforeEach, describe, expect, it, vi } from 'vitest';

const estimateGas = vi.fn();
const estimateFeesPerGas = vi.fn();

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: () => ({ estimateFeesPerGas, estimateGas }),
  };
});

import type { AppConfig } from '../src/config';
import type { MarketService } from '../src/market/market.service';
import { SponsorshipPolicyService } from '../src/wallet/sponsorship-policy.service';

describe('SponsorshipPolicyService', () => {
  beforeEach(() => {
    estimateGas.mockReset();
    estimateFeesPerGas.mockReset();
  });

  it('simulates the exact encoded call and permits it below the configured cap', async () => {
    estimateGas.mockResolvedValue(240_000n);
    estimateFeesPerGas.mockResolvedValue({ maxFeePerGas: 1_000_000_000n });
    const service = new SponsorshipPolicyService(config(), market());

    const result = await service.assertEligible({
      data: '0x12345678',
      from: '0x1111111111111111111111111111111111111111',
      kind: 'shield',
      to: '0x2222222222222222222222222222222222222222',
    });

    expect(estimateGas).toHaveBeenCalledWith({
      account: '0x1111111111111111111111111111111111111111',
      data: '0x12345678',
      to: '0x2222222222222222222222222222222222222222',
      value: 0n,
    });
    expect(result.estimatedGasUnits).toBe(240_000n);
  });

  it('rejects a call whose exact simulation exceeds the sponsorship gas cap', async () => {
    estimateGas.mockResolvedValue(800_001n);
    const service = new SponsorshipPolicyService(config(), market());

    await expect(service.assertEligible({
      data: '0x12345678',
      from: '0x1111111111111111111111111111111111111111',
      kind: 'shield',
      to: '0x2222222222222222222222222222222222222222',
    })).rejects.toMatchObject({ status: 402 });
  });

  it('retries exact simulation while a fresh FHE input propagates', async () => {
    vi.useFakeTimers();
    estimateGas
      .mockRejectedValueOnce(new Error('ciphertext handle is not registered'))
      .mockResolvedValueOnce(310_000n);
    estimateFeesPerGas.mockResolvedValue({ maxFeePerGas: 1_000_000_000n });
    const service = new SponsorshipPolicyService(config(), market());

    const resultPromise = service.assertEligible({
      data: '0x12345678',
      from: '0x1111111111111111111111111111111111111111',
      kind: 'unshield',
      to: '0x2222222222222222222222222222222222222222',
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({ estimatedGasUnits: 310_000n });
    expect(estimateGas).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

function config(): AppConfig {
  return {
    chainId: 1,
    maxSponsoredFeeUsd: 2,
    maxSponsoredGasUnits: { shield: 800_000n, unshield: 1_200_000n, 'public-send': 150_000n, 'private-send': 800_000n },
    rpcUrl: 'https://rpc.invalid',
  } as AppConfig;
}

function market(): MarketService {
  return { ethUsd: vi.fn().mockResolvedValue(3_000) } as unknown as MarketService;
}
