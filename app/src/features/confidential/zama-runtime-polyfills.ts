/* eslint-disable no-extend-native */

import * as ExpoCrypto from 'expo-crypto';

type ArrayCopyMethodName = 'toReversed' | 'toSorted' | 'toSpliced' | 'with';
type BrowserLikeCrypto = {
  getRandomValues?: <T extends ArrayBufferView>(typedArray: T) => T;
  randomUUID?: () => string;
  subtle?: {
    digest?: (algorithm: AlgorithmIdentifier, data: BufferSource) => Promise<ArrayBuffer>;
  };
};

installCryptoPolyfill();

function defineArrayCopyMethod(
  name: ArrayCopyMethodName,
  implementation: (this: unknown[], ...args: unknown[]) => unknown[],
): void {
  if (typeof (Array.prototype as unknown as Record<string, unknown>)[name] === 'function') {
    return;
  }

  Object.defineProperty(Array.prototype, name, {
    configurable: true,
    value: implementation,
    writable: true,
  });
}

defineArrayCopyMethod('toSorted', function toSorted(this: unknown[], compareFn?: unknown) {
  return [...this].sort(compareFn as (left: unknown, right: unknown) => number);
});

defineArrayCopyMethod('toReversed', function toReversed(this: unknown[]) {
  return [...this].reverse();
});

defineArrayCopyMethod('toSpliced', function toSpliced(this: unknown[], start?: unknown, deleteCount?: unknown, ...items: unknown[]) {
  const copy = [...this];
  const normalizedStart = typeof start === 'number' ? start : Number(start ?? 0);

  if (arguments.length === 1) {
    copy.splice(normalizedStart);
  } else {
    copy.splice(normalizedStart, Number(deleteCount ?? 0), ...items);
  }

  return copy;
});

defineArrayCopyMethod('with', function arrayWith(this: unknown[], index: unknown, value: unknown) {
  const copy = [...this];
  const normalizedIndex = Number(index);
  const resolvedIndex = normalizedIndex < 0 ? copy.length + normalizedIndex : normalizedIndex;

  if (resolvedIndex < 0 || resolvedIndex >= copy.length) {
    throw new RangeError('Array.prototype.with index is out of range');
  }

  copy[resolvedIndex] = value;
  return copy;
});

function installCryptoPolyfill(): void {
  const existingCrypto = (globalThis.crypto ?? {}) as BrowserLikeCrypto;
  const nextCrypto: BrowserLikeCrypto = {
    ...existingCrypto,
    getRandomValues:
      typeof existingCrypto.getRandomValues === 'function'
        ? existingCrypto.getRandomValues.bind(existingCrypto)
        : getRandomValues,
    randomUUID:
      typeof existingCrypto.randomUUID === 'function'
        ? existingCrypto.randomUUID.bind(existingCrypto)
        : ExpoCrypto.randomUUID,
    subtle: {
      ...(existingCrypto.subtle ?? {}),
      digest:
        typeof existingCrypto.subtle?.digest === 'function'
          ? existingCrypto.subtle.digest.bind(existingCrypto.subtle)
          : digest,
    },
  };

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: nextCrypto,
    writable: true,
  });
}

function getRandomValues<T extends ArrayBufferView>(typedArray: T): T {
  return ExpoCrypto.getRandomValues(
    typedArray as unknown as Parameters<typeof ExpoCrypto.getRandomValues>[0],
  ) as unknown as T;
}

async function digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
  return ExpoCrypto.digest(normalizeDigestAlgorithm(algorithm), data);
}

function normalizeDigestAlgorithm(algorithm: AlgorithmIdentifier): ExpoCrypto.CryptoDigestAlgorithm {
  const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
  const normalized = name.toUpperCase().replace('_', '-');

  switch (normalized) {
    case 'SHA-1':
      return ExpoCrypto.CryptoDigestAlgorithm.SHA1;
    case 'SHA-256':
      return ExpoCrypto.CryptoDigestAlgorithm.SHA256;
    case 'SHA-384':
      return ExpoCrypto.CryptoDigestAlgorithm.SHA384;
    case 'SHA-512':
      return ExpoCrypto.CryptoDigestAlgorithm.SHA512;
    default:
      throw new Error(`Unsupported crypto.subtle.digest algorithm: ${name}`);
  }
}
