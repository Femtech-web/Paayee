# Paayee backend

This NestJS service runs the authenticated API and the deposit/status worker in
one process. `npm run start:dev` or `npm start` is therefore enough for the
normal Paayee deployment. Do not also start `start:worker` against the same
database unless you intentionally deploy the worker as a separate process.

## Before starting

1. Apply every migration in `../supabase/migrations`, including
   `20260827130000_enforce_app_paid_sponsorship.sql`.
2. Copy `.env.example` to `.env` and fill the required values.
3. Copy the same Privy app ID and app secret used by the `privy-session` Edge
   Function into `PRIVY_APP_ID` and `PRIVY_APP_SECRET` here.
4. In Privy, keep gas sponsorship set to **App pays** and allow server
   sponsored transactions.

The mobile user does not need ETH. Every allowlisted call is simulated using
its exact calldata before submission and rejected if it exceeds Paayee's gas
or USD sponsorship circuit breaker. Privy chooses the final sponsored gas
parameters. The user-facing network fee is free; Paayee never makes a separate
USDC/USDT fee-transfer call.

After confirmation, the worker records exact receipt gas usage and the actual
network cost in wei. It also snapshots Privy's aggregate USD gas credits for
the wallet/time window for billing reconciliation.

## Verify and run

```sh
npm run typecheck
npm test
npm run build
npm run start:dev
```

The service logs `Started subgraph deposit worker...` after boot. That confirms
the worker is running inside the API process; it does not listen on a second
port.
