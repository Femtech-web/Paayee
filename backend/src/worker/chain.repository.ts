import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AssetConfig } from '../config';
import { SUPABASE_ADMIN } from '../database/database.module';

export type IndexedTransfer = {
  asset: AssetConfig;
  from: string;
  to: string;
  value: bigint;
  transactionHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockTimestamp?: Date;
};

export type IndexedConfidentialTransfer = Omit<IndexedTransfer, 'value'> & {
  encryptedAmountHandle: string;
};

@Injectable()
export class ChainRepository {
  constructor(@Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient) {}

  async fundingAddresses(): Promise<string[]> {
    const { data, error } = await this.db.from('profiles').select('smart_account_address')
      .not('smart_account_address', 'is', null);
    if (error) throw new Error(error.message);
    return [...new Set(
      (data ?? [])
        .map((profile) => profile.smart_account_address as string | null)
        .filter((address): address is string => Boolean(address))
        .map((address) => address.toLowerCase()),
    )];
  }

  async checkpoint(chainId: number, source: string): Promise<bigint | undefined> {
    const { data, error } = await this.db.from('paayee_indexer_checkpoints').select('last_block')
      .eq('chain_id', chainId).eq('source', source).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? BigInt(data.last_block) : undefined;
  }

  async saveCheckpoint(chainId: number, source: string, lastBlock: bigint): Promise<void> {
    const { error } = await this.db.from('paayee_indexer_checkpoints').upsert({
      chain_id: chainId, source, last_block: lastBlock.toString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'chain_id,source' });
    if (error) throw new Error(error.message);
  }

  async recordTransfer(chainId: number, confirmationsRequired: number, latestBlock: bigint, transfer: IndexedTransfer) {
    const address = transfer.to.toLowerCase();
    const { data: profile, error: profileError } = await this.db.from('profiles').select('id')
      .ilike('smart_account_address', address).maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) return;

    const confirmations = Number(latestBlock - transfer.blockNumber + 1n);
    const confirmed = confirmations >= confirmationsRequired;
    const { data: deposit, error } = await this.db.from('paayee_deposits').upsert({
      profile_id: profile.id,
      chain_id: chainId,
      token_symbol: transfer.asset.symbol,
      token_address: transfer.asset.publicAddress,
      from_address: transfer.from,
      to_address: transfer.to,
      amount_minor_units: transfer.value.toString(),
      token_decimals: transfer.asset.decimals,
      transaction_hash: transfer.transactionHash,
      log_index: transfer.logIndex,
      block_number: transfer.blockNumber.toString(),
      block_timestamp: transfer.blockTimestamp?.toISOString() ?? null,
      confirmations,
      status: confirmed ? 'confirmed' : confirmations > 0 ? 'confirming' : 'detected',
      confirmed_at: confirmed ? new Date().toISOString() : null,
    }, { onConflict: 'chain_id,transaction_hash,log_index' }).select('id,status').single();
    if (error) throw new Error(error.message);

