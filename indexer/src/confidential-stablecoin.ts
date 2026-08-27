import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { ConfidentialTransfer as USDCTransfer } from '../generated/PaayeeConfidentialUSDC/ERC7984';
import { ConfidentialTransfer as USDTTransfer } from '../generated/PaayeeConfidentialUSDT/ERC7984';
import { ConfidentialStablecoinTransfer } from '../generated/schema';

export function handleConfidentialUSDCTransfer(event: USDCTransfer): void {
  record('USDC', event.address, event.params.from, event.params.to, event.params.amount, event.transaction.hash, event.logIndex, event.block.number, event.block.timestamp);
}

export function handleConfidentialUSDTTransfer(event: USDTTransfer): void {
  record('USDT', event.address, event.params.from, event.params.to, event.params.amount, event.transaction.hash, event.logIndex, event.block.number, event.block.timestamp);
}

function record(symbol: string, token: Bytes, from: Bytes, to: Bytes, encryptedAmountHandle: Bytes, hash: Bytes, logIndex: BigInt, blockNumber: BigInt, timestamp: BigInt): void {
  const transfer = new ConfidentialStablecoinTransfer(hash.toHexString() + '-' + logIndex.toString());
  transfer.token = token;
  transfer.tokenSymbol = symbol;
  transfer.from = from;
  transfer.to = to;
  transfer.encryptedAmountHandle = encryptedAmountHandle;
  transfer.transactionHash = hash;
  transfer.logIndex = logIndex;
  transfer.blockNumber = blockNumber;
  transfer.timestamp = timestamp;
  transfer.save();
}
