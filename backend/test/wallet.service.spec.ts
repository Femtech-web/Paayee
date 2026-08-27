import { BadRequestException } from '@nestjs/common';
import { encodeFunctionData, type Address, type Hex } from 'viem';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../src/config';
import type { SponsorshipPolicyService, SponsoredCallKind } from '../src/wallet/sponsorship-policy.service';
import type { SponsorshipRepository } from '../src/wallet/sponsorship.repository';
import { WalletService } from '../src/wallet/wallet.service';

const publicAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address;
const confidentialAddress = '0x9854C9845f02765000e33bFEe88b75B6539059eA' as Address;
const recipient = '0xCb972cf1353679fa2eC8E874a33227eB6cB1607E' as Address;
const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;

const erc20Abi = [{
  type: 'function', name: 'transfer', stateMutability: 'nonpayable',
  inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ name: '', type: 'bool' }],
}] as const;
const confidentialAbi = [{
  type: 'function', name: 'confidentialTransfer', stateMutability: 'nonpayable',
  inputs: [
    { name: 'recipient', type: 'address' },
    { name: 'encryptedAmount', type: 'bytes32' },
    { name: 'inputProof', type: 'bytes' },
  ],
  outputs: [{ name: 'transferred', type: 'bytes32' }],
}] as const;

describe('WalletService sponsorship allowlist', () => {
  const service = new WalletService({
    assets: [{
      confidentialAddress,
      decimals: 6,
      publicAddress,
      startBlock: 1n,
      symbol: 'USDC',
    }],
  } as AppConfig, {} as SponsorshipRepository, {} as SponsorshipPolicyService);
  const assertAllowedCall = (to: Address, data: Hex) => (
    service as unknown as {
      assertAllowedCall: (
        userId: string,
        destination: Address,
        callData: Hex,
      ) => Promise<{ kind: SponsoredCallKind }>;
    }
  ).assertAllowedCall('did:privy:test', to, data);

  it('allows a positive public-token transfer only on a configured asset', async () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, 2_000_000n] });
    await expect(assertAllowedCall(publicAddress, data)).resolves.toEqual({ kind: 'public-send' });
    await expect(assertAllowedCall(recipient, data)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects zero public amounts and zero private recipients', async () => {
    const zeroTransfer = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, 0n] });
    const zeroPrivateRecipient = encodeFunctionData({
      abi: confidentialAbi,
      functionName: 'confidentialTransfer',
      args: [zeroAddress, `0x${'1'.repeat(64)}`, '0x1234'],
    });
    await expect(assertAllowedCall(publicAddress, zeroTransfer)).rejects.toBeInstanceOf(BadRequestException);
    await expect(assertAllowedCall(confidentialAddress, zeroPrivateRecipient)).rejects.toBeInstanceOf(BadRequestException);
  });
});
