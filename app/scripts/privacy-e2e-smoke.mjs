import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const APP_ID = 'app_paayee_local';
const CHAIN_ID = 31337;
const USER_ID = 'usr_paayee_privacy_e2e';
const SMART_ACCOUNT = '0x1111111111111111111111111111111111111111';
const OWNER_SIGNER = '0x2222222222222222222222222222222222222222';
const RECIPIENT_ACCOUNT = '0x3333333333333333333333333333333333333333';
const C_USDC = '0x4444444444444444444444444444444444444444';
const C_USDT = '0x5555555555555555555555555555555555555555';

const sensitivePlaintextNeedles = [
  '25.75',
  '42.50',
  '100000',
  '50000000',
  '25750000',
  '42500000',
];

const assets = {
  USDC: {
    address: C_USDC,
    chainId: CHAIN_ID,
    decimals: 6,
    mode: 'app_managed',
    symbol: 'cUSDC',
    underlyingSymbol: 'USDC',
  },
  USDT: {
    address: C_USDT,
    chainId: CHAIN_ID,
    decimals: 6,
    mode: 'app_managed',
    symbol: 'cUSDT',
    underlyingSymbol: 'USDT',
  },
};

class FakeSmartAccountTransport {
  constructor() {
    this.keyStore = new Map();
    this.submissions = [];
  }

  async getAddress() {
    return SMART_ACCOUNT;
  }

  async getChainId() {
    return CHAIN_ID;
  }

  async signTypedData(typedData) {
    assert.ok(typedData, 'typed data is required for decrypt permits');
    return toHex(`signature:${SMART_ACCOUNT}`);
  }

  async writeContract(config) {
    assert.equal(config.account ?? SMART_ACCOUNT, SMART_ACCOUNT);
    assert.match(config.address, /^0x[0-9a-fA-F]{40}$/);
    assert.ok(['confidentialTransfer', 'shield', 'mintEncrypted', 'burnEncrypted'].includes(config.functionName));

    const transactionHash = toHex(`tx:${config.address}:${config.functionName}:${this.submissions.length}`);
    this.submissions.push({
      config,
      submittedThroughSmartAccount: true,
      transactionHash,
    });

    return transactionHash;
  }

  async waitForTransactionReceipt(hash) {
    assert.match(hash, /^0x[0-9a-f]+$/);
    return {
      blockNumber: 1n,
      status: 'success',
      transactionHash: hash,
    };
  }

  async protectMetadataKey(input) {
    assert.equal(input.aclPolicy.mode, 'fhe_acl');
    assert.equal(input.aclPolicy.ownerAddress, SMART_ACCOUNT.toLowerCase());
    assert.ok(input.aclPolicy.allowedAddresses.includes(OWNER_SIGNER.toLowerCase()));

    const keyHandle = `fhe:${sha256(`${input.keyBase64}:${input.operationId ?? ''}:${input.aclPolicy.ownerAddress}`)}`;
    this.keyStore.set(keyHandle, input.keyBase64);
    return {
      aclPolicy: input.aclPolicy,
      keyHandle,
    };
  }

  async unprotectMetadataKey(input) {
    assert.equal(input.aclPolicy.mode, 'fhe_acl');
    return this.keyStore.get(input.keyHandle);
  }

  async executeConfidentialConversion(input) {
    assert.equal(input.sourceTokenAddress, C_USDC);
    assert.equal(input.targetTokenAddress, C_USDT);
    const transactionHash = await this.writeContract({
      address: input.sourceTokenAddress,
      args: [input.targetTokenAddress, input.sourceAmountMinorUnits, input.targetAmountMinorUnits],
      functionName: 'burnEncrypted',
    });
    return {
      receipt: await this.waitForTransactionReceipt(transactionHash),
      transactionHash,
      userOperationHash: toHex(`uo:${input.operationId}`),
    };
  }
}

class FakeKlydePrivacyLedger {
  constructor() {
    this.operations = [];
    this.events = [];
  }

