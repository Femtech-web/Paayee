import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import type { EIP712TypedData, Hex } from '@zama-fhe/sdk';

const REQUEST_TIMEOUT_MS = 90_000;

type DecryptRequest = {
  chainId: number;
  contractAddress: string;
  encryptedHandle: string;
  relayerUrl: string;
  rpcUrl: string;
  userAddress: string;
};

type BatchDecryptRequest = {
  chainId: number;
  items: { contractAddress: string; encryptedHandle: string }[];
  relayerUrl: string;
  rpcUrl: string;
  userAddress: string;
};

type EncryptRequest = {
  amount: string;
  chainId: number;
  contractAddress: string;
  relayerUrl: string;
  rpcUrl: string;
  userAddress: string;
};

type PublicDecryptRequest = {
  chainId: number;
  encryptedHandle: string;
  relayerUrl: string;
  rpcUrl: string;
};

export type PaayeeWebEncryptionResult = {
  encryptedValue: Hex;
  inputProof: Hex;
};

export type PaayeeWebPublicDecryptionResult = {
  clearValue: bigint;
  decryptionProof: Hex;
};

type NativeRequest =
  | ({ id: string; type: 'decrypt_batch' } & BatchDecryptRequest)
  | ({ id: string; type: 'encrypt' } & EncryptRequest)
  | ({ id: string; type: 'public_decrypt' } & PublicDecryptRequest)
  | { id: string; signature?: Hex; type: 'signature_result'; error?: string };

type WebMessage =
  | { type: 'ready' }
  | { id: string; type: 'result'; value: unknown }
  | { id: string; type: 'error'; message: string }
  | { id: string; type: 'sign'; typedData: EIP712TypedData };

type PendingRequest = {
  reject: (reason: Error) => void;
  resolve: (value: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
};

let bridgeReady = false;
let injectMessage: ((message: NativeRequest) => void) | undefined;
let nextRequestId = 0;
const readyWaiters = new Set<() => void>();
const pendingRequests = new Map<string, PendingRequest>();

export async function decryptPaayeeZamaValueInWebRuntime(input: DecryptRequest): Promise<bigint> {
  const values = await decryptPaayeeZamaValuesInWebRuntime({
    chainId: input.chainId,
    items: [{ contractAddress: input.contractAddress, encryptedHandle: input.encryptedHandle }],
    relayerUrl: input.relayerUrl,
    rpcUrl: input.rpcUrl,
    userAddress: input.userAddress,
  });
  const value = values[input.encryptedHandle];
  try {
    return BigInt(String(value));
  } catch {
    throw new Error('Zama returned an invalid private balance.');
  }
}

export async function decryptPaayeeZamaValuesInWebRuntime(
  input: BatchDecryptRequest,
): Promise<Record<string, bigint>> {
  if (input.items.length === 0) return {};
  const value = await requestWebRuntime('decrypt_batch', input) as Record<string, string>;
  try {
    return Object.fromEntries(Object.entries(value).map(([handle, clearValue]) => [handle, BigInt(clearValue)]));
  } catch {
    throw new Error('Zama returned invalid private balances.');
  }
}

export async function encryptPaayeeZamaValueInWebRuntime(
  input: EncryptRequest,
): Promise<PaayeeWebEncryptionResult> {
  const value = await requestWebRuntime('encrypt', input) as {
    encryptedValue?: unknown;
    inputProof?: unknown;
  };
  const encryptedValue = normalizeBridgeHex(value?.encryptedValue);
  const inputProof = normalizeBridgeHex(value?.inputProof);
  if (!encryptedValue || !inputProof) {
    throw new Error('Zama returned an invalid encrypted input.');
  }
  return { encryptedValue, inputProof };
}

export async function publicDecryptPaayeeZamaValueInWebRuntime(
  input: PublicDecryptRequest,
): Promise<PaayeeWebPublicDecryptionResult> {
  const value = await requestWebRuntime('public_decrypt', input) as {
    clearValue?: string;
    decryptionProof?: unknown;
  };
  const decryptionProof = normalizeBridgeHex(value?.decryptionProof);
  if (typeof value?.clearValue !== 'string' || !decryptionProof) {
    throw new Error('Zama returned an invalid public decryption result.');
  }
  return { clearValue: BigInt(value.clearValue), decryptionProof };
}

function normalizeBridgeHex(value: unknown): Hex | undefined {
  if (typeof value === 'string') {
    const normalized = value.startsWith('0x') ? value : `0x${value}`;
    return /^0x(?:[a-fA-F0-9]{2})+$/.test(normalized) ? normalized as Hex : undefined;
  }
  if (Array.isArray(value) && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    return bytesToHex(value as number[]);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key, byte]) => /^\d+$/.test(key) && Number.isInteger(byte) && Number(byte) >= 0 && Number(byte) <= 255)
      .sort(([left], [right]) => Number(left) - Number(right));
    if (entries.length > 0) return bytesToHex(entries.map(([, byte]) => Number(byte)));
  }
  return undefined;
}

