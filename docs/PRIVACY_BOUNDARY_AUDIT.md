# Paayee Privacy Boundary Audit

Phase 0 record for moving Paayee to app-managed confidential money rails through Klyde.

## Internal Product Note: Paayee Privacy Thesis

This section is an internal source for future user-facing privacy explanations. Keep the claims precise: Paayee protects confidential amounts, but it does not claim that every piece of transaction metadata is invisible.

- A revealed private balance, such as `$8`, is decrypted in the user's app by the Zama runtime using authorization from the signed-in Privy wallet.
- The blockchain, subgraph, indexer worker, and Paayee backend receive encrypted ciphertext handles for confidential amounts—not the decrypted `$8` value.
- After an authorized reveal, the clear balance is held only in the running app's in-memory cache. It is not persisted by the indexer or backend as the authoritative private balance.
- For a private receipt, the worker stores the encrypted transfer handle; it does not decrypt the transferred amount. When the authorized recipient opens the receipt, their app performs wallet-authorized user decryption and renders the clear amount locally.
- Paayee handles and wallet addresses are public routing and identity metadata. The backend may resolve a sender wallet address to its public Paayee handle so a receipt can say who sent it, while the confidential amount remains encrypted.
- Transaction hashes, contract addresses, status, timing, and the existence of an onchain interaction may remain observable. Paayee's privacy claim is about confidential monetary values and protected receipt payloads, not total network anonymity.

Suggested plain-language thesis for later adaptation:

> Your private amount is encrypted onchain and is revealed only in your app after your wallet authorizes it. Paayee's servers process encrypted references and transaction status, not your decrypted private balance. Public routing details, such as wallet addresses, Paayee handles, and transaction status, may still be visible.

## Decision

Paayee should use Klyde `app_managed` privacy mode. Paayee will provide its own confidential token contracts, while Klyde continues to provide sessions, wallets, provider rails, funding instructions, operation tracking, receipts, and reconciliation.

For private money flows:

- Paayee balances should be confidential token balances.
- Send, deposit credit, withdrawal debit, and conversion value movement should use FHE/confidential token operations.
- Klyde and Paayee should not persist raw confidential operation amounts, including in sandbox/local flows.
- AES-GCM may protect quickly retrievable receipt or display payloads, but not authoritative balances or values used in transfer math.

## Classification Legend

- Public operational: routing, status, reference, or non-sensitive state.
- Provider-required plaintext: fiat/bank/provider data that external providers require.
- Encrypted metadata: AES-GCM ciphertext with FHE-protected key.
- FHE/confidential amount: confidential token state, encrypted handle, proof hash, commitment, or operation reference.
- Derived display only: local UI value after user decryption or short-lived flow context.

## Paayee App Audit