  registerAsset(input) {
    assert.equal(input.appId, APP_ID);
    assert.equal(input.mode, 'app_managed');
    assert.match(input.symbol, /^cUSD[CT]$/);
    assert.ok(['USDC', 'USDT'].includes(input.underlyingSymbol));
    return input;
  }

  prepareAppManagedConfidentialOperation(input) {
    assert.equal(input.appId, APP_ID);
    assert.equal(input.userId, USER_ID);
    assert.equal(input.mode, 'app_managed');
    assert.equal(input.kind, 'app_managed');
    assert.ok(input.amountReference, 'app-managed operations require privacy-safe amount reference');
    assert.ok(
      input.amountReference.encryptedAmountHandle ||
        input.amountReference.inputProofHash ||
        input.amountReference.amountCommitment ||
        input.amountReference.amountCiphertextRef ||
        input.amountReference.metadataEnvelopeId ||
        input.amountReference.metadataEnvelope,
      'amount reference must contain a privacy-safe handle, proof, commitment, ciphertext reference, or envelope',
    );
    assert.equal(input.amount, undefined, 'Klyde must not store raw app-managed amount');
    assertNoRawPrivateAmount(input.amountReference, sensitivePlaintextNeedles);
    assertNoRawPrivateAmount(input.metadata, sensitivePlaintextNeedles);
    assertEncryptedEnvelope(input.amountReference.metadataEnvelope);

    const operation = {
      ...input,
      assetAddress: assets[input.underlyingSymbol].address,
      id: `op_${String(this.operations.length + 1).padStart(4, '0')}`,
      status: 'prepared',
    };
    this.operations.push(operation);
    this.events.push({ operationId: operation.id, type: 'privacy.operation.prepared' });
    return operation;
  }

  markSubmitted(operationId, input) {
    const operation = this.requireOperation(operationId);
    assert.equal(operation.status, 'prepared');
    assert.match(input.transactionHash ?? input.userOperationHash, /^0x[0-9a-f]+$/);
    operation.status = 'submitted';
    operation.transactionHash = input.transactionHash;
    operation.userOperationHash = input.userOperationHash;
    this.events.push({ operationId, type: 'privacy.operation.submitted' });
    return operation;
  }

  complete(operationId, input) {
    const operation = this.requireOperation(operationId);
    assert.equal(operation.status, 'submitted');
    assert.ok(['succeeded', 'failed'].includes(input.status));
    operation.status = input.status;
    operation.failureReason = input.failureReason;
    this.events.push({
      operationId,
      type: input.status === 'succeeded' ? 'privacy.operation.succeeded' : 'privacy.operation.failed',
    });
    return operation;
  }

  requireOperation(operationId) {
    const operation = this.operations.find((candidate) => candidate.id === operationId);
    assert.ok(operation, `missing operation ${operationId}`);
    return operation;
  }
}

async function main() {
  const transport = new FakeSmartAccountTransport();
  const klyde = new FakeKlydePrivacyLedger();

  Object.values(assets).forEach((asset) => {
    klyde.registerAsset({
      ...asset,
      appId: APP_ID,
      isDefault: true,
    });
  });

  await testStablecoinDepositShielding({ klyde, transport });
  await testNgnFundingSettlementToConfidentialCredit({ klyde, transport });
  await testStablecoinPrivateSend({ klyde, transport });
  await testConfidentialConversion({ klyde, transport });
  await testEncryptedReceiptAndPendingUi({ klyde, transport });
  await testSmartAccountSignerRequirements({ transport });
  testAclDecisionIsExplicit();

  assert.equal(klyde.operations.length, 4);
  assert.deepEqual(
    klyde.events.map((event) => event.type),
    [
      'privacy.operation.prepared',
      'privacy.operation.submitted',
      'privacy.operation.succeeded',
      'privacy.operation.prepared',
      'privacy.operation.prepared',
      'privacy.operation.submitted',
      'privacy.operation.succeeded',
      'privacy.operation.prepared',
      'privacy.operation.submitted',
      'privacy.operation.succeeded',
    ],
  );

  console.log('privacy-e2e-smoke: passed 7 Paayee/Klyde privacy scenarios');
  console.log('privacy-e2e-smoke: live-stack follow-up still required for Zama EIP-1271 user-decrypt support');
}

