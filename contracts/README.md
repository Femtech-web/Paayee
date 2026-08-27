# Paayee Confidential Assets

Paayee owns these ERC-7984 confidential stablecoin wrappers. Privy embedded
wallets hold and sign for cUSDC/cUSDT; Zama handles encrypted execution and
authorized decryption.

## Contracts

- `PaayeeConfidentialUSDC` wraps public USDC into confidential cUSDC.
- `PaayeeConfidentialUSDT` wraps public USDT into confidential cUSDT.
- `PaayeeConfidentialRegistry` records enabled Paayee assets.
- `MockERC20` is local-development USDC/USDT only.

## Commands

```bash
npm install
npm run compile
npm test
npm run deploy:localhost
npm run deploy:sepolia
```

Deployment writes `paayee-confidential-assets.<network>.json`. Copy the
`confidentialTokens.cUSDC` and `confidentialTokens.cUSDT` values into the app as
`EXPO_PUBLIC_PAAYEE_CUSDC_ADDRESS` and `EXPO_PUBLIC_PAAYEE_CUSDT_ADDRESS`.

Sepolia deployment requires a funded deployer and RPC configuration from
`.env.example`. Verify the deployed addresses before publishing a mobile build.