| Area | Current Paayee behavior | Current classification | Target classification | Notes |
| --- | --- | --- | --- | --- |
| Home balance | `app-data` reads Klyde wallet snapshot, normalizes `displayAmount` and `numericAmount` | Plaintext/derived from Klyde ledger | Derived display only from user-decrypted confidential balance | `numericAmount` must not be treated as persisted truth in strict privacy mode. |
| Asset balances | Asset detail screens consume normalized balances | Plaintext/derived display | Derived display only | Asset display should come from confidential balance handle decryption. |
| Total balance currency | Uses Klyde valuation and display preference | Derived display | Derived display only | Rates are public, but the user balance input should be decrypted locally. |
| Recent transactions | Reads Klyde transactions/conversions and formats amount strings | Plaintext receipt/transaction amount | Encrypted metadata plus derived display only | Amount text should come from decrypted receipt envelope or local operation context. |
| Transaction detail | Displays amount, settlement amount, timeline, receipt details | Plaintext receipt display | Encrypted metadata plus derived display only | Technical hashes/status can remain public operational. |
| NGN bank funding | Shows Klyde funding instructions and simulates/creates deposit | Provider-required plaintext for provider ingress | Provider-required plaintext at ingress; NGN ledger balance until explicit conversion | NGN bank provider sees amount. Paayee should not auto-shield NGN deposits; stablecoin/private credit starts when the user explicitly converts NGN to USDC/USDT. |
| Stablecoin funding | Shows wallet funding address and QR payload | Public operational address plus plaintext balance credit today | FHE/confidential amount after direct confidential receive or shield | Funding instructions can stay public. Credited balance must become confidential token state. |
| Conversion | Uses Klyde quote/execute and displays source/target values | Plaintext quote/conversion values | FHE/confidential amount refs plus derived display | Quote display can be short-lived. Execution state should not persist raw private amounts. |
| Send to handle | Calls Klyde internal transfer today | Plaintext internal transfer amount | Confidential token transfer | Paayee handle send should become app-managed confidential transfer. |
| Send to bank | Calls Klyde withdrawal with bank destination | Provider-required plaintext at payout | Provider-required plaintext for bank payout; confidential debit before payout | Bank payout requires provider-visible amount/destination, but Paayee private balance debit should be confidential. |
| Send to wallet | Stablecoin wallet send path uses wallet destination | Plaintext withdrawal amount today | Confidential token transfer or unshield path | If sending to public wallet, explicit unshield/withdrawal semantics are needed. |
| Saved recipients | Supabase beneficiaries store handles, bank details, wallet addresses | Public operational or sensitive metadata | Public operational where needed; encrypted metadata for private snapshots | Not amount-bearing, but receipt snapshots may need encryption. |
| Limits/rates screens | Reads Klyde rates/limits | Public/compliance operational | Public/compliance operational plus derived display | Rates are public. Limits may remain compliance data but should not expose private balances. |
| Success pages | Display operation amount from route/local context | Derived display | Derived display only | This is acceptable if not persisted as authoritative Klyde state. |

## Paayee Contract Work

Paayee has its own FHEVM Hardhat contract package for app-managed confidential assets:

```text
zama/paayee/contracts
```

Initial contracts provide Paayee confidential USDC/USDT assets using ERC-7984/OpenZeppelin confidential contracts where possible. Klyde should register those assets as `app_managed`.

## Phase 2 Asset Registration

After local or Sepolia deployment, Paayee registers the deploy output with Klyde from `zama/paayee/contracts`:

```bash
KLYDE_API_URL=http://localhost:4000 \
KLYDE_APP_ID=app_paayee_local \
KLYDE_API_KEY=... \
npm run register:klyde
```

The script reads `paayee-confidential-assets.<network>.json`, calls `POST /v1/confidential-assets` for `cUSDC` and `cUSDT`, and sets each asset as:

```json
{
  "mode": "app_managed",
  "erc7984": true,
  "isDefault": true
}
```

If `KLYDE_ADMIN_TOKEN` is provided, the same script updates the Klyde app privacy config to:

```json
{
  "mode": "app_managed",
  "allowAppManagedAssets": true,
  "defaultAssets": {
    "USDC": { "chainId": 31337, "symbol": "cUSDC" },
    "USDT": { "chainId": 31337, "symbol": "cUSDT" }
  }
}
```

Without an admin token, the script prints the config so it can be applied through the Klyde dashboard/admin API.

## Phase 3 App-Managed Operation Payload

Paayee strict-private operations should send Klyde an amount reference, not raw value fields:

```json
{
  "mode": "app_managed",
  "underlyingSymbol": "USDC",
  "amountReference": {
    "encryptedAmountHandle": "0x...",
    "inputProofHash": "0x...",
    "amountCommitment": "0x...",
    "amountCiphertextRef": "vault://...",
    "metadataEnvelopeId": "env_...",
    "operationPublicLabel": "Private USDC transfer"
  }
}
```

For Paayee strict mode, do not send `amount.display` or `amount.minorUnits` to Klyde for confidential operations resolved through the app privacy config. Klyde rejects those raw fields for app-managed mode unless `debugAllowRawAmount: true` is explicitly supplied in a non-production environment.

