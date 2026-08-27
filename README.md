# Paayee

Paayee is a private money app for NGN, USDC, and USDT. It gives users a familiar mobile-wallet experience while moving sensitive stablecoin balances and private payment metadata through Privy embedded wallets and Paayee-owned Zama confidential rails.

The product goal is simple: private payments should feel like normal payments.

## What Paayee Does

- Lets users hold an NGN wallet balance for local transfers, bank withdrawals, and everyday money movement.
- Lets users hold private stablecoin balances as cUSDC and cUSDT.
- Lets users add public USDC/USDT and shield it into confidential balances.
- Lets users send to Paayee handles, bank accounts, and stablecoin wallets.
- Keeps sensitive stablecoin amounts out of plaintext app storage.
- Shows private balances only after user-controlled reveal/decryption.
- Uses encrypted receipt metadata so transaction history can stay useful without leaking every numeric detail by default.

## Infrastructure

- Privy creates and signs with the user's embedded Ethereum wallet.
- Supabase stores Paayee profiles, handles, beneficiaries, and security preferences.
- Paayee owns its ERC-7984 cUSDC/cUSDT contracts and confidential-operation records.
- Zama provides encrypted execution and user-authorized balance decryption.
- Legacy fiat ledger adapters remain isolated until a production NGN provider replaces them.

## Money Model

Paayee uses two money buckets.

`NGN balance`

- Reserved for a Paayee-owned payment-provider integration.
- Not enabled in the current public-chain test build.
- Never automatically converted or shielded into stablecoin.

`Private stablecoin balance`

- cUSDC/cUSDT on the Zama confidential token rail.
- Funded by public USDC/USDT deposits or explicit conversion.
- Used for private stablecoin sends and on-chain private settlement.
- Decrypted only when the user reveals it in the app.

This avoids mixing fiat-wallet behavior with private stablecoin behavior. NGN stays NGN until the user chooses an operation that needs stablecoin privacy.

## Current Rail Strategy

Paayee-managed cUSDC/cUSDT are the active confidential assets. Their addresses are configured directly in the Expo environment, and the Privy embedded wallet owns, signs, and decrypts the user's confidential balances.

## Core Flows

### Add Money

`NGN bank transfer`

This route stays disabled until Paayee connects a production payment provider directly.

`USDC/USDT deposit`

The user sends public USDC/USDT to their Privy wallet. The Paayee worker detects and confirms the deposit, creates its receipt, and refreshes activity. The user then chooses **Make private** to shield it into cUSDC/cUSDT.

`Conversion`

NGN to stablecoin and stablecoin to NGN are explicit conversion flows. NGN is not auto-shielded just because it was deposited.

### Send Money

`Paayee handle`

Stablecoin sends use Paayee confidential token execution. NGN handle sends remain disabled until the direct fiat rail is ready.

`Bank account`

This route remains disabled until the direct fiat payout provider is ready.

`Stablecoin wallet`

USDC/USDT sends resolve to Paayee confidential stablecoin operations and settle through the active Zama rail.

## Privacy Boundary

Paayee should not treat normal public receipts as private.

Public deposit details, such as the public USDC amount received, are ingress facts. The private balance begins after shielding into cUSDC/cUSDT.

Private operation metadata is encrypted before storage. Paayee stores only the minimum public references needed for status, receipts, and reconciliation; sensitive numeric details should remain confidential token state or encrypted metadata.

## Repository Layout

- `app/` - Expo mobile app.
- `backend/` - minimal NestJS API and deposit/operation worker.
- `contracts/` - Paayee confidential asset deployment and registration scripts.
- `indexer/` - optional Goldsky or Graph Studio subgraph.
- `docs/` - privacy and architecture notes.
- `supabase/` - Paayee application data, Privy token exchange, and row-level access policies.

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
```

For full local privacy testing, run Hardhat with the FHEVM mock relayer and configure the deployed cUSDC/cUSDT addresses in the Expo environment.

## Production Notes

Before public release:

- rotate all leaked development secrets and API keys
- configure a real payment provider for NGN deposits and withdrawals
- configure real Sepolia/Mainnet RPC and Zama relayer values
- enable Privy email and Google login, then deploy the `privy-session` Supabase Edge Function
- verify the Paayee confidential token addresses and Zama relayer config
- run an end-to-end add-money and send-money test on the active rail

## Status

Paayee is in active build toward a public test release. Privy login, confidential balance reveal, Paayee-owned stablecoin deposit tracking, manual privacy controls, receipts, and optional hosted indexing are in place. Legacy Klyde calls are disabled in the test build.

Current route status:

| Area      | Route                         | Status                                                                                                                                              |
| --------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add money | NGN bank transfer             | Paused until the direct Paayee payment-provider rail is connected.                                                                                   |
| Add money | Public USDC/USDT deposit      | Implemented with Paayee API/worker receipts and user-controlled shielding.                                                                           |
| Add money | NGN to cUSDC/cUSDT conversion | Paused until the direct fiat treasury/provider rail is connected.                                                                                    |
| Add money | cUSDC/cUSDT to NGN conversion | Paused until the direct fiat treasury/provider rail is connected.                                                                                    |
| Send      | NGN to Paayee handle          | Paused with the NGN rail.                                                                                                                            |
| Send      | NGN to bank                   | Paused with the NGN rail.                                                                                                                            |
| Send      | USDC/USDT to Paayee handle    | Uses the confidential stablecoin send path. Requires live Zama + smart-account execution.                                                           |
| Send      | USDC/USDT to external wallet  | Route and destination wiring are implemented. Final live success depends on confidential transfer execution on the active rail.                     |

Remaining work is focused on making every send and conversion route settle end to end on the live Sepolia rail.
