import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Transfer as USDCTransfer } from '../generated/PaayeeUSDC/ERC20';
import { Transfer as USDTTransfer } from '../generated/PaayeeUSDT/ERC20';
import { StablecoinFundingAccount, StablecoinTransfer } from '../generated/schema';

const ZERO = BigInt.fromI32(0);
const ONE = BigInt.fromI32(1);

export function handleUSDCTransfer(event: USDCTransfer): void {
  record('USDC', event.address, event.params.from, event.params.to, event.params.value, event.transaction.hash, event.logIndex, event.block.number, event.block.timestamp);
}

export function handleUSDTTransfer(event: USDTTransfer): void {
  record('USDT', event.address, event.params.from, event.params.to, event.params.value, event.transaction.hash, event.logIndex, event.block.number, event.block.timestamp);
}

function record(symbol: string, token: Bytes, from: Bytes, to: Bytes, value: BigInt, hash: Bytes, logIndex: BigInt, blockNumber: BigInt, timestamp: BigInt): void {
  const transfer = new StablecoinTransfer(hash.toHexString() + '-' + logIndex.toString());
  transfer.token = token;
  transfer.tokenSymbol = symbol;
  transfer.from = from;
  transfer.to = to;
  transfer.value = value;
  transfer.transactionHash = hash;
  transfer.logIndex = logIndex;
  transfer.blockNumber = blockNumber;
  transfer.timestamp = timestamp;
  transfer.save();

  const accountId = to.toHexString();
  let account = StablecoinFundingAccount.load(accountId);
  if (account == null) {
    account = new StablecoinFundingAccount(accountId);
    account.address = to;
    account.transferCount = ZERO;
    account.totalReceivedUSDC = ZERO;
    account.totalReceivedUSDT = ZERO;
  }
  account.transferCount = account.transferCount.plus(ONE);
  if (symbol == 'USDC') account.totalReceivedUSDC = account.totalReceivedUSDC.plus(value);
  if (symbol == 'USDT') account.totalReceivedUSDT = account.totalReceivedUSDT.plus(value);
  account.lastTransferHash = hash;
  account.lastTransferAt = timestamp;
  account.lastBlockNumber = blockNumber;
  account.save();
}
