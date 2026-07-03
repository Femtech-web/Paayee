# Paayee App

## Product Integration Notes

- Klyde owns money sessions, wallets, rails, receipts, and on-chain/private money movement.
- Paayee owns product metadata: profile fields, Paayee handles, verification details, security preferences, and saved beneficiaries.
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
