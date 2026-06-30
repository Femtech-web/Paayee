import { getKlydeConfig, type KlydeConfig } from './env';

type KlydeHttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type KlydeRequestOptions = {
  apiKey?: string;
  body?: unknown;
  idempotencyKey?: string;
  sessionToken?: string;
  signal?: AbortSignal;
};

export type KlydeHealth = {
  ok?: boolean;
  status?: string;
  uptime?: number;
};

export type KlydeMoneyAmount = {
  currency: string;
  display?: string;
  minorUnits?: string;
  scale?: number;
};

export type KlydeQuoteDepositInput = {
  amount: KlydeMoneyAmount;
  rail?: {
    provider?: string;
    type?: string;
  };
};

export type KlydeCreateDepositInput = {
  quoteId: string;
  source: {
    type: string;
    provider?: string;
    reference?: string;
  };
};

export type KlydeApiClient = ReturnType<typeof createKlydeApiClient>;

export function createKlydeApiClient(config: KlydeConfig = getKlydeConfig()) {
  return {
    health: (options?: Pick<KlydeRequestOptions, 'signal'>) =>
      request<KlydeHealth>(config, 'GET', '/health', options),

    getCurrentUser: (options?: KlydeRequestOptions) =>
      request<unknown>(config, 'GET', '/v1/me', options),

    getCurrentWallet: (options?: KlydeRequestOptions) =>
      request<unknown>(config, 'GET', '/v1/wallets/current', options),

    quoteDeposit: (body: KlydeQuoteDepositInput, options?: KlydeRequestOptions) =>
      request<unknown>(config, 'POST', '/v1/quotes/deposit', { ...options, body }),

    createDeposit: (body: KlydeCreateDepositInput, options?: KlydeRequestOptions) =>
      request<unknown>(config, 'POST', '/v1/deposits', { ...options, body }),

    getReceipt: (receiptId: string, options?: KlydeRequestOptions) =>
      request<unknown>(config, 'GET', `/v1/receipts/${encodeURIComponent(receiptId)}`, options),
  };
}

async function request<TResponse>(
  config: KlydeConfig,
  method: KlydeHttpMethod,
  path: string,
  options: KlydeRequestOptions = {},
): Promise<TResponse> {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: createHeaders(config, options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new Error(readKlydeErrorMessage(response.status, payload));
  }

  return payload as TResponse;
}

function createHeaders(
  config: KlydeConfig,
  options: KlydeRequestOptions,
): Record<string, string> {
  return stripUndefinedHeaders({
    accept: 'application/json',
    'content-type': 'application/json',
    'x-klyde-app-id': config.appId,
    'x-klyde-environment': config.environment,
    'x-klyde-market': config.market,
    'x-idempotency-key': options.idempotencyKey,
    authorization: options.sessionToken ? `Bearer ${options.sessionToken}` : undefined,
    'x-klyde-api-key': options.apiKey,
  });
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readKlydeErrorMessage(status: number, payload: unknown): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }
  }

  return `Klyde API request failed with HTTP ${status}`;
}

function stripUndefinedHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
