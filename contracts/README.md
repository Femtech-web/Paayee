# Paayee Confidential Contracts

Paayee-owned FHEVM confidential token contracts for Klyde app-managed asset registration.

## Contracts

- `PaayeeConfidentialUSDC`: ERC-7984 wrapper for underlying USDC, exposed as `cUSDC`.
- `PaayeeConfidentialUSDT`: ERC-7984 wrapper for underlying USDT, exposed as `cUSDT`.
- `PaayeeConfidentialRegistry`: Paayee registry of app-managed confidential assets.
- `MockERC20`: local-only USDC/USDT test token.

Klyde remains the session, wallet, rail, funding, and operation-tracking layer. Paayee can own confidential assets and
register them in Klyde as `app_managed` assets. For the current local testing pass, Klyde-managed assets remain the
active/default money rail while Paayee's assets are registered as non-default.

## Commands

```bash
npm install
npm run compile
npm run test
npm run chain
npm run deploy:localhost
npm run register:klyde
npm run deploy:sepolia
```

## Dependency Baseline

This workspace follows the local FHEVM stack already used by Circux: Hardhat 2, `@fhevm/hardhat-plugin` 0.4.x, `@fhevm/solidity` 0.11.x, OpenZeppelin Confidential Contracts 0.3.x, and `@zama-fhe/relayer-sdk` 0.4.1. Keep the FHEVM plugin, mock utils, and relayer SDK on compatible versions when upgrading.

## Local Deployment

Local deployment creates Paayee's own public USDC/USDT tokens, deploys `cUSDC` and `cUSDT` wrappers around those
exact tokens, registers them in `PaayeeConfidentialRegistry`, and writes:

```text
paayee-confidential-assets.localhost.json
```

For now these Paayee assets are registered in Klyde as `app_managed` but `isDefault: false`. That means Klyde can
discover the Paayee assets, but Paayee's active money rail still uses Klyde-managed local USDC/cUSDC and USDT/cUSDT.

For a clean local redeploy:

```bash
npm run deploy:localhost:reset
```

Use the reset command whenever the local Hardhat chain was restarted or purged. Plain `npm run deploy:localhost` reuses
`deployments/localhost`, so it can fail with `cannot get the transaction for MockUSDC's previous deployment` when those
deployment files point at transactions from an older local chain.

You can override `PAAYEE_USDC_ADDRESS` and `PAAYEE_USDT_ADDRESS` explicitly. Otherwise local Hardhat deploys Paayee
mock public USDC/USDT and registers those addresses with Klyde.

That file includes Klyde registration payloads:

```json
{
  "mode": "app_managed",
  "underlyingSymbol": "USDC",
  "underlyingTokenAddress": "0xPaayeePublicUSDC",
  "symbol": "cUSDC",
  "isDefault": false
}
```

Register the deployed Paayee confidential assets in Klyde:

```bash
npm run register:klyde
```

For current local funding tests, use Klyde's active managed rail:

```bash
cd /Users/mac/work/web3/zama/klyde
KLYDE_FUND_TOKEN=USDC \
KLYDE_FUND_TO=<user-wallet-address> \
KLYDE_FUND_AMOUNT=1000 \
npm run fund:stablecoin
```

The local subgraph can stay on Klyde's token rails while Paayee app-managed assets are registered but non-default.

The registration script loads values from this folder's `.env`. For local testing, set:

```env
KLYDE_API_URL=http://localhost:4000
KLYDE_APP_ID=app_paayee_local
KLYDE_API_KEY=<printed-local-klyde-api-key>
```

The script calls `POST /v1/confidential-assets` for `cUSDC` and `cUSDT` with `mode: "app_managed"`,
`underlyingTokenAddress`, `erc7984: true`, and `isDefault: false`.

To also switch the Klyde app privacy config automatically, provide a dashboard/admin bearer token:

```env
KLYDE_ADMIN_TOKEN=<admin-token>
```

Without `KLYDE_ADMIN_TOKEN`, the script prints the exact privacy config to set in Klyde:

```json
{
  "mode": "klyde_managed",
  "allowAppManagedAssets": true,
  "defaultAssets": {}
}
```

This keeps Klyde-managed assets as the active rail while still allowing Paayee app-managed assets to be registered and
tested separately.

## Sepolia Deployment

Set:

```bash
SEPOLIA_RPC_URL=
ETHERSCAN_API_KEY=
MNEMONIC=
SEPOLIA_USDC_ADDRESS=
SEPOLIA_USDT_ADDRESS=
```

Then run:

```bash
npm run deploy:sepolia
```

If `SEPOLIA_USDC_ADDRESS` or `SEPOLIA_USDT_ADDRESS` is omitted, the deploy script uses common Sepolia test-token defaults that can be overridden.

## Privacy Boundary

Balances and value movement should be read from confidential token state. Klyde and Paayee should store encrypted amount handles, commitments, operation references, or encrypted receipt payloads instead of durable raw confidential amounts.
