import type { User } from '@privy-io/api-types';

type PrivySessionBridge = {
  getAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
  user: User | null;
};

let bridge: PrivySessionBridge | undefined;

export function installPrivySessionBridge(next: PrivySessionBridge): () => void {
  bridge = next;

  return () => {
    if (bridge === next) {
      bridge = undefined;
    }
  };
}

export async function getCurrentPrivyAccessToken(): Promise<string | null> {
  return bridge?.getAccessToken() ?? null;
}

export function getCurrentPrivyUser(): User | null {
  return bridge?.user ?? null;
}

export function getPrivyUserEmail(user: User | null): string | undefined {
  const account = user?.linked_accounts.find(
    (candidate) => candidate.type === 'email' || candidate.type === 'google_oauth',
  );

  return account && 'email' in account && account.email ? account.email : undefined;
}

export async function hasPrivySession(): Promise<boolean> {
  return Boolean(bridge?.user && (await getCurrentPrivyAccessToken()));
}

export async function logoutFromPrivy(): Promise<void> {
  await bridge?.logout();
}