## Phase 4 Paayee SDK Integration

Paayee stablecoin private flows now stop using normal Klyde plaintext money operations as their execution path:

- Stablecoin handle and wallet sends prepare a Klyde `app_managed` confidential operation with an `amountCommitment` and `metadataEnvelopeId`.
- Stablecoin sends no longer pass `amount.display` or `amount.minorUnits` into Klyde transfer/withdrawal APIs.
- Stablecoin success and receipt screens use the Klyde operation id/status plus an AES-GCM metadata envelope whose key is protected through the smart-account/FHE ACL transport.
- Stablecoin balance display first attempts confidential balance decryption, then falls back to a confidential balance handle. If only a handle is available, the UI masks the balance.
- Stablecoin conversion is fail-closed on the old Klyde quote/execute path until confidential conversion execution is implemented.
- Stablecoin funding still shows Klyde wallet instructions and QR payload, but no longer polls normal Klyde transactions to route a plaintext deposit amount into the success/receipt flow.

## Phase 5 Mobile Zama Runtime

Paayee now has an opt-in mobile Zama runtime for private stablecoin sends. When `EXPO_PUBLIC_ZAMA_MOBILE_RUNTIME_ENABLED=true`, the send flow:

- prepares a Klyde confidential operation without forcing mode, so Klyde resolves the active rail from the app privacy config;
- resolves the active registered confidential token address from Klyde;
- executes `confidentialTransfer` through the Zama SDK using the Paayee/Klyde smart-account signer bridge;
- reports submitted and final transaction status back to Klyde.

The runtime intentionally expects a native/smart-account transport at `globalThis.__PAAYEE_KLYDE_SMART_ACCOUNT_TRANSPORT__`. Expo must not hold a raw private key. The smart account remains the confidential token holder and the primary ACL subject. If a runtime requires delegated user decryption from an owner/session signer, that delegation should be explicit and scoped to decryption only; token ownership and transfer authority stay with the smart account.

Balance display now tries Zama SDK user decryption first and falls back to a confidential balance handle. If neither path is available, Paayee masks the value instead of reading a plaintext Klyde balance.

## Phase 5 Funding Refactor

Funding uses two clear money buckets: NGN fiat balance and private stablecoin balance:

- Stablecoin receive uses the Klyde app privacy config to choose the active confidential rail. For the current local pass, `app_paayee_local` is configured as `klyde_managed`, so public USDC/USDT wallet receive uses Klyde wallet funding instructions and QR payload, then settles through Klyde auto-shield into Klyde-managed `cUSDC`/`cUSDT`.
- Paayee app-managed `cUSDC`/`cUSDT` assets are still registered in Klyde, but they are non-default until Paayee is ready to route funding, indexing, and shielding through its own public-token/confidential-token pair.
- Stablecoin receive can later become direct confidential receive when the sender already supports the active confidential token.
- NGN bank transfer remains provider-visible. Klyde verifies/reconciles the bank payment and credits the user's Klyde NGN ledger balance. It does not auto-shield NGN deposits into cUSDC/cUSDT.
- NGN-to-USDC/USDT conversion is the explicit moment where Klyde treasury settles the fiat value into stablecoin and the result can be shielded into the active confidential stablecoin.
- Paayee success copy frames simulated/verified NGN funding as an NGN deposit with a normal Klyde receipt.
- When mobile Zama runtime is enabled, USDC/USDT balances come from confidential token decryption, while NGN remains the Klyde fiat ledger balance hidden/revealed by the same UI privacy toggle.

Klyde provider/settlement records may still contain provider-required plaintext values, but Paayee private balances should come from user-decrypted confidential token state or masked confidential handles.

## Phase 6 Conversion Refactor

Private stablecoin conversion now follows the same app-managed privacy boundary:

- USDC/USDT conversion quotes can be shown locally as estimated plaintext so the user can review the trade.
- Confirming a private stablecoin conversion creates a Klyde confidential operation with source/target amount commitments and a metadata envelope id, resolved through the app privacy config, not a raw Klyde conversion.
- Paayee keeps the display envelope locally on the device. Klyde stores operation id/status and privacy-safe references only.
- Settlement belongs to Paayee's confidential conversion executor, where source `cUSDC/cUSDT` is privately debited, locked, or burned and target `cUSDC/cUSDT` is privately minted or credited.
- NGN conversion into confidential stablecoin is an explicit user action: debit Klyde NGN ledger, settle through treasury into USDC/USDT, then shield the result into the active cUSDC/cUSDT balance.
- Cross-bucket conversion (`NGN -> cUSDC/cUSDT` or `cUSDC/cUSDT -> NGN`) is prepared as a confidential settlement operation with encrypted receipt metadata. Final NGN ledger credit/debit must wait for the confidential settlement executor and proof/transaction callback; Paayee must not fake ledger movement from a prepared operation alone.

## Phase 7 Encrypted Receipts And Metadata

Paayee private receipt/timeline display payloads now use AES-GCM metadata envelopes:

```json
{
  "ciphertext": "...",
  "iv": "...",
  "authTag": "...",
  "keyHandle": "...",
  "aclPolicy": {},
  "schemaVersion": "paayee.private-receipt.v1"
}
```

- Private send and private conversion amount/recipient/display fields are encrypted before the Klyde confidential operation is prepared.
- Klyde receives the encrypted envelope in `amountReference.metadataEnvelope` and stores operation status plus privacy-safe references only.
- The Paayee app decrypts the envelope when the success/receipt screen opens.
- `keyHandle` is designed for FHE ACL-protected AES keys owned by the user's smart account. Local and sandbox builds must still use the same key-protection transport; local Hardhat may use the Zama SDK cleartext relayer, but Paayee must not store raw AES keys as a fallback.

## Phase 8 UI Data Source Switch

Paayee's mobile UI mostly stays the same, but private surfaces now prefer confidential data sources:

- USDC/USDT balances no longer inherit Klyde plaintext wallet balances. They show a user-decrypted confidential value when available, or a masked confidential handle/status when not.
- Masked confidential balances are not treated as spendable in send/convert forms. The user must decrypt the private balance before spending from it.
- Pending private send/conversion operations appear in recent activity with status and operation routing only; activity rows show `Private amount` until the encrypted receipt payload is opened/decrypted.
- Success pages may show the just-confirmed amount from local operation context immediately. The durable receipt view still reads from the encrypted metadata envelope.
- Legacy Klyde stablecoin conversion rows are masked in Paayee transaction lists/details so old plaintext records do not masquerade as private receipts.

## Immediate Paayee Refactor Targets

1. Add Paayee confidential contracts and deployment metadata. Done in `zama/paayee/contracts`.
2. Register Paayee confidential assets through Klyde `app_managed` asset APIs. Scripted in `zama/paayee/contracts`.
3. Send confidential operation amount references instead of raw amounts, with mode resolved from Klyde app privacy config. Klyde Phase 3 hardening is in place.
4. Replace stablecoin balance reads with confidential balance handle/decryption flow. Initial app integration is in place.
5. Replace handle send with config-resolved confidential operation preparation and opt-in mobile Zama execution. The native smart-account transport still must be configured per mobile environment.
6. Convert stablecoin funding into direct confidential receive or shield from public token into Paayee confidential token. Initial app/Klyde flow is in place.
7. Treat NGN funding as provider ingress followed by Klyde NGN ledger credit. Confidential token credit only starts after explicit NGN-to-USDC/USDT conversion.
8. Move receipt amount display toward encrypted metadata envelopes or local user-decrypted display. Stablecoin send and private conversion receipts now use AES-GCM envelopes with smart-account/FHE ACL key handles.

## Non-Goals For Phase 0

- No contract or database migration is implemented in this phase.
- No UI flow is switched in this phase.
- No provider rail behavior is changed in this phase.

This document is the baseline checklist for the implementation phases that follow.