async function testStablecoinDepositShielding({ klyde, transport }) {
  const publicFunding = {
    amountMinorUnits: '50000000',
    asset: 'USDC',
    fromAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    providerVisible: true,
    rail: 'public_usdc_transfer',
  };
  const amountReference = await createAmountReference({
    metadataEnvelopeId: 'env_stablecoin_deposit_001',
    operationId: 'stablecoin_deposit',
    payload: {
      asset: 'USDC',
      displayAmount: '50.00 USDC',
      fundingRail: publicFunding.rail,
      source: publicFunding.fromAddress,
    },
    purpose: 'private_stablecoin_deposit_receipt',
    transport,
  });
  const operation = klyde.prepareAppManagedConfidentialOperation({
    appId: APP_ID,
    chainId: CHAIN_ID,
    fundingId: 'funding_public_usdc_001',
    kind: 'app_managed',
    metadata: {
      amountStorage: 'amount_reference_only',
      paayeePrivacyFlow: 'stablecoin_public_receive_shield',
      sourceRail: publicFunding.rail,
    },
    mode: 'app_managed',
    amountReference,
    toAddress: SMART_ACCOUNT,
    underlyingSymbol: 'USDC',
    userId: USER_ID,
  });

  const txHash = await transport.writeContract({
    address: C_USDC,
    args: [publicFunding.amountMinorUnits],
    functionName: 'shield',
  });
  klyde.markSubmitted(operation.id, { transactionHash: txHash });
  klyde.complete(operation.id, { status: 'succeeded' });
}

async function testNgnFundingSettlementToConfidentialCredit({ klyde, transport }) {
  const providerSettlement = {
    amountMinorUnits: '100000',
    currency: 'NGN',
    providerVisible: true,
    settlementAsset: 'USDC',
    settlementReference: 'paystack_transfer_001',
  };
  const amountReference = await createAmountReference({
    metadataEnvelopeId: 'env_ngn_settlement_001',
    operationId: 'ngn_settlement',
    payload: {
      displayAmount: '100,000 NGN',
      settlementAsset: providerSettlement.settlementAsset,
      settlementReference: providerSettlement.settlementReference,
    },
    purpose: 'private_ngn_settlement_receipt',
    transport,
  });
  klyde.prepareAppManagedConfidentialOperation({
    appId: APP_ID,
    chainId: CHAIN_ID,
    fundingId: 'funding_ngn_bank_001',
    kind: 'app_managed',
    metadata: {
      amountStorage: 'amount_reference_only',
      paayeePrivacyFlow: 'ngn_provider_settlement_confidential_credit',
      providerSettlementReference: providerSettlement.settlementReference,
      sourceCurrency: 'NGN',
      targetUnderlyingSymbol: 'USDC',
    },
    mode: 'app_managed',
    amountReference,
    toAddress: SMART_ACCOUNT,
    underlyingSymbol: 'USDC',
    userId: USER_ID,
  });

  assert.equal(providerSettlement.providerVisible, true);
}

