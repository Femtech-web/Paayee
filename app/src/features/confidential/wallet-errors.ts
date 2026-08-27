export function readPaayeeWalletError(error: unknown, fallback: string): string {
  const message = readErrorMessage(error);
  const normalized = message.toLowerCase();

  if (/4001|action_rejected|user rejected|user denied|cancelled|canceled/.test(normalized)) {
    return 'Transaction cancelled. No funds were moved.';
  }
  if (/insufficient funds.*gas|insufficient.*native|intrinsic transaction cost|prefund|aa21|paymaster/.test(normalized)) {
    return 'Paayee could not sponsor this network fee right now. No funds were moved; please try again.';
  }
  if (/cipher|handle|relayer|gateway|not registered|not available|propagat|public decrypt|public_decrypt/.test(normalized)) {
    return 'This private transaction is still being prepared. Wait a few seconds, then try again.';
  }
  if (/transaction simulation failed/.test(normalized)) {
    return 'The private transaction is still becoming available on the network. Wait a few seconds, then try again.';
  }
  if (/timeout|timed out|failed to fetch|network request|network error/.test(normalized)) {
    return 'The network is taking too long to respond. Check your connection and try again.';
  }
  if (/nonce|already known|replacement transaction/.test(normalized)) {
    return 'The wallet is still finishing another transaction. Wait a moment and try again.';
  }
  if (/revert|execution reverted|call exception/.test(normalized)) {
    return 'The transaction was rejected onchain. Your balance was not changed.';
  }
  if (/^enter |^you only have |^this paayee asset|^reveal your private balance|^your previous unshield|^paayee could not check for an unfinished unshield/.test(normalized)) {
    return message;
  }

  return fallback;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const candidate = error as Error & { cause?: unknown; shortMessage?: unknown };
    if (typeof candidate.shortMessage === 'string') return candidate.shortMessage;
    if (candidate.message) return candidate.message;
    if (candidate.cause) return readErrorMessage(candidate.cause);
  }
  return typeof error === 'string' ? error : '';
}
