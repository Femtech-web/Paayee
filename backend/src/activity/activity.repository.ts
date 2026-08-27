import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_ADMIN } from '../database/database.module';
import { AppConfig } from '../config';
import type { CreateOperationDto } from './dto/create-operation.dto';

@Injectable()
export class ActivityRepository {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  async profileForPrivyUser(privyUserId: string): Promise<{ id: string; smart_account_address: string | null }> {
    const { data, error } = await this.db.from('profiles').select('id,smart_account_address')
      .eq('privy_user_id', privyUserId).maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Paayee profile not found');
    return data;
  }

  async list(privyUserId: string, symbol?: string) {
    const profile = await this.profileForPrivyUser(privyUserId);
    let deposits = this.db.from('paayee_deposits').select('*').eq('profile_id', profile.id)
      .order('created_at', { ascending: false }).limit(50);
    let operations = this.db.from('paayee_operations').select('*').eq('profile_id', profile.id)
      .order('created_at', { ascending: false }).limit(50);
    let privateTransfers = this.db.from('paayee_private_transfers').select('*').eq('profile_id', profile.id)
      .order('created_at', { ascending: false }).limit(50);
    if (symbol) {
      deposits = deposits.eq('token_symbol', symbol);
      operations = operations.eq('token_symbol', symbol);
      privateTransfers = privateTransfers.eq('token_symbol', symbol);
    }
    let receipts = this.db.from('paayee_receipts').select('*').eq('profile_id', profile.id)
      .order('created_at', { ascending: false }).limit(100);
    if (symbol) receipts = receipts.eq('token_symbol', symbol);
    const [depositResult, operationResult, privateTransferResult, receiptResult] = await Promise.all([
      deposits,
      operations,
      privateTransfers,
      receipts,
    ]);
    if (depositResult.error) throw new InternalServerErrorException(depositResult.error.message);
    if (operationResult.error) throw new InternalServerErrorException(operationResult.error.message);
    if (privateTransferResult.error) throw new InternalServerErrorException(privateTransferResult.error.message);
    if (receiptResult.error) throw new InternalServerErrorException(receiptResult.error.message);
    const privateTransfersWithSenders = await this.enrichPrivateTransferSenders(privateTransferResult.data ?? []);
    const privateTransferById = new Map(
      privateTransfersWithSenders.map((transfer) => [transfer.id as string, transfer]),
    );
    return {
      deposits: depositResult.data ?? [],
      operations: operationResult.data ?? [],
      privateTransfers: privateTransfersWithSenders,
      receipts: (receiptResult.data ?? []).map((receipt) => ({
        ...receipt,
        ...(receipt.private_transfer_id
          ? privateTransferIdentity(privateTransferById.get(receipt.private_transfer_id as string))
          : {}),
      })),
    };
  }

  async receipt(privyUserId: string, receiptId: string) {
    const profile = await this.profileForPrivyUser(privyUserId);
    const { data, error } = await this.db.from('paayee_receipts').select('*')
      .eq('id', receiptId).eq('profile_id', profile.id).maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Receipt not found');
    if (!data.private_transfer_id) return data;
    const { data: transfer, error: transferError } = await this.db.from('paayee_private_transfers').select('*')
      .eq('id', data.private_transfer_id).eq('profile_id', profile.id).maybeSingle();
    if (transferError) throw new InternalServerErrorException(transferError.message);
    const [enrichedTransfer] = await this.enrichPrivateTransferSenders(transfer ? [transfer] : []);
    return { ...data, ...privateTransferIdentity(enrichedTransfer) };
  }

  async createOperation(privyUserId: string, input: CreateOperationDto) {
    const profile = await this.profileForPrivyUser(privyUserId);
    const asset = this.config.assets.find((candidate) => candidate.symbol === input.tokenSymbol);
    if (
      input.chainId !== this.config.chainId
      || !asset
      || asset.publicAddress.toLowerCase() !== input.publicTokenAddress.toLowerCase()
      || asset.confidentialAddress.toLowerCase() !== input.confidentialTokenAddress.toLowerCase()
    ) {
      throw new BadRequestException('Operation does not match a configured Paayee asset');
    }
    if (!profile.smart_account_address) {
      throw new BadRequestException('Your Privy wallet is not linked to this Paayee profile');
    }
    if (input.kind === 'public_send' && !input.destinationAddress) {
      throw new BadRequestException('A stablecoin send requires a destination address');
    }
    const { data, error } = await this.db.from('paayee_operations').upsert({
      profile_id: profile.id,
      chain_id: input.chainId,
      kind: input.kind,
      token_symbol: input.tokenSymbol,
      public_token_address: input.publicTokenAddress,
      confidential_token_address: input.confidentialTokenAddress,
      destination_address: input.destinationAddress ?? null,
      amount_minor_units: input.amountMinorUnits,
      transaction_hash: input.transactionHash,
      status: 'submitted',
    }, { onConflict: 'chain_id,transaction_hash,kind' }).select('*').single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  private async enrichPrivateTransferSenders(transfers: Record<string, unknown>[]) {
    const senderIds = [...new Set(transfers
      .map((transfer) => transfer.sender_profile_id)
      .filter((value): value is string => typeof value === 'string'))];
    if (!senderIds.length) return transfers;
    const { data: senders, error } = await this.db.from('profiles')
      .select('id,paayee_handle,first_name,last_name').in('id', senderIds);
    if (error) throw new InternalServerErrorException(error.message);
    const senderById = new Map((senders ?? []).map((sender) => [sender.id as string, sender]));
    return transfers.map((transfer) => {
      const sender = senderById.get(transfer.sender_profile_id as string);
      if (!sender) return transfer;
      const displayName = [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim();
      return {
        ...transfer,
        sender_handle: sender.paayee_handle ? `@${String(sender.paayee_handle).replace(/^@+/, '')}` : undefined,
        sender_name: displayName || undefined,
      };
    });
  }
}

function privateTransferIdentity(transfer?: Record<string, unknown>) {
  if (!transfer) return {};
  return {
    from_address: transfer.from_address,
    sender_handle: transfer.sender_handle,
    sender_name: transfer.sender_name,
  };
}
