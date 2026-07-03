import { useLocalSearchParams } from 'expo-router';

import { type SendRecipient } from '../../send-data';
import { defaultRecipient, readParam } from './send-utils';

export function useRecipientParams(
  fallbackRecipient: SendRecipient = defaultRecipient,
): SendRecipient & { firstName: string } {
  const params = useLocalSearchParams<{
    account?: string;
    bank?: string;
    initials?: string;
    name?: string;
    wallet?: string;
  }>();
  const name = readParam(params.name) || fallbackRecipient.name;

  return {
    id: 'route-recipient',
    name,
    bankName: readParam(params.bank) || fallbackRecipient.bankName,
    accountNumber: readParam(params.account) || fallbackRecipient.accountNumber,
    handle: fallbackRecipient.handle,
    initials: readParam(params.initials) || fallbackRecipient.initials,
    walletAddress: readParam(params.wallet) || fallbackRecipient.walletAddress,
    firstName: name.split(' ')[0] || 'recipient',
  };
}
