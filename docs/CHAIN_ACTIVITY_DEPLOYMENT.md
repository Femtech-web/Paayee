# Paayee chain activity deployment

Paayee now uses a deliberately small architecture:

- The mobile wallet signs shield and unshield transactions.
- The API stores user-submitted operation references and serves activity.
- The worker detects USDC/USDT transfers, advances confirmations, creates receipts, and confirms privacy operations.
- Supabase Postgres stores the read model. The chain remains the money source of truth.
- Deposits stay public until the user taps **Make private**. There is no server-held wallet and no auto-shield signer.

## 1. Apply the database migration

From `supabase/`:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

This applies `20260826143000_paayee_chain_activity.sql` and creates the deposits, operations, receipts, and worker checkpoint tables.

## 2. Configure the backend

Fill `backend/.env`:

- `SUPABASE_URL`: Configuration → API → Project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Configuration → API Keys → secret/service-role key. This is server-only.
- `PAAYEE_SUPABASE_JWT_SECRET`: the same Legacy JWT Secret already used by the `privy-session` function.
- `PAAYEE_RPC_URL`: a Sepolia HTTPS RPC endpoint.

The deployed token addresses, current start block, and Graph Studio endpoint are already filled in. Keep `PAAYEE_INDEXER_DRIVER=subgraph`; RPC is still used only to read the chain head and confirm transaction receipts.

Local verification (the API process now embeds the worker):

```bash
cd backend
npm ci
npm run build
npm test
npm run start:dev
```

`npm run start:worker` remains available for a future separately scaled worker, but do not run it alongside the API in the current single-service deployment.

## 3. Deploy the combined API and worker

Create one Railway service and set the root directory to `zama/paayee/backend`.

API service:

- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health path: `/health`

Add every value from `backend/.env.example` to the service. Give it a public HTTPS domain, then set this in the Expo environment:

```env
EXPO_PUBLIC_PAAYEE_API_URL=https://YOUR-API-DOMAIN
EXPO_PUBLIC_PAAYEE_AUTO_SHIELD_POLICY_ENABLED=false
```

Restart Expo after changing any `EXPO_PUBLIC_` value.

## 4. Hosted subgraph

Graph Studio is the active deposit event source. The worker still uses the Sepolia RPC for the current block height and transaction receipts.

Build it first:

```bash
cd indexer
npm ci
npm run codegen
npm run build
```

Goldsky:

```bash
goldsky login
npm run deploy:goldsky
```

Graph Studio (only needed when publishing a new version):

```bash
graph auth YOUR_DEPLOY_KEY
PAAYEE_SUBGRAPH_SLUG=YOUR_STUDIO_SLUG npm run deploy:studio
```

The hosted GraphQL query URL is already configured as `PAAYEE_SUBGRAPH_URL`. Redeploy the worker after changing subgraph versions.

## 5. Test routine

1. Sign in with a fresh Privy email or Google account and complete handle/PIN onboarding.
2. Confirm the profile row contains the Privy wallet in `smart_account_address`.
3. Open USDC and copy the wallet address.
4. Send a small amount of the configured Sepolia USDC to it.
5. Within one worker interval, activity should show the deposit as confirming, then confirmed after the configured confirmations.
6. The asset page public balance should update directly from chain. Reloading the page also refreshes it.
7. Tap **Make private**, enter less than or equal to the public balance, approve in Privy, and wait for completion.
8. Confirm public balance decreases, private balance can be revealed, and a shield operation appears in activity.
9. Tap **Move to public**, enter a private amount, and keep the app open for the two-phase unshield finalization.
10. Confirm the public balance increases and the worker marks the unshield operation confirmed.
11. Repeat steps 3–10 with the configured Paayee Sepolia USDT contract.

If a deposit does not appear, check the worker logs first, then verify `profiles.smart_account_address`, chain ID, token address, start block, and RPC URL. The worker deliberately replays its recent block window, so pending deposits are updated as confirmations arrive and duplicate events remain idempotent.