async function testStablecoinPrivateSend({ klyde, transport }) {
  const amountReference = await createAmountReference({
    metadataEnvelopeId: 'env_send_usdc_001',
    operationId: 'send_usdc',
    payload: {
      asset: 'USDC',
      displayAmount: '42.50 USDC',
      recipient: RECIPIENT_ACCOUNT,
    },
    purpose: 'private_send_receipt',
    transport,
  });
  const operation = klyde.prepareAppManagedConfidentialOperation({
    appId: APP_ID,
    chainId: CHAIN_ID,
    fromAddress: SMART_ACCOUNT,
    kind: 'app_managed',
    metadata: {
      amountStorage: 'amount_reference_only',
      paayeePrivacyFlow: 'stablecoin_private_send',
    },
    mode: 'app_managed',
    amountReference,
    toAddress: RECIPIENT_ACCOUNT,
    underlyingSymbol: 'USDC',
    userId: USER_ID,
  });

  const txHash = await transport.writeContract({
    account: SMART_ACCOUNT,
    address: C_USDC,
    args: [RECIPIENT_ACCOUNT, amountReference.amountCiphertextRef],
    functionName: 'confidentialTransfer',
  });
  const submitted = klyde.markSubmitted(operation.id, {
    transactionHash: txHash,
    userOperationHash: toHex(`uo:${operation.id}`),
  });
  const completed = klyde.complete(operation.id, { status: 'succeeded' });

  assert.equal(submitted.fromAddress, SMART_ACCOUNT);
  assert.equal(completed.status, 'succeeded');
  assert.equal(transport.submissions.at(-1).submittedThroughSmartAccount, true);
}

async function testConfidentialConversion({ klyde, transport }) {
  const amountReference = await createAmountReference({
    metadataEnvelopeId: 'env_convert_001',
    operationId: 'convert_usdc_usdt',
    payload: {
      rateLabel: 'estimated locally',
      sourceDisplayAmount: '25.75 USDC',
      targetDisplayAmount: '25.73 USDT',
    },
    purpose: 'private_conversion_receipt',
    transport,
  });
  const operation = klyde.prepareAppManagedConfidentialOperation({
    appId: APP_ID,
    chainId: CHAIN_ID,
    fromAddress: SMART_ACCOUNT,
    kind: 'app_managed',
    metadata: {
      amountStorage: 'amount_reference_only',
      conversionExecution: 'paayee_confidential_conversion_executor',
      paayeePrivacyFlow: 'stablecoin_private_conversion',
      sourceAmountCommitment: amountReference.amountCommitment,
      sourceUnderlyingSymbol: 'USDC',
      targetUnderlyingSymbol: 'USDT',
    },
    mode: 'app_managed',
    amountReference,
    toAddress: SMART_ACCOUNT,
    underlyingSymbol: 'USDT',
    userId: USER_ID,
  });
  const execution = await transport.executeConfidentialConversion({
    operationId: operation.id,
    sourceAmountMinorUnits: '25750000',
    sourceTokenAddress: C_USDC,
    targetAmountMinorUnits: '25730000',
    targetTokenAddress: C_USDT,
  });

  klyde.markSubmitted(operation.id, execution);
  klyde.complete(operation.id, { status: 'succeeded' });
}

async function testEncryptedReceiptAndPendingUi({ klyde, transport }) {
  const operation = klyde.operations.find((candidate) => candidate.amountReference.metadataEnvelopeId === 'env_send_usdc_001');
  assert.ok(operation);

  const pendingUiRow = {
    amountLabel: 'Private amount',
    id: operation.id,
    status: operation.status,
    title: operation.amountReference.operationPublicLabel,
  };
  assert.equal(pendingUiRow.amountLabel, 'Private amount');
  assertNoRawPrivateAmount(pendingUiRow, sensitivePlaintextNeedles);

  const decrypted = await decryptEnvelope(operation.amountReference.metadataEnvelope, transport);
  assert.equal(decrypted.displayAmount, '42.50 USDC');
  assert.equal(decrypted.recipient, RECIPIENT_ACCOUNT);
  assertNoRawPrivateAmount(
    {
      authTag: operation.amountReference.metadataEnvelope.authTag,
      ciphertext: operation.amountReference.metadataEnvelope.ciphertext,
      iv: operation.amountReference.metadataEnvelope.iv,
      keyHandle: operation.amountReference.metadataEnvelope.keyHandle,
    },
    ['42.50', '42500000', RECIPIENT_ACCOUNT],
  );
}

