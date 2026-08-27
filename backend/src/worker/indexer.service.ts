import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createPublicClient, getAddress, http, parseAbiItem, type Address, type PublicClient } from 'viem';

import { AppConfig, type AssetConfig } from '../config';
import { ChainRepository, type IndexedConfidentialTransfer, type IndexedTransfer } from './chain.repository';
import { SponsorshipRepository } from '../wallet/sponsorship.repository';

const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const confidentialTransferEvent = parseAbiItem(
  'event ConfidentialTransfer(address indexed from, address indexed to, bytes32 indexed amount)',
);

@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private readonly client: PublicClient;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(ChainRepository) private readonly repository: ChainRepository,
    @Inject(SponsorshipRepository) private readonly sponsorships: SponsorshipRepository,
  ) {
    this.client = createPublicClient({ transport: http(config.rpcUrl) });
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.pollSafely(), this.config.intervalMs);
    void this.pollSafely();
    this.logger.log(`Started ${this.config.indexerDriver} deposit worker on chain ${this.config.chainId}`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async pollSafely() {
    if (this.running) return;
    this.running = true;
    try {
      if (this.config.indexerDriver === 'subgraph') {
        await this.pollSubgraph();
        await this.pollConfidentialSubgraph();
        // Graph Studio can trail Sepolia by a minute or two. Keep the subgraph
        // as the historical index, but scan a tiny RPC tail so an open mobile
        // app receives fresh deposits and receipts promptly.
        await this.pollRpcTail();
        await this.pollConfidentialRpc(true);
      } else {
        await this.pollRpc();
        await this.pollConfidentialRpc();
      }
      await this.confirmOperations();
      await this.confirmSponsoredTransactions();
      await this.confirmFeeCollections();
    } catch (cause) {
      this.logger.error(cause instanceof Error ? cause.stack : String(cause));
    } finally {
      this.running = false;
    }
  }

  private async pollConfidentialRpc(tailOnly = false) {
    const latestBlock = await this.client.getBlockNumber();
    const fundingAddresses = await this.repository.fundingAddresses();
    if (!fundingAddresses.length) return;
    for (const asset of this.config.assets) {
      const source = `rpc:confidential:${asset.symbol}`;
      const checkpoint = await this.repository.checkpoint(this.config.chainId, source);
      const fallback = latestBlock > this.config.lookbackBlocks ? latestBlock - this.config.lookbackBlocks : 0n;
      const tailStart = latestBlock > 64n ? latestBlock - 64n : 0n;
      const replayFrom = tailOnly
        ? tailStart
        : checkpoint === undefined
        ? fallback
        : checkpoint > this.config.lookbackBlocks ? checkpoint - this.config.lookbackBlocks : 0n;
      const fromBlock = maxBigInt(asset.startBlock, replayFrom);
      if (fromBlock > latestBlock) continue;
      for (const recipients of chunk(fundingAddresses, 100)) {
        const events = await this.client.getContractEvents({
          address: asset.confidentialAddress,
          abi: [confidentialTransferEvent],
          eventName: 'ConfidentialTransfer',
          args: { to: recipients.map((address) => getAddress(address)) },
          fromBlock,
          toBlock: latestBlock,
        });
        for (const event of events) {
          if (!event.args.from || !event.args.to || !event.args.amount || event.logIndex === undefined) continue;
          if (event.args.from === '0x0000000000000000000000000000000000000000') continue;
          const block = await this.client.getBlock({ blockNumber: event.blockNumber });
          await this.repository.recordConfidentialTransfer(
            this.config.chainId,
            this.config.confirmations,
            latestBlock,
            {
              asset,
              from: getAddress(event.args.from),
              to: getAddress(event.args.to),
              encryptedAmountHandle: event.args.amount,
              transactionHash: event.transactionHash,
              logIndex: event.logIndex,
              blockNumber: event.blockNumber,
              blockTimestamp: new Date(Number(block.timestamp) * 1000),
            },
          );
        }
      }
      if (!tailOnly) await this.repository.saveCheckpoint(this.config.chainId, source, latestBlock);
    }
  }

  private async pollConfidentialSubgraph() {
    if (!this.config.subgraphUrl) throw new Error('PAAYEE_SUBGRAPH_URL is required for subgraph mode');
    const latestBlock = await this.client.getBlockNumber();
    const fundingAddresses = await this.repository.fundingAddresses();
    if (!fundingAddresses.length) return;

    for (const asset of this.config.assets) {
      const source = `subgraph:confidential:${asset.symbol}`;
      const checkpoint = await this.repository.checkpoint(this.config.chainId, source);
      const replayFrom = checkpoint === undefined
        ? asset.startBlock
        : checkpoint > this.config.lookbackBlocks ? checkpoint - this.config.lookbackBlocks : 0n;
      const fromBlock = maxBigInt(asset.startBlock, replayFrom);
      let indexedBlock = fromBlock;
      for (const recipients of chunk(fundingAddresses, 100)) {
        let cursor = '';
        while (true) {
          const response = await fetch(this.config.subgraphUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query: `query ConfidentialTransfers($token: Bytes!, $from: BigInt!, $recipients: [Bytes!]!, $cursor: ID!) { _meta { block { number } } confidentialStablecoinTransfers(first: 500, orderBy: id, orderDirection: asc, where: { token: $token, to_in: $recipients, blockNumber_gte: $from, id_gt: $cursor }) { id from to encryptedAmountHandle transactionHash logIndex blockNumber timestamp } }`,
              variables: {
                token: asset.confidentialAddress.toLowerCase(),
                from: fromBlock.toString(),
                recipients,
                cursor,
              },
            }),
          });
          const payload = await response.json() as ConfidentialSubgraphPayload;
          if (!response.ok || payload.errors?.length) {
            throw new Error(payload.errors?.[0]?.message ?? `Subgraph returned ${response.status}`);
          }
          indexedBlock = maxBigInt(indexedBlock, BigInt(payload.data?._meta?.block?.number ?? Number(fromBlock)));
          const transfers = payload.data?.confidentialStablecoinTransfers ?? [];
          for (const transfer of transfers) {
            await this.repository.recordConfidentialTransfer(
              this.config.chainId,
              this.config.confirmations,
              latestBlock,
              mapConfidentialSubgraphTransfer(asset, transfer),
            );
          }
          if (transfers.length < 500) break;
          cursor = transfers[transfers.length - 1].id;
        }
      }
      await this.repository.saveCheckpoint(this.config.chainId, source, indexedBlock);
    }
  }

  private async pollRpc() {
    const latestBlock = await this.client.getBlockNumber();
    for (const asset of this.config.assets) {
      const source = `rpc:${asset.symbol}`;
      const checkpoint = await this.repository.checkpoint(this.config.chainId, source);
      const fallback = latestBlock > this.config.lookbackBlocks ? latestBlock - this.config.lookbackBlocks : 0n;
      const replayFrom = checkpoint === undefined
        ? fallback
        : checkpoint > this.config.lookbackBlocks ? checkpoint - this.config.lookbackBlocks : 0n;
      const fromBlock = maxBigInt(asset.startBlock, replayFrom);
      if (fromBlock > latestBlock) continue;
      const events = await this.client.getContractEvents({
        address: asset.publicAddress,
        abi: [transferEvent],
        eventName: 'Transfer',
        fromBlock,
        toBlock: latestBlock,
      });
      for (const event of events) {
        if (!event.args.from || !event.args.to || event.args.value === undefined || event.logIndex === undefined) continue;
        const block = await this.client.getBlock({ blockNumber: event.blockNumber });
        await this.repository.recordTransfer(this.config.chainId, this.config.confirmations, latestBlock, {
          asset,
          from: getAddress(event.args.from),
          to: getAddress(event.args.to),
          value: event.args.value,
          transactionHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          blockTimestamp: new Date(Number(block.timestamp) * 1000),
        });
      }
      await this.repository.saveCheckpoint(this.config.chainId, source, latestBlock);
    }
  }

  private async pollSubgraph() {
    if (!this.config.subgraphUrl) throw new Error('PAAYEE_SUBGRAPH_URL is required for subgraph mode');
    const latestBlock = await this.client.getBlockNumber();
    const fundingAddresses = await this.repository.fundingAddresses();
    if (!fundingAddresses.length) return;

    for (const asset of this.config.assets) {
      const source = `subgraph:${asset.symbol}`;
      const checkpoint = await this.repository.checkpoint(this.config.chainId, source);
      const replayFrom = checkpoint === undefined
        ? asset.startBlock
        : checkpoint > this.config.lookbackBlocks ? checkpoint - this.config.lookbackBlocks : 0n;
      const fromBlock = maxBigInt(asset.startBlock, replayFrom);
      let indexedBlock = fromBlock;

      for (const recipients of chunk(fundingAddresses, 100)) {
        let cursor = '';
        while (true) {
          const response = await fetch(this.config.subgraphUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query: `query Transfers($token: Bytes!, $from: BigInt!, $recipients: [Bytes!]!, $cursor: ID!) { _meta { block { number } } stablecoinTransfers(first: 500, orderBy: id, orderDirection: asc, where: { token: $token, to_in: $recipients, blockNumber_gte: $from, id_gt: $cursor }) { id from to value transactionHash logIndex blockNumber timestamp } }`,
              variables: {
                token: asset.publicAddress.toLowerCase(),
                from: fromBlock.toString(),
                recipients,
                cursor,
              },
            }),
          });
          const payload = await response.json() as SubgraphPayload;
          if (!response.ok || payload.errors?.length) {
            throw new Error(payload.errors?.[0]?.message ?? `Subgraph returned ${response.status}`);
          }
          indexedBlock = maxBigInt(
            indexedBlock,
            BigInt(payload.data?._meta?.block?.number ?? Number(fromBlock)),
          );
          const transfers = payload.data?.stablecoinTransfers ?? [];
          for (const transfer of transfers) {
            await this.repository.recordTransfer(
              this.config.chainId,
              this.config.confirmations,
              latestBlock,
              mapSubgraphTransfer(asset, transfer),
            );
          }
          if (transfers.length < 500) break;
          cursor = transfers[transfers.length - 1].id;
        }
      }
      await this.repository.saveCheckpoint(this.config.chainId, source, indexedBlock);
    }
  }

  private async pollRpcTail() {
    const latestBlock = await this.client.getBlockNumber();
    const tailBlocks = 64n;
    const tailStart = latestBlock > tailBlocks ? latestBlock - tailBlocks : 0n;
    const fundingAddresses = await this.repository.fundingAddresses();
    if (!fundingAddresses.length) return;

    for (const asset of this.config.assets) {
      const fromBlock = maxBigInt(asset.startBlock, tailStart);
      for (const recipients of chunk(fundingAddresses, 100)) {
        const events = await this.client.getContractEvents({
          address: asset.publicAddress,
          abi: [transferEvent],
          eventName: 'Transfer',
          args: { to: recipients.map((address) => getAddress(address)) },
          fromBlock,
          toBlock: latestBlock,
        });
        for (const event of events) {
          if (!event.args.from || !event.args.to || event.args.value === undefined || event.logIndex === undefined) continue;
          const block = await this.client.getBlock({ blockNumber: event.blockNumber });
          await this.repository.recordTransfer(this.config.chainId, this.config.confirmations, latestBlock, {
            asset,
            from: getAddress(event.args.from),
            to: getAddress(event.args.to),
            value: event.args.value,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber,
            blockTimestamp: new Date(Number(block.timestamp) * 1000),
          });
        }
      }
    }
  }

  private async confirmOperations() {
    for (const operation of await this.repository.submittedOperations()) {
      try {
        const receipt = await this.client.getTransactionReceipt({ hash: operation.transaction_hash as `0x${string}` });
        await this.repository.settleOperation(operation, receipt.status === 'success' ? 'confirmed' : 'failed');
      } catch (cause) {
        if (!(cause instanceof Error) || !/not found|could not be found/i.test(cause.message)) throw cause;
      }
    }
  }

  private async confirmSponsoredTransactions() {
    for (const transaction of await this.sponsorships.submittedTransactions()) {
      try {
        let transactionHash = transaction.transaction_hash as `0x${string}` | null;
        if (!transactionHash && transaction.privy_transaction_id) {
          const privyTransaction = await this.privyTransaction(transaction.privy_transaction_id as string);
          if (privyTransaction.status === 'failed' || privyTransaction.status === 'reverted') {
            await this.sponsorships.settleTransaction({ id: transaction.id as string, status: 'failed' });
            continue;
          }
          if (!privyTransaction.transaction_hash) continue;
          transactionHash = privyTransaction.transaction_hash as `0x${string}`;
          await this.sponsorships.attachTransactionHash(transaction.id as string, transactionHash);
        }
        if (!transactionHash) continue;
        const receipt = await this.client.getTransactionReceipt({ hash: transactionHash });
        const actualNetworkCostWei = receipt.gasUsed * receipt.effectiveGasPrice;
        await this.sponsorships.settleTransaction({
          id: transaction.id as string,
          status: receipt.status === 'success' ? 'confirmed' : 'failed',
          actualGasUsed: receipt.gasUsed.toString(),
          effectiveGasPriceWei: receipt.effectiveGasPrice.toString(),
          actualNetworkCostWei: actualNetworkCostWei.toString(),
        });
        if (transaction.wallet_id) {
          await this.capturePrivySpendWindow({
            createdAt: transaction.created_at as string,
            transactionId: transaction.id as string,
            walletId: transaction.wallet_id as string,
          });
        }
      } catch (cause) {
        if (!(cause instanceof Error) || !/not found|could not be found/i.test(cause.message)) throw cause;
      }
    }
  }

  private async privyTransaction(transactionId: string): Promise<{
    status: string;
    transaction_hash?: string | null;
  }> {
    const response = await fetch(`https://api.privy.io/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: this.privyHeaders(),
    });
    const payload = await response.json().catch(() => ({})) as {
      status?: string;
      transaction_hash?: string | null;
      message?: string;
    };
    if (!response.ok || !payload.status) throw new Error(payload.message ?? 'Privy transaction lookup failed');
    return { status: payload.status, transaction_hash: payload.transaction_hash };
  }

  private async capturePrivySpendWindow(input: { createdAt: string; transactionId: string; walletId: string }) {
    try {
      const start = new Date(input.createdAt).getTime();
      const end = Date.now();
      const query = new URLSearchParams({
        wallet_ids: input.walletId,
        start_timestamp: String(start),
        end_timestamp: String(end),
      });
      const response = await fetch(`https://api.privy.io/v1/apps/gas_spend?${query}`, {
        headers: this.privyHeaders(),
      });
      const payload = await response.json().catch(() => ({})) as { value?: string; message?: string };
      if (!response.ok || payload.value === undefined) throw new Error(payload.message ?? 'Privy gas-spend lookup failed');
      await this.sponsorships.recordPrivySpendWindow({
        transactionId: input.transactionId,
        walletId: input.walletId,
        windowStart: new Date(start).toISOString(),
        windowEnd: new Date(end).toISOString(),
        spendUsd: payload.value,
      });
    } catch (cause) {
      // The chain receipt remains the exact per-transaction source. Privy's API
      // reports aggregate credits for a wallet/time window, so accounting
      // capture must not change an already-confirmed transaction status.
      this.logger.warn(`Could not capture Privy gas-spend window: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  private privyHeaders() {
    return {
      authorization: `Basic ${Buffer.from(`${this.config.privyAppId}:${this.config.privyAppSecret}`).toString('base64')}`,
      'privy-app-id': this.config.privyAppId,
    };
  }

  private async confirmFeeCollections() {
    for (const quote of await this.sponsorships.submittedFeeCollections()) {
      try {
        const receipt = await this.client.getTransactionReceipt({ hash: quote.fee_transaction_hash as `0x${string}` });
        await this.sponsorships.settleFeeCollection(
          quote.id as string,
          receipt.status === 'success' ? 'collected' : 'failed',
        );
      } catch (cause) {
        if (!(cause instanceof Error) || !/not found|could not be found/i.test(cause.message)) throw cause;
      }
    }
  }
}

type SubgraphTransfer = { id: string; from: string; to: string; value: string; transactionHash: string; logIndex: string; blockNumber: string; timestamp: string };
type SubgraphPayload = {
  errors?: { message: string }[];
  data?: {
    _meta?: { block?: { number: number } };
    stablecoinTransfers?: SubgraphTransfer[];
  };
};
type ConfidentialSubgraphTransfer = Omit<SubgraphTransfer, 'value'> & { encryptedAmountHandle: string };
type ConfidentialSubgraphPayload = {
  errors?: { message: string }[];
  data?: {
    _meta?: { block?: { number: number } };
    confidentialStablecoinTransfers?: ConfidentialSubgraphTransfer[];
  };
};

function mapSubgraphTransfer(asset: AssetConfig, transfer: SubgraphTransfer): IndexedTransfer {
  return {
    asset,
    from: getAddress(transfer.from as Address),
    to: getAddress(transfer.to as Address),
    value: BigInt(transfer.value),
    transactionHash: transfer.transactionHash,
    logIndex: Number(transfer.logIndex),
    blockNumber: BigInt(transfer.blockNumber),
    blockTimestamp: new Date(Number(transfer.timestamp) * 1000),
  };
}

function mapConfidentialSubgraphTransfer(
  asset: AssetConfig,
  transfer: ConfidentialSubgraphTransfer,
): IndexedConfidentialTransfer {
  return {
    asset,
    from: getAddress(transfer.from as Address),
    to: getAddress(transfer.to as Address),
    encryptedAmountHandle: transfer.encryptedAmountHandle,
    transactionHash: transfer.transactionHash,
    logIndex: Number(transfer.logIndex),
    blockNumber: BigInt(transfer.blockNumber),
    blockTimestamp: new Date(Number(transfer.timestamp) * 1000),
  };
}

function maxBigInt(left: bigint, right: bigint) { return left > right ? left : right; }

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}
