import * as Crypto from 'expo-crypto';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';

import {
  protectPaayeeMetadataKey,
  unprotectPaayeeMetadataKey,
  type PaayeeMetadataAclPolicy,
} from './zama-mobile-runtime';

export type EncryptedMetadataEnvelope = {
  authTag: string;
  ciphertext: string;
  iv: string;
  keyHandle: string;
  aclPolicy: PaayeeMetadataAclPolicy;
  schemaVersion: string;
};

export type EncryptMetadataEnvelopeInput<TPayload> = {
  aclPolicy: Omit<PaayeeMetadataAclPolicy, 'mode'> & {
    mode?: PaayeeMetadataAclPolicy['mode'];
  };
  operationId?: string;
  payload: TPayload;
  schemaVersion?: string;
};

const defaultSchemaVersion = 'paayee.metadata-envelope.v1';

export async function encryptMetadataEnvelope<TPayload>(
  input: EncryptMetadataEnvelopeInput<TPayload>,
): Promise<EncryptedMetadataEnvelope> {
  const key = await AESEncryptionKey.generate();
  const keyBase64 = await key.encoded('base64');
  const schemaVersion = input.schemaVersion ?? defaultSchemaVersion;
  const aclPolicy = normalizeAclPolicy(input.aclPolicy);
  const additionalData = encodeJson({
    operationId: input.operationId,
    schemaVersion,
    purpose: aclPolicy.purpose,
  });
  const sealed = await aesEncryptAsync(encodeJson(input.payload), key, {
    additionalData,
    nonce: { bytes: Crypto.getRandomBytes(12) },
    tagLength: 16,
  });
  const protectedKey = await protectPaayeeMetadataKey({
    aclPolicy,
    keyBase64,
    operationId: input.operationId,
  });

  // Expo's native base64 accessor has returned an empty value on Hermes for
  // some AES-GCM payloads. Read the bytes and encode them ourselves so a
  // receipt can never be persisted without its encrypted body.
  const [authTagBytes, ciphertextBytes, ivBytes] = await Promise.all([
    sealed.tag(),
    sealed.ciphertext({ includeTag: false }),
    sealed.iv(),
  ]);
  const authTag = encodeBase64(authTagBytes);
  const ciphertext = encodeBase64(ciphertextBytes);
  const iv = encodeBase64(ivBytes);

  requireBase64Part(authTag, 'authTag');
  requireBase64Part(ciphertext, 'ciphertext');
  requireBase64Part(iv, 'iv');

  return {
    authTag,
    ciphertext,
    iv,
    keyHandle: protectedKey.keyHandle,
    aclPolicy: protectedKey.aclPolicy,
    schemaVersion,
  };
}

export async function decryptMetadataEnvelope<TPayload>(
  envelope: EncryptedMetadataEnvelope,
  input: { operationId?: string } = {},
): Promise<TPayload> {
  const keyBase64 = await unprotectPaayeeMetadataKey({
    aclPolicy: envelope.aclPolicy,
    keyHandle: envelope.keyHandle,
  });

  const key = await AESEncryptionKey.import(keyBase64, 'base64');
  const sealed = AESSealedData.fromParts(
    requireBase64Part(envelope.iv, 'iv'),
    requireBase64Part(envelope.ciphertext, 'ciphertext'),
    requireBase64Part(envelope.authTag, 'authTag'),
  );
  const decrypted = await aesDecryptAsync(sealed, key, {
    additionalData: encodeJson({
      operationId: input.operationId,
      schemaVersion: envelope.schemaVersion,
      purpose: envelope.aclPolicy.purpose,
    }),
  });

  return JSON.parse(decodeBytes(decrypted)) as TPayload;
}

function normalizeAclPolicy(
  aclPolicy: EncryptMetadataEnvelopeInput<unknown>['aclPolicy'],
): PaayeeMetadataAclPolicy {
  return {
    ...aclPolicy,
    allowedAddresses: aclPolicy.allowedAddresses?.map((address) => address.toLowerCase()),
    mode: aclPolicy.mode ?? 'fhe_acl',
    ownerAddress: aclPolicy.ownerAddress.toLowerCase(),
  };
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeBytes(value: string | Uint8Array): string {
  if (typeof value === 'string') {
    return value;
  }

  return new TextDecoder().decode(value);
}

function requireBase64Part(value: unknown, name: keyof EncryptedMetadataEnvelope): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Encrypted metadata envelope is missing ${name}.`);
  }

  return value;
}

function encodeBase64(value: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';

  for (let index = 0; index < value.length; index += 3) {
    const first = value[index] ?? 0;
    const second = value[index + 1] ?? 0;
    const third = value[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;

    encoded += alphabet[(combined >> 18) & 63];
    encoded += alphabet[(combined >> 12) & 63];
    encoded += index + 1 < value.length ? alphabet[(combined >> 6) & 63] : '=';
    encoded += index + 2 < value.length ? alphabet[combined & 63] : '=';
  }

  return encoded;
}