async function testSmartAccountSignerRequirements({ transport }) {
  assert.equal(typeof transport.signTypedData, 'function');
  assert.equal(typeof transport.writeContract, 'function');
  assert.equal(typeof transport.waitForTransactionReceipt, 'function');
  assert.equal(typeof transport.protectMetadataKey, 'function');
  assert.equal(typeof transport.unprotectMetadataKey, 'function');

  const signature = await transport.signTypedData({ domain: {}, message: {}, primaryType: 'Permit', types: {} });
  assert.match(signature, /^0x[0-9a-f]+$/);
}

function testAclDecisionIsExplicit() {
  const aclPolicy = createAclPolicy('acl_decision');
  assert.equal(aclPolicy.ownerAddress, SMART_ACCOUNT.toLowerCase());
  assert.ok(aclPolicy.allowedAddresses.includes(OWNER_SIGNER.toLowerCase()));
  assert.equal(aclPolicy.requiresEip1271Verification, true);
}

async function createAmountReference(input) {
  const envelope = await encryptEnvelope({
    operationId: input.operationId,
    payload: input.payload,
    purpose: input.purpose,
    transport: input.transport,
  });
  return {
    amountCiphertextRef: `ciphertext:${sha256(JSON.stringify(input.payload))}`,
    amountCommitment: `commitment:${sha256(`${input.metadataEnvelopeId}:${input.operationId}`)}`,
    inputProofHash: `proof:${sha256(input.operationId)}`,
    metadataEnvelope: envelope,
    metadataEnvelopeId: input.metadataEnvelopeId,
    operationPublicLabel: input.purpose.replaceAll('_', ' '),
  };
}

async function encryptEnvelope(input) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const aclPolicy = createAclPolicy(input.purpose);
  const aad = additionalData({ operationId: input.operationId, purpose: input.purpose });
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(input.payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const protectedKey = await input.transport.protectMetadataKey({
    aclPolicy,
    keyBase64: key.toString('base64'),
    operationId: input.operationId,
  });

  return {
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    keyHandle: protectedKey.keyHandle,
    aclPolicy: protectedKey.aclPolicy,
    schemaVersion: 'paayee.metadata-envelope.v1',
  };
}

async function decryptEnvelope(envelope, transport) {
  const keyBase64 = await transport.unprotectMetadataKey({
    aclPolicy: envelope.aclPolicy,
    keyHandle: envelope.keyHandle,
  });
  assert.ok(keyBase64, 'metadata key should be available through FHE ACL handle');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyBase64, 'base64'), Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(additionalData({ operationId: 'send_usdc', purpose: envelope.aclPolicy.purpose }));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8'));
}

function createAclPolicy(purpose) {
  return {
    allowedAddresses: [OWNER_SIGNER.toLowerCase()],
    chainId: CHAIN_ID,
    keyContractAddress: '0x6666666666666666666666666666666666666666',
    mode: 'fhe_acl',
    ownerAddress: SMART_ACCOUNT.toLowerCase(),
    purpose,
    requiresEip1271Verification: true,
  };
}

function assertEncryptedEnvelope(envelope) {
  assert.ok(envelope, 'metadata envelope is required');
  assert.equal(envelope.schemaVersion, 'paayee.metadata-envelope.v1');
  assert.equal(envelope.aclPolicy.mode, 'fhe_acl');
  assert.equal(envelope.aclPolicy.ownerAddress, SMART_ACCOUNT.toLowerCase());
  assert.match(envelope.keyHandle, /^fhe:/);
  assert.ok(envelope.ciphertext.length > 12);
  assert.ok(envelope.iv.length > 12);
  assert.ok(envelope.authTag.length > 12);
}

function assertNoRawPrivateAmount(value, needles) {
  const serialized = JSON.stringify(value);
  for (const needle of needles) {
    assert.equal(
      serialized.includes(needle),
      false,
      `private storage leaked raw sensitive value ${needle}`,
    );
  }
}

function additionalData(input) {
  return Buffer.from(JSON.stringify({
    operationId: input.operationId,
    purpose: input.purpose,
    schemaVersion: 'paayee.metadata-envelope.v1',
  }));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function toHex(value) {
  return `0x${Buffer.from(value).toString('hex')}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
