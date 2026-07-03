import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PIN_VERIFIER_KEY = 'paayee_pin_verifier_v1';
const PIN_CREATED_KEY = 'paayee_pin_created';
const PIN_ATTEMPTS_KEY = 'paayee_pin_attempts_v1';
const PIN_LOCK_UNTIL_KEY = 'paayee_pin_locked_until_v1';
const PIN_LENGTH = 4;
const HASH_ROUNDS = 2500;
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000;

type StoredPinVerifier = {
  algorithm: 'sha256-iterated';
  rounds: number;
  salt: string;
  verifier: string;
};

function assertValidPin(pin: string) {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    throw new Error(`PIN must be ${PIN_LENGTH} digits.`);
  }
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

async function randomSalt() {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return toHex(bytes);
}

async function derivePinVerifier(pin: string, salt: string, rounds = HASH_ROUNDS) {
  let hash = await sha256Hex(`${salt}:${pin}:paayee`);

  for (let index = 1; index < rounds; index += 1) {
    hash = await sha256Hex(`${hash}:${salt}:${pin}`);
  }

  return hash;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

async function resetPinAttempts() {
  await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
  await SecureStore.deleteItemAsync(PIN_LOCK_UNTIL_KEY);
}

async function recordFailedAttempt() {
  const attempts = Number(await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY)) || 0;
  const nextAttempts = attempts + 1;

  await SecureStore.setItemAsync(PIN_ATTEMPTS_KEY, String(nextAttempts));

  if (nextAttempts >= MAX_ATTEMPTS) {
    await SecureStore.setItemAsync(PIN_LOCK_UNTIL_KEY, String(Date.now() + LOCK_DURATION_MS));
    await SecureStore.setItemAsync(PIN_ATTEMPTS_KEY, '0');
  }
}

export async function storePinVerifier(pin: string) {
  assertValidPin(pin);

  const salt = await randomSalt();
  const verifier = await derivePinVerifier(pin, salt);
  const payload: StoredPinVerifier = {
    algorithm: 'sha256-iterated',
    rounds: HASH_ROUNDS,
    salt,
    verifier,
  };

  await SecureStore.setItemAsync(PIN_VERIFIER_KEY, JSON.stringify(payload));
  await SecureStore.setItemAsync(PIN_CREATED_KEY, 'true');
  await resetPinAttempts();
}

export async function hasPinVerifier() {
  return Boolean(await SecureStore.getItemAsync(PIN_VERIFIER_KEY));
}

export async function verifyPin(pin: string) {
  assertValidPin(pin);

  const lockedUntil = Number(await SecureStore.getItemAsync(PIN_LOCK_UNTIL_KEY)) || 0;
  if (lockedUntil > Date.now()) {
    const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    throw new Error(`Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const stored = await SecureStore.getItemAsync(PIN_VERIFIER_KEY);
  if (!stored) {
    throw new Error('No PIN has been set on this device.');
  }

  const payload = JSON.parse(stored) as StoredPinVerifier;
  const verifier = await derivePinVerifier(pin, payload.salt, payload.rounds);
  const matches = constantTimeEqual(verifier, payload.verifier);

  if (!matches) {
    await recordFailedAttempt();
    return false;
  }

  await resetPinAttempts();
  return true;
}

export async function clearPinVerifier() {
  await SecureStore.deleteItemAsync(PIN_VERIFIER_KEY);
  await SecureStore.deleteItemAsync(PIN_CREATED_KEY);
  await resetPinAttempts();
}