function bytesToHex(bytes: readonly number[]): Hex {
  return `0x${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function requestWebRuntime(
  type: 'decrypt_batch' | 'encrypt' | 'public_decrypt',
  input: BatchDecryptRequest | EncryptRequest | PublicDecryptRequest,
): Promise<unknown> {
  await waitForBridge();
  const id = `zama-${type}-${Date.now()}-${++nextRequestId}`;

  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Private balance decryption timed out. Please try again.'));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, { reject, resolve, timeout });
    injectMessage?.({ ...input, id, type } as NativeRequest);
  });
}

export function ZamaWebRuntimeBridge() {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    injectMessage = (message) => {
      const serialized = JSON.stringify(JSON.stringify(message));
      webViewRef.current?.injectJavaScript(
        `window.__PAAYEE_RECEIVE_NATIVE_MESSAGE__(${serialized}); true;`,
      );
    };

    return () => {
      bridgeReady = false;
      injectMessage = undefined;
      for (const pending of pendingRequests.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Private balance runtime was closed.'));
      }
      pendingRequests.clear();
    };
  }, []);

  async function onMessage(event: WebViewMessageEvent) {
    let message: WebMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as WebMessage;
    } catch {
      return;
    }

    if (message.type === 'ready') {
      bridgeReady = true;
      for (const wake of readyWaiters) wake();
      readyWaiters.clear();
      return;
    }

    if (message.type === 'sign') {
      try {
        const transport = globalThis.__PAAYEE_WALLET_TRANSPORT__;
        if (!transport) throw new Error('Paayee wallet is not ready yet.');
        const signature = await transport.signTypedData(message.typedData);
        injectMessage?.({ id: message.id, signature, type: 'signature_result' });
      } catch (error) {
        injectMessage?.({
          error: error instanceof Error ? error.message : 'Private viewing authorization failed.',
          id: message.id,
          type: 'signature_result',
        });
      }
      return;
    }

    const pending = pendingRequests.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingRequests.delete(message.id);

    if (message.type === 'result') {
      pending.resolve(message.value);
      return;
    }

    pending.reject(new Error(message.message));
  }

  return (
    <View pointerEvents="none" style={styles.host}>
      <WebView
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="never"
        onMessage={(event) => void onMessage(event)}
        originWhitelist={['about:*', 'https://cdn.zama.org', 'https://relayer.testnet.zama.org']}
        ref={webViewRef}
        source={{ html: ZAMA_RUNTIME_HTML, baseUrl: 'https://cdn.zama.org' }}
        style={styles.webView}
      />
    </View>
  );
}

function waitForBridge(): Promise<void> {
  if (bridgeReady && injectMessage) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      readyWaiters.delete(wake);
      reject(new Error('The private balance runtime could not start. Check your internet connection and try again.'));
    }, REQUEST_TIMEOUT_MS);
    const wake = () => {
      clearTimeout(timeout);
      resolve();
    };
    readyWaiters.add(wake);
  });
}

const styles = StyleSheet.create({
  host: {
    height: 1,
    left: -10,
    opacity: 0,
    position: 'absolute',
    top: -10,
    width: 1,
  },
  webView: {
    height: 1,
    width: 1,
  },
});

const ZAMA_RUNTIME_HTML = String.raw`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.zama.org/relayer-sdk-js/0.4.4/relayer-sdk-js.umd.cjs"></script>
  </head>
  <body>
    <script>
      (() => {
        const pendingSignatures = new Map();
        const instances = new Map();
        const sdk = window.relayerSDK;
        const sdkReady = sdk
          ? sdk.initSDK({ thread: 0 })
          : Promise.reject(new Error('The Zama browser runtime did not load.'));
        const send = (message) => window.ReactNativeWebView.postMessage(
          JSON.stringify(message, (_, value) => typeof value === 'bigint' ? value.toString() : value),
        );
        const stringifyError = (error) => error && error.message ? error.message : String(error);
        const toHex = (value) => {
          if (typeof value === 'string') return value.startsWith('0x') ? value : '0x' + value;
          const bytes = value instanceof Uint8Array
            ? value
            : ArrayBuffer.isView(value)
              ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
              : Array.isArray(value)
                ? value
                : Object.keys(value || {})
                    .filter((key) => /^\d+$/.test(key))
                    .sort((left, right) => Number(left) - Number(right))
                    .map((key) => value[key]);
          return '0x' + Array.from(bytes, (byte) => Number(byte).toString(16).padStart(2, '0')).join('');
        };

        async function getInstance(request) {
          if (request.chainId !== 11155111) {
            throw new Error('The mobile private-balance bridge currently supports Sepolia only.');
          }
          const key = [request.chainId, request.rpcUrl, request.relayerUrl].join(':');
          if (!instances.has(key)) {
            instances.set(key, sdkReady.then(() => sdk.createInstance({
                ...sdk.SepoliaConfig,
                network: request.rpcUrl,
                relayerUrl: request.relayerUrl,
              })),
            );
          }
          return await instances.get(key);
        }

        function requestSignature(id, typedData) {
          return new Promise((resolve, reject) => {
            pendingSignatures.set(id, { resolve, reject });
            send({ id, type: 'sign', typedData });
          });
        }

        async function decryptBatch(request) {
          const instance = await getInstance(request);
          const keypair = instance.generateKeypair();
          const contractAddresses = [...new Set(request.items.map((item) => item.contractAddress))];
          const startTimestamp = Math.floor(Date.now() / 1000);
          const durationDays = 1;
          const typedData = instance.createEIP712(
            keypair.publicKey,
            contractAddresses,
            startTimestamp,
            durationDays,
          );
          const signature = await requestSignature(request.id, typedData);
          const values = await instance.userDecrypt(
            request.items.map((item) => ({
              handle: item.encryptedHandle,
              contractAddress: item.contractAddress,
            })),
            keypair.privateKey,
            keypair.publicKey,
            signature.replace(/^0x/, ''),
            contractAddresses,
            request.userAddress,
            startTimestamp,
            durationDays,
          );
          return Object.fromEntries(request.items.map((item) => {
            const value = values[item.encryptedHandle];
            if (value === undefined) throw new Error('Zama did not return a requested private balance.');
            return [item.encryptedHandle, typeof value === 'bigint' ? value.toString() : String(value)];
          }));
        }

        async function encrypt(request) {
          const instance = await getInstance(request);
          const input = instance.createEncryptedInput(request.contractAddress, request.userAddress);
          input.add64(BigInt(request.amount));
          const result = await input.encrypt();
          if (!result.handles || !result.handles[0]) throw new Error('Zama returned no encrypted value.');
          return { encryptedValue: toHex(result.handles[0]), inputProof: toHex(result.inputProof) };
        }

        async function publicDecrypt(request) {
          const instance = await getInstance(request);
          const result = await instance.publicDecrypt([request.encryptedHandle]);
          const clearValue = result.clearValues[request.encryptedHandle];
          if (clearValue === undefined) throw new Error('Zama returned no public clear value.');
          return {
            clearValue: typeof clearValue === 'bigint' ? clearValue.toString() : String(clearValue),
            decryptionProof: toHex(result.decryptionProof),
          };
        }

        window.__PAAYEE_RECEIVE_NATIVE_MESSAGE__ = async (raw) => {
          const request = JSON.parse(raw);
          if (request.type === 'signature_result') {
            const pending = pendingSignatures.get(request.id);
            if (!pending) return;
            pendingSignatures.delete(request.id);
            if (request.error) pending.reject(new Error(request.error));
            else pending.resolve(request.signature);
            return;
          }
          try {
            let value;
            if (request.type === 'decrypt_batch') value = await decryptBatch(request);
            else if (request.type === 'encrypt') value = await encrypt(request);
            else if (request.type === 'public_decrypt') value = await publicDecrypt(request);
            else return;
            send({ id: request.id, type: 'result', value });
          } catch (error) {
            send({ id: request.id, type: 'error', message: stringifyError(error) });
          }
        };

        send({ type: 'ready' });
      })();
    </script>
  </body>
</html>`;
