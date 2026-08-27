# Paayee Privy Ship Checklist

Paayee now uses Privy for email/Google login and a silent embedded Ethereum
account that owns and signs for its Paayee-managed ERC-7984 confidential
balances. Supabase remains a data store; it is not a user-facing auth provider.

## Privy dashboard

1. Create a React Native app client.
2. Register iOS bundle ID `org.paayee.app`, Android package `org.paayee.app`, and
   URL scheme `paayee`.
3. Enable Email and Google login. Do not enable wallet login methods.
4. Enable automatic Ethereum wallet creation for users without wallets.
5. Copy the app ID and mobile client ID into the Expo environment.

## Expo environment

Required for the test release:

```dotenv
EXPO_PUBLIC_ENABLE_REAL_INTEGRATIONS=true
EXPO_PUBLIC_PRIVY_APP_ID=cl...
EXPO_PUBLIC_PRIVY_CLIENT_ID=client-...
EXPO_PUBLIC_ZAMA_MOBILE_RUNTIME_ENABLED=true
EXPO_PUBLIC_ZAMA_CHAIN_ID=11155111
EXPO_PUBLIC_PAAYEE_CUSDC_ADDRESS=0x...
EXPO_PUBLIC_PAAYEE_CUSDT_ADDRESS=0x...
EXPO_PUBLIC_ZAMA_SEPOLIA_RPC_URL=https://...
EXPO_PUBLIC_ZAMA_SEPOLIA_RELAYER_URL=https://...
EXPO_PUBLIC_PAAYEE_PRIVACY_SETTLEMENT_ADDRESS=0x...
```

Run both new Supabase migrations and deploy the `privy-session` Edge Function
before the build. The Privy bridge writes the embedded account address to
`profiles.smart_account_address`; existing handle resolution therefore keeps
working without moving confidential ownership to a backend wallet.

## Release gates

- Sign up with a fresh email and verify the six-digit Privy security code.
- Sign out, then sign in with Google and confirm there is no Supabase auth session.
- Confirm one embedded Ethereum wallet is created and linked to the profile.
- Fund the wallet with Sepolia ETH for gas (or configure Privy sponsorship).
- Shield test USDC into Paayee cUSDC.
- Reveal the cUSDC balance through Zama user decryption.
- Send cUSDC to a second Paayee handle and reveal both resulting balances.

Klyde is no longer used for embedded-wallet signing or Paayee confidential
operations. The older fiat ledger/bank-provider adapters still exist as a
temporary compatibility layer and should not be presented as production-ready
until a replacement payment provider is connected.

## Privy authentication deployment

- Enable **Email** and **Google** under Login methods in the Privy dashboard.
- Add Paayee's iOS bundle ID, Android package name, and app scheme to the Privy app.
- Deploy the `privy-session` Edge Function. It verifies Privy access tokens and returns a 10-minute, RLS-compatible data token; Supabase never logs the user in.
- Set Edge Function secrets `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, and `PAAYEE_SUPABASE_JWT_SECRET` (the project's legacy JWT secret; never expose it to the app).
- Apply `20260826120000_privy_native_auth.sql` before testing a real account.
- Users should only see Google or email sign-in. Embedded account creation remains silent.

## Create the Paayee Privy app

1. In the Privy Dashboard, create a new app named `Paayee Development`. If the
   setup asks for a platform, choose **Mobile / React Native**. Create a separate
   production app later so development users and credentials stay isolated.
2. Open **App settings > Basics**:
   - Copy **App ID** to `EXPO_PUBLIC_PRIVY_APP_ID` in `app/.env`.
   - Put the same value in `PRIVY_APP_ID` in `supabase/functions/.env`.
   - Copy or generate the **App secret** and put it only in
     `PRIVY_APP_SECRET` in `supabase/functions/.env`.
3. Open **App clients** (sometimes shown as **Clients**) and create a
   **React Native** client named `Paayee Mobile`:
   - iOS bundle identifier: `org.paayee.app`
   - Android package/application ID: `org.paayee.app`
   - Allowed URL scheme: `paayee`
   - If testing with Expo Go, also allow identifier `host.exp.Exponent` and URL
     scheme `exp`; remove those development allowances for production.
   - Copy the generated **Client ID** to `EXPO_PUBLIC_PRIVY_CLIENT_ID` in
     `app/.env`.
4. Open **Login methods / Authentication**:
   - Enable **Email**.
   - Enable **Google**.
   - Leave wallet login, phone, and other social methods disabled.
5. For the fastest development setup, use Privy's default Google credentials.
   Before production, create your own Google OAuth credential as a **Web
   application** (even though Paayee itself is mobile), register
   `https://auth.privy.io/api/v1/oauth/callback`, and paste the Google client ID
   and client secret into Privy's Google login settings.
6. Keep automatic Ethereum embedded-account creation enabled. Paayee's provider
   already requests creation for users who do not have one.

## Configure the Supabase function

1. Open Supabase **Settings > API > JWT Secret** (or the project's JWT signing
   keys page) and copy the legacy JWT secret into
   `PAAYEE_SUPABASE_JWT_SECRET` in `supabase/functions/.env`.
2. Push the three production secrets from the repository root:

   ```bash
   npx supabase secrets set --env-file supabase/functions/.env
   ```

3. Apply the database migrations and deploy the function:

   ```bash
   npx supabase db push
   npx supabase functions deploy privy-session --no-verify-jwt
   ```

Do not commit `app/.env` or `supabase/functions/.env`; both are ignored. Only
their `.env.example` templates belong in Git.
