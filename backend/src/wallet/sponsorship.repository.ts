import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_ADMIN } from '../database/database.module';

@Injectable()
export class SponsorshipRepository {
  constructor(@Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient) {}

  async profileId(privyUserId: string): Promise<string> {
    const { data, error } = await this.db.from('profiles').select('id')
      .eq('privy_user_id', privyUserId).maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Paayee profile not found');
    return data.id as string;
  }

  async recordQuote(input: {
    id: string;
    privyUserId: string;
    chainId: number;
    kind: string;
    tokenSymbol: string;
    amountMinorUnits: string;
    feeMinorUnits: string;
    displayCurrency: string;
    displayAmount: string;
    gasUnits: string;
    maxFeePerGasWei: string;
    markupBps: number;
    treasuryAddress?: string;
    expiresAt: string;
  }) {
    const profileId = await this.profileId(input.privyUserId);
    const { error } = await this.db.from('paayee_fee_quotes').insert({
      id: input.id,
      profile_id: profileId,
      chain_id: input.chainId,
      kind: input.kind,
      token_symbol: input.tokenSymbol,
      amount_minor_units: input.amountMinorUnits,
      fee_minor_units: input.feeMinorUnits,
      display_currency: input.displayCurrency,
      display_amount: input.displayAmount,
      gas_units: input.gasUnits,
      max_fee_per_gas_wei: input.maxFeePerGasWei,
      markup_bps: input.markupBps,
      treasury_address: input.treasuryAddress ?? null,
      status: input.feeMinorUnits === '0' ? 'waived' : 'quoted',
      settled_at: input.feeMinorUnits === '0' ? new Date().toISOString() : null,
      expires_at: input.expiresAt,
    });
    if (error) throw new InternalServerErrorException(error.message);
  }

  async recordSponsoredTransaction(input: {
    privyUserId: string;
    chainId: number;
    walletAddress: string;
    destinationAddress: string;
    functionSelector: string;
    idempotencyKey: string;
    transactionHash?: string;
    privyTransactionId?: string;
    userOperationHash?: string;
    walletId: string;
    estimatedGasUnits: string;
    estimatedMaxFeePerGasWei: string;
    estimatedNetworkCostWei: string;
    estimatedNetworkCostUsd: string;
  }) {
    const profileId = await this.profileId(input.privyUserId);
    const { error } = await this.db.from('paayee_sponsored_transactions').upsert({
      profile_id: profileId,
      chain_id: input.chainId,
      wallet_address: input.walletAddress,
      destination_address: input.destinationAddress,
      function_selector: input.functionSelector,
      idempotency_key: input.idempotencyKey,
      transaction_hash: input.transactionHash ?? null,
      privy_transaction_id: input.privyTransactionId ?? null,
      user_operation_hash: input.userOperationHash ?? null,
      wallet_id: input.walletId,
      estimated_gas_units: input.estimatedGasUnits,
      estimated_max_fee_per_gas_wei: input.estimatedMaxFeePerGasWei,
      estimated_network_cost_wei: input.estimatedNetworkCostWei,
      estimated_network_cost_usd: input.estimatedNetworkCostUsd,
      status: 'submitted',
    }, { onConflict: 'idempotency_key' });
    if (error) throw new InternalServerErrorException(error.message);
  }

  async assertCollectibleQuote(input: {
    privyUserId: string;
    quoteId: string;
    tokenSymbol: string;
    feeMinorUnits: string;
    treasuryAddress: string;
  }) {
    const profileId = await this.profileId(input.privyUserId);
    const { data, error } = await this.db.from('paayee_fee_quotes')
      .select('id,status,token_symbol,fee_minor_units,treasury_address,expires_at')
      .eq('id', input.quoteId).eq('profile_id', profileId).maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new BadRequestException('The Paayee fee quote was not found');
    if (data.status !== 'quoted') throw new BadRequestException('This Paayee fee quote has already been used');
    if (new Date(data.expires_at as string).getTime() <= Date.now()) {
      await this.db.from('paayee_fee_quotes').update({ status: 'expired' }).eq('id', input.quoteId);
      throw new BadRequestException('The network fee quote expired. Please request a fresh quote.');
    }
    if (
      data.token_symbol !== input.tokenSymbol
      || String(data.fee_minor_units) !== input.feeMinorUnits
      || String(data.treasury_address).toLowerCase() !== input.treasuryAddress.toLowerCase()
    ) {
      throw new BadRequestException('The network fee payment does not match its quote');
    }
  }

  async submitFeeCollection(quoteId: string, transactionHash: string) {
    const { error } = await this.db.from('paayee_fee_quotes').update({
      status: 'submitted',
      fee_transaction_hash: transactionHash,
    }).eq('id', quoteId).eq('status', 'quoted');
    if (error) throw new InternalServerErrorException(error.message);
  }

  async submittedTransactions() {
    const { data, error } = await this.db.from('paayee_sponsored_transactions')
      .select('id,wallet_id,transaction_hash,privy_transaction_id,created_at').eq('status', 'submitted').limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async attachTransactionHash(id: string, transactionHash: string) {
    const { error } = await this.db.from('paayee_sponsored_transactions').update({
      transaction_hash: transactionHash,
    }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async settleTransaction(input: {
    id: string;
    status: 'confirmed' | 'failed';
    actualGasUsed?: string;
    effectiveGasPriceWei?: string;
    actualNetworkCostWei?: string;
  }) {
    const { error } = await this.db.from('paayee_sponsored_transactions').update({
      status: input.status,
      confirmed_at: input.status === 'confirmed' ? new Date().toISOString() : null,
      actual_gas_used: input.actualGasUsed ?? null,
      effective_gas_price_wei: input.effectiveGasPriceWei ?? null,
      actual_network_cost_wei: input.actualNetworkCostWei ?? null,
    }).eq('id', input.id);
    if (error) throw new Error(error.message);
  }

  async recordPrivySpendWindow(input: {
    transactionId: string;
    walletId: string;
    windowStart: string;
    windowEnd: string;
    spendUsd: string;
  }) {
    const { error } = await this.db.from('paayee_privy_gas_spend_windows').upsert({
      sponsored_transaction_id: input.transactionId,
      wallet_id: input.walletId,
      window_start: input.windowStart,
      window_end: input.windowEnd,
      spend_usd: input.spendUsd,
      currency: 'usd',
    }, { onConflict: 'sponsored_transaction_id' });
    if (error) throw new Error(error.message);
  }

  async submittedFeeCollections() {
    const { data, error } = await this.db.from('paayee_fee_quotes')
      .select('id,fee_transaction_hash').eq('status', 'submitted').not('fee_transaction_hash', 'is', null).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async settleFeeCollection(id: string, status: 'collected' | 'failed') {
    const { error } = await this.db.from('paayee_fee_quotes').update({
      status,
      settled_at: status === 'collected' ? new Date().toISOString() : null,
    }).eq('id', id);
    if (error) throw new Error(error.message);
  }
}
