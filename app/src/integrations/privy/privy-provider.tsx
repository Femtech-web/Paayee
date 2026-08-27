import { PrivyProvider, useAuthorizationSignature, useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import { useEffect, type PropsWithChildren } from 'react';

import { runtimeConfig } from '@/config/runtime';
import { installPaayeePrivyWalletTransport } from '@/features/confidential/privy-wallet-transport';
import { upsertCurrentProfile } from '@/integrations/supabase/auth';

import { getPrivyUserEmail, installPrivySessionBridge } from './session';

export function PaayeePrivyProvider({ children }: PropsWithChildren) {
  if (!runtimeConfig.privyConfigured) {
    return children;
  }

  return (
    <PrivyProvider
      appId={runtimeConfig.privyAppId}
      clientId={runtimeConfig.privyClientId}
      config={{
        embedded: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
      }}>
      <PrivyWalletRuntime />
      {children}
    </PrivyProvider>
  );
}

function PrivyWalletRuntime() {
  const { getAccessToken, isReady, logout, user } = usePrivy();
  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const { create, wallets } = useEmbeddedEthereumWallet();
  const wallet = wallets[0];
  const walletAccount = user?.linked_accounts.find((account) =>
    account.type === 'wallet' && 'wallet_client_type' in account && account.wallet_client_type === 'privy' &&
    'address' in account && account.address.toLowerCase() === wallet?.address.toLowerCase() &&
    'id' in account && Boolean(account.id));

  useEffect(
    () => installPrivySessionBridge({ getAccessToken, logout, user }),
    [getAccessToken, logout, user],
  );

  useEffect(() => {
    if (isReady && user && !wallet) {
      create().catch((error) => {
        console.warn('[paayee.privy.wallet]', {
          event: 'create_failed',
          reason: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }, [create, isReady, user, wallet]);

  useEffect(() => {
    if (!wallet) {
      return;
    }

    installPaayeePrivyWalletTransport(wallet, {
      generateAuthorizationSignature,
      walletId: walletAccount && 'id' in walletAccount ? walletAccount.id ?? undefined : undefined,
    });
    upsertCurrentProfile({
      email: getPrivyUserEmail(user),
      privyUserId: user?.id,
      smartAccountAddress: wallet.address,
    }).catch((error) => {
      console.warn('[paayee.privy.profile_link]', {
        event: 'failed',
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  }, [generateAuthorizationSignature, user, wallet, walletAccount]);

  return null;
}
