import { BadGatewayException, BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { decodeFunctionData, getFunctionSelector, isAddressEqual, type Address, type Hex } from 'viem';

import { AppConfig } from '../config';
import type { RelayTransactionDto } from './dto/relay-transaction.dto';
import { SponsorshipPolicyService, type SponsoredCallKind } from './sponsorship-policy.service';
import { SponsorshipRepository } from './sponsorship.repository';

const wrapSelector = getFunctionSelector('wrap(address,uint256)');
const unwrapSelector = getFunctionSelector('unwrap(address,address,bytes32,bytes)');
const finalizeUnwrapSelector = getFunctionSelector('finalizeUnwrap(bytes32,uint64,bytes)');
const confidentialTransferSelector = getFunctionSelector('confidentialTransfer(address,bytes32,bytes)');
const confidentialTransferAbi = [{
  type: 'function', name: 'confidentialTransfer', stateMutability: 'nonpayable',
  inputs: [
    { name: 'recipient', type: 'address' },
    { name: 'encryptedAmount', type: 'bytes32' },
    { name: 'inputProof', type: 'bytes' },
  ],
  outputs: [{ name: 'transferred', type: 'bytes32' }],
}] as const;
const erc20RelayAbi = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;
const approveSelector = getFunctionSelector('approve(address,uint256)');
const transferSelector = getFunctionSelector('transfer(address,uint256)');

@Injectable()
export class WalletService {
  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(SponsorshipRepository) private readonly sponsorships: SponsorshipRepository,
    @Inject(SponsorshipPolicyService) private readonly policy: SponsorshipPolicyService,
  ) {}

  async relay(privyUserId: string, input: RelayTransactionDto) {
    await this.assertWalletOwnership(privyUserId, input.walletId, input.walletAddress);
    const call = await this.assertAllowedCall(privyUserId, input.to as Address, input.data, input.feeQuoteId);
    if (input.requestExpiry <= Date.now() || input.requestExpiry > Date.now() + 120_000) {
      throw new BadRequestException('Sponsored request has expired');
    }
    const estimate = await this.policy.assertEligible({
      data: input.data,
      from: input.walletAddress as Address,
      kind: call.kind,
      to: input.to as Address,
      value: input.value,
    });

    const body = {
      method: 'eth_sendTransaction',
      caip2: `eip155:${this.config.chainId}`,
      chain_type: 'ethereum',
      sponsor: true,
      params: { transaction: { from: input.walletAddress, to: input.to, data: input.data, value: input.value ?? '0x0' } },
    };
    const response = await fetch(this.privyWalletUrl(input.walletId), {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.config.privyAppId}:${this.config.privyAppSecret}`).toString('base64')}`,
        'content-type': 'application/json',
        'privy-app-id': this.config.privyAppId,
        'privy-authorization-signature': input.authorizationSignature,
        'privy-idempotency-key': input.idempotencyKey,
        'privy-request-expiry': String(input.requestExpiry),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({})) as {
      data?: { hash?: string; transaction_id?: string; user_operation_hash?: string };
      message?: string;
      error?: string;
    };
    if (!response.ok || (!payload.data?.hash && !payload.data?.transaction_id)) {
      throw new BadGatewayException(payload.message ?? payload.error ?? 'Privy could not sponsor this transaction');
    }
    await this.sponsorships.recordSponsoredTransaction({
      privyUserId,
      chainId: this.config.chainId,
      walletAddress: input.walletAddress,
      destinationAddress: input.to,
      functionSelector: input.data.slice(0, 10),
      idempotencyKey: input.idempotencyKey,
      transactionHash: payload.data.hash || undefined,
      privyTransactionId: payload.data.transaction_id,
      userOperationHash: payload.data.user_operation_hash,
      walletId: input.walletId,
      estimatedGasUnits: estimate.estimatedGasUnits.toString(),
      estimatedMaxFeePerGasWei: estimate.estimatedMaxFeePerGasWei.toString(),
      estimatedNetworkCostWei: estimate.estimatedNetworkCostWei.toString(),
      estimatedNetworkCostUsd: String(estimate.estimatedNetworkCostUsd),
    });
    return {
      transactionHash: payload.data.hash || undefined,
      privyTransactionId: payload.data.transaction_id,
      userOperationHash: payload.data.user_operation_hash,
      sponsored: true,
    };
  }

  async transaction(privyUserId: string, transactionId: string) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) throw new BadRequestException('Invalid Privy transaction ID');
    const response = await fetch(`https://api.privy.io/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: this.privyHeaders(),
    });
    const payload = await response.json().catch(() => ({})) as {
      id?: string;
      wallet_id?: string;
      status?: string;
      transaction_hash?: string | null;
      message?: string;
    };
    if (!response.ok || !payload.wallet_id || !payload.status) {
      throw new BadGatewayException(payload.message ?? 'Privy transaction lookup failed');
    }
    await this.assertWalletIdOwnership(privyUserId, payload.wallet_id);
    return {
      status: payload.status,
      transactionHash: payload.transaction_hash ?? undefined,
    };
  }

  private async assertAllowedCall(
    _privyUserId: string,
    to: Address,
    data: Hex,
    _feeQuoteId?: string,
  ): Promise<{ kind: SponsoredCallKind }> {
    const selector = data.slice(0, 10).toLowerCase();
    const publicAsset = this.config.assets.find((asset) => isAddressEqual(asset.publicAddress, to));
    const confidentialAsset = this.config.assets.find((asset) => isAddressEqual(asset.confidentialAddress, to));
    if (publicAsset && selector === approveSelector) {
      const decoded = decodeFunctionData({ abi: erc20RelayAbi, data });
      const spender = decoded.args[0] as Address;
      if (isAddressEqual(spender, publicAsset.confidentialAddress)) return { kind: 'shield' };
    }
    if (publicAsset && selector === transferSelector) {
      const decoded = decodeFunctionData({ abi: erc20RelayAbi, data });
      const recipient = decoded.args[0] as Address;
      const amount = decoded.args[1] as bigint;
      if (amount <= 0n || isAddressEqual(recipient, '0x0000000000000000000000000000000000000000')) {
        throw new BadRequestException('Stablecoin transfer recipient and amount must be valid');
      }
      return { kind: 'public-send' };
    }
    if (confidentialAsset) {
      if (selector === wrapSelector) return { kind: 'shield' };
      if (selector === unwrapSelector || selector === finalizeUnwrapSelector) return { kind: 'unshield' };
      if (selector === confidentialTransferSelector) {
        const decoded = decodeFunctionData({ abi: confidentialTransferAbi, data });
        const recipient = decoded.args[0] as Address;
        if (isAddressEqual(recipient, '0x0000000000000000000000000000000000000000')) {
          throw new BadRequestException('Private stablecoin recipient must be valid');
        }
        return { kind: 'private-send' };
      }
    }
    throw new BadRequestException('This contract call is not eligible for Paayee gas sponsorship');
  }

  private async assertWalletOwnership(privyUserId: string, walletId: string, walletAddress: string) {
    const accounts = await this.privyWalletAccounts(privyUserId);
    const ownsWallet = accounts?.some((account) =>
      account.type === 'wallet' && account.wallet_client_type === 'privy' && account.id === walletId &&
      account.address?.toLowerCase() === walletAddress.toLowerCase());
    if (!ownsWallet) throw new UnauthorizedException('This Privy wallet does not belong to the current Paayee user');
  }

  private async assertWalletIdOwnership(privyUserId: string, walletId: string) {
    const accounts = await this.privyWalletAccounts(privyUserId);
    const ownsWallet = accounts?.some((account) =>
      account.type === 'wallet' && account.wallet_client_type === 'privy' && account.id === walletId);
    if (!ownsWallet) throw new UnauthorizedException('This Privy transaction does not belong to the current Paayee user');
  }

  private async privyWalletAccounts(privyUserId: string) {
    const response = await fetch(`https://api.privy.io/v1/users/${encodeURIComponent(privyUserId)}`, {
      headers: this.privyHeaders(),
    });
    if (!response.ok) throw new UnauthorizedException('Could not verify this Privy wallet');
    const user = await response.json() as {
      linked_accounts?: PrivyLinkedAccount[];
      user?: { linked_accounts?: PrivyLinkedAccount[] };
    };
    return user.linked_accounts ?? user.user?.linked_accounts;
  }

  private privyWalletUrl(walletId: string) {
    return `https://api.privy.io/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  }

  private privyHeaders() {
    return {
      authorization: `Basic ${Buffer.from(`${this.config.privyAppId}:${this.config.privyAppSecret}`).toString('base64')}`,
      'privy-app-id': this.config.privyAppId,
    };
  }
}

type PrivyLinkedAccount = { id?: string | null; address?: string; type?: string; wallet_client_type?: string };