    if (confirmed) {
      const { error: receiptError } = await this.db.from('paayee_receipts').upsert({
        profile_id: profile.id,
        deposit_id: deposit.id,
        receipt_type: 'deposit',
        title: `${transfer.asset.symbol} received`,
        detail: 'Public deposit confirmed. You can make it private when ready.',
        token_symbol: transfer.asset.symbol,
        amount_minor_units: transfer.value.toString(),
        token_decimals: transfer.asset.decimals,
        transaction_hash: transfer.transactionHash,
        status: 'confirmed',
      }, { onConflict: 'deposit_id' });
      if (receiptError) throw new Error(receiptError.message);
    }
  }

  async recordConfidentialTransfer(
    chainId: number,
    confirmationsRequired: number,
    latestBlock: bigint,
    transfer: IndexedConfidentialTransfer,
  ) {
    // ERC-7984 wrapping mints from the zero address and emits the same event
    // as a peer transfer. It is already represented by the user's shield
    // operation, so it must not become a second "received" receipt.
    if (transfer.from.toLowerCase() === '0x0000000000000000000000000000000000000000') return;

    const address = transfer.to.toLowerCase();
    const { data: profile, error: profileError } = await this.db.from('profiles').select('id')
      .ilike('smart_account_address', address).maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) return;
    const { data: sender, error: senderError } = await this.db.from('profiles').select('id')
      .ilike('smart_account_address', transfer.from.toLowerCase()).maybeSingle();
    if (senderError) throw new Error(senderError.message);

    const confirmations = Number(latestBlock - transfer.blockNumber + 1n);
    const confirmed = confirmations >= confirmationsRequired;
    const { data: privateTransfer, error } = await this.db.from('paayee_private_transfers').upsert({
      profile_id: profile.id,
      sender_profile_id: sender?.id ?? null,
      chain_id: chainId,
      token_symbol: transfer.asset.symbol,
      confidential_token_address: transfer.asset.confidentialAddress,
      from_address: transfer.from,
      to_address: transfer.to,
      encrypted_amount_handle: transfer.encryptedAmountHandle,
      transaction_hash: transfer.transactionHash,
      log_index: transfer.logIndex,
      block_number: transfer.blockNumber.toString(),
      block_timestamp: transfer.blockTimestamp?.toISOString() ?? null,
      confirmations,
      status: confirmed ? 'confirmed' : confirmations > 0 ? 'confirming' : 'detected',
      confirmed_at: confirmed ? new Date().toISOString() : null,
    }, { onConflict: 'chain_id,transaction_hash,log_index' }).select('id').single();
    if (error) throw new Error(error.message);

    if (confirmed) {
      const { error: receiptError } = await this.db.from('paayee_receipts').upsert({
        profile_id: profile.id,
        private_transfer_id: privateTransfer.id,
        receipt_type: 'private_receive',
        title: `Private ${transfer.asset.symbol} received`,
        detail: 'Private transfer confirmed. Reveal the receipt when you want to view the amount.',
        token_symbol: transfer.asset.symbol,
        token_decimals: transfer.asset.decimals,
        encrypted_amount_handle: transfer.encryptedAmountHandle,
        transaction_hash: transfer.transactionHash,
        status: 'confirmed',
      }, { onConflict: 'private_transfer_id' });
      if (receiptError) throw new Error(receiptError.message);
    }
  }

  async submittedOperations() {
    const { data, error } = await this.db.from('paayee_operations').select('*').eq('status', 'submitted').limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async settleOperation(operation: Record<string, unknown>, status: 'confirmed' | 'failed'): Promise<void> {
    const confirmedAt = status === 'confirmed' ? new Date().toISOString() : null;
    const { error } = await this.db.from('paayee_operations').update({ status, confirmed_at: confirmedAt })
      .eq('id', operation.id as string);
    if (error) throw new Error(error.message);

    const kind = operation.kind as 'shield' | 'unshield' | 'public_send';
    const symbol = operation.token_symbol as string;
    const isSend = kind === 'public_send';
    const isShield = kind === 'shield';
    const { error: receiptError } = await this.db.from('paayee_receipts').upsert({
      profile_id: operation.profile_id,
      operation_id: operation.id,
      receipt_type: isSend ? 'send' : kind,
      title: isSend ? `${symbol} sent` : isShield ? `${symbol} made private` : `${symbol} moved to public`,
      detail: status === 'confirmed'
        ? isSend
          ? 'Spendable transfer confirmed.'
          : 'Onchain transaction confirmed.'
        : 'Onchain transaction failed.',
      token_symbol: symbol,
      amount_minor_units: operation.amount_minor_units,
      token_decimals: 6,
      transaction_hash: operation.transaction_hash,
      status,
    }, { onConflict: 'operation_id' });
    if (receiptError) throw new Error(receiptError.message);
  }
}
