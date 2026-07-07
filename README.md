# Paayee

Paayee is a private money app for NGN, USDC, and USDT. It gives users a familiar mobile-wallet experience while moving sensitive stablecoin balances and private payment metadata behind confidential rails powered by Klyde and Zama.

The product goal is simple: private payments should feel like normal payments.

## What Paayee Does

- Lets users hold an NGN wallet balance for local transfers, bank withdrawals, and everyday money movement.
- Lets users hold private stablecoin balances as cUSDC and cUSDT.
- Lets users add public USDC/USDT and shield it into confidential balances.
- Lets users send to Paayee handles, bank accounts, and stablecoin wallets.
- Keeps sensitive stablecoin amounts out of plaintext app storage.
- Shows private balances only after user-controlled reveal/decryption.
- Uses encrypted receipt metadata so transaction history can stay useful without leaking every numeric detail by default.

## How Klyde Fits In

Klyde is the money infrastructure layer under Paayee.

Paayee owns the mobile product, user experience, and Zama-facing confidential execution. Klyde owns the infrastructure brain:

- app identity and API-key scoping
- user and session resolution
- embedded wallet and smart-account records
- registered confidential assets
- funding instructions and settlement references
- operation status, receipts, reconciliation, and worker jobs
- stablecoin deposit monitoring
- Klyde-managed cUSDC/cUSDT rails for the first production phase

## Money Model

Paayee uses two money buckets.

`NGN balance`

- Klyde ledger balance.
- Backed by bank/payment-provider settlement.
- Used for NGN handle sends, bank withdrawals, and local wallet flows.
- Not automatically shielded into stablecoin.

`Private stablecoin balance`

- cUSDC/cUSDT on the Zama confidential token rail.
- Funded by public USDC/USDT deposits or explicit conversion.
- Used for private stablecoin sends and on-chain private settlement.
- Decrypted only when the user reveals it in the app.

This avoids mixing fiat-wallet behavior with private stablecoin behavior. NGN stays NGN until the user chooses an operation that needs stablecoin privacy.

## Current Rail Strategy

Paayee currently uses Klyde-managed confidential assets as the active production rail:

- Klyde-managed cUSDC/cUSDT are the default assets for balances, stablecoin deposits, auto-shielding, and private stablecoin sends.
- Paayee app-managed cUSDC/cUSDT can be registered as non-default assets for future app-owned rail experiments.
- This keeps phase one simpler: one active stablecoin rail, one indexer path, one reconciliation path.

## Core Flows

### Add Money

`NGN bank transfer`

The user receives bank-transfer instructions, the payment provider confirms settlement, and Klyde credits the NGN ledger balance.

`USDC/USDT deposit`

The user sends public USDC/USDT to their Paayee/Klyde wallet. Klyde detects the transfer and the private rail shields it into cUSDC/cUSDT.

`Conversion`

NGN to stablecoin and stablecoin to NGN are explicit conversion flows. NGN is not auto-shielded just because it was deposited.

### Send Money

`Paayee handle`

NGN sends can move through the Klyde ledger. Stablecoin sends use confidential token execution.

`Bank account`

NGN is debited from the Klyde ledger and paid out through the configured provider.

`Stablecoin wallet`

USDC/USDT sends resolve to confidential stablecoin operations and settle to the target wallet through the active Zama/Klyde rail.

## Privacy Boundary

Paayee should not treat normal public receipts as private.

Public deposit details, such as the public USDC amount received, are ingress facts. The private balance begins after shielding into cUSDC/cUSDT.

Private operation metadata is encrypted before storage. Klyde can store operation references, status, asset identifiers, receipt ids, and reconciliation metadata, but sensitive numeric details should either be confidential token state or encrypted metadata.

## Repository Layout

- `app/` - Expo mobile app.
- `contracts/` - Paayee confidential asset deployment and registration scripts.
- `docs/` - privacy and architecture notes.
- `supabase/` - Paayee host-side functions and auth integration.

## Local Development

Install from the app folder:

```bash
cd app
npm install
npx expo start
```

Deploy Paayee contracts:

```bash
cd contracts
npm run deploy:localhost
npm run register:klyde
```

For full local privacy testing, Klyde must be running with Hardhat, Postgres, Redis, API, worker, and the local indexer configured.

## Production Notes

Before public release:

- rotate all leaked development secrets and API keys
- configure a real payment provider for NGN deposits and withdrawals
- configure real Sepolia/Mainnet RPC and Zama relayer values
- confirm Klyde API and worker are using the same database, Redis, and chain config
- verify confidential asset registrations for the active app id
- run an end-to-end add-money and send-money test on the active rail

## Status

Paayee is in active build toward a production test release. The product shell, Klyde integration, confidential balance reveal, stablecoin funding path, receipt model, and SDK publishing path are in place.

Current route status:

| Area      | Route                         | Status                                                                                                                                              |
| --------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add money | NGN bank transfer             | Product flow is implemented. Live settlement needs the configured payment provider webhook/payout rail.                                             |
| Add money | Public USDC/USDT deposit      | Implemented on Klyde-managed rails. Live auto-shield depends on worker execution config.                                                            |
| Add money | NGN to cUSDC/cUSDT conversion | UI and Klyde settlement shape are implemented. Treasury private-credit execution is the remaining production step.                                  |
| Add money | cUSDC/cUSDT to NGN conversion | Product flow is implemented. Production-grade settlement should privately transfer/debit stablecoin into Klyde settlement before NGN ledger credit. |
| Send      | NGN to Paayee handle          | Implemented through Klyde ledger transfer.                                                                                                          |
| Send      | NGN to bank                   | Product flow is implemented. Real payout depends on provider integration.                                                                           |
| Send      | USDC/USDT to Paayee handle    | Uses the confidential stablecoin send path. Requires live Zama + smart-account execution.                                                           |
| Send      | USDC/USDT to external wallet  | Route and destination wiring are implemented. Final live success depends on confidential transfer execution on the active rail.                     |

Remaining work is focused on making every send and conversion route settle end to end on the live Sepolia rail.
