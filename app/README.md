# Paayee App

## Product Integration Notes

- Klyde owns money sessions, wallets, rails, receipts, and on-chain/private money movement.
- Paayee owns product metadata: profile fields, Paayee handles, verification details, security preferences, and saved beneficiaries.
- Critical privacy decisions should be recorded in `../docs/PRIVACY_BOUNDARY_AUDIT.md` when they affect Paayee/Klyde money flow boundaries.
- Paayee-owned app-managed confidential token contracts live in `../contracts`.
- After deploying those contracts, run `npm run register:klyde` from `../contracts` so Klyde resolves Paayee `USDC -> cUSDC` and `USDT -> cUSDT` app-managed assets.
- Stablecoin private sends prepare a Klyde confidential operation whose active rail is resolved from the app privacy config, then the Paayee mobile Zama runtime can execute the ERC-7984 confidential transfer when enabled.
- Private USDC/USDT conversion uses a local display estimate plus a Klyde confidential operation resolved from the app privacy config. Klyde stores operation status and amount-reference commitments; the actual debit/credit must run through the active confidential conversion executor.
- Private receipt/timeline metadata uses AES-GCM envelopes with `{ ciphertext, iv, authTag, keyHandle, aclPolicy, schemaVersion }`. The AES key must be protected by FHE ACL for the user's smart account in local, sandbox, and production. Local Hardhat can use the Zama SDK cleartext relayer, but Paayee should still receive a real key handle from the smart-account/FHE ACL transport.
- The UI keeps the same money-flow screens, but private data sources changed: USDC/USDT balances are decrypted confidential balances or masked handles, pending private operations show status without amount values, and private receipts decrypt their encrypted metadata envelope when opened.
- Active confidential balance and funding asset resolution is controlled by the Klyde app privacy config. For the current local pass, `app_paayee_local` is configured as `klyde_managed`, so normal public USDC/USDT funding instructions receive Klyde-watched public tokens first, then Klyde queues auto-shield into Klyde-managed `cUSDC` / `cUSDT`. Paayee-owned app-managed `cUSDC` / `cUSDT` remains registered as non-default until Paayee is ready to route funding, indexing, and shielding through its own token pair.
- NGN funding is a fiat ledger rail, not an automatic cUSDC/cUSDT rail. Klyde verifies/reconciles bank-transfer deposits and credits the user's NGN balance. NGN only moves into confidential stablecoin when the user explicitly converts NGN to USDC/USDT.
- Private USDC/USDT to NGN conversion debits the user's cUSDC/cUSDT by confidentially transferring it to Klyde's private settlement wallet, then Klyde records the NGN ledger credit. Local Hardhat defaults this settlement wallet to the first dev account; Sepolia/Mainnet must set `EXPO_PUBLIC_KLYDE_PRIVACY_SETTLEMENT_ADDRESS`.
- Public ingress receipts may include provider/on-chain-visible amount data and must be labeled as public. Private balance and private receipt amounts come from confidential token state or decrypted metadata envelopes, not from Klyde's plaintext ledger.
- Enable mobile Zama execution with `EXPO_PUBLIC_ZAMA_MOBILE_RUNTIME_ENABLED=true`. By default Paayee uses Klyde's relayer proxy at `${EXPO_PUBLIC_KLYDE_API_URL}/v1/relayer/:chainId`; override with `EXPO_PUBLIC_ZAMA_SEPOLIA_RELAYER_URL`, `EXPO_PUBLIC_ZAMA_MAINNET_RELAYER_URL`, or `EXPO_PUBLIC_ZAMA_LOCAL_RELAYER_URL`.
- The user's Klyde wallet/smart account is the confidential token holder and transaction signer. On startup Paayee installs `globalThis.__PAAYEE_KLYDE_SMART_ACCOUNT_TRANSPORT__`, backed by Klyde current-wallet signing/submission endpoints. Expo never receives raw private keys; Klyde signs with the backend encrypted embedded-wallet key. Production ERC-4337 deployments should route the same transport through the smart-account/bundler path instead of plain EOA submission.
- Local private funding can let Paayee ensure an active Klyde auto-shield policy with `EXPO_PUBLIC_PAAYEE_AUTO_SHIELD_POLICY_ENABLED=true`. Production should replace that bootstrap with an explicit user consent surface before worker-executed auto-shield is enabled.
- ACL decision: contracts should allow the smart account for confidential token ownership/execution. If Zama user decryption does not accept the smart account's EIP-1271 signature path in a given environment, Paayee must additionally allow the current owner/session signer for user decryption only, without moving token ownership away from the smart account.
- Run `npm run test:privacy-e2e` from this folder to verify the Paayee/Klyde privacy boundary: app-managed cUSDC/cUSDT, stablecoin auto-shield, NGN fiat ledger funding, explicit NGN-to-stablecoin conversion, private send/conversion, encrypted receipt metadata, smart-account execution, and status-only pending UI rows.
- A new user should get a Klyde-managed wallet/smart account after account setup. Paayee stores the Klyde user/wallet link in Supabase and presents it as the Paayee account.
- Main app screens read through `src/features/app-data`, so UI screens do not directly juggle Klyde and Supabase details.
- Current live-data state:
  - Home reads the real Paayee profile, Klyde wallet snapshot, Klyde balances, Klyde receipt-backed history, Klyde recent rail recipients, and Supabase beneficiaries.
  - Balance rows are normalized from `getWalletSnapshot({ baseCurrency: "NGN" })` with zero rows preserved for supported empty balances.
  - The private balance total is NGN-first for Nigeria launch: use Klyde valuation when available and fall back to the actual NGN balance when rates are unavailable.
  - Transactions read from `listTransactions()` and fall back to a polished empty state when the user has no receipts yet.
- Profile/security wiring:
  - Change email uses Supabase verified email update.
  - Account verification writes identity/contact/residence details to Supabase profile metadata.
  - Change PIN verifies the current local PIN, then stores a new salted verifier in SecureStore.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
