-- Privy sponsors Paayee's Sepolia transactions, so testnet quotes are valid
-- with a zero user charge. Mainnet fee quotes may still be positive.

alter table public.paayee_fee_quotes
  drop constraint paayee_fee_quotes_amounts_positive;

alter table public.paayee_fee_quotes
  add constraint paayee_fee_quotes_amounts_valid
  check (amount_minor_units > 0 and fee_minor_units >= 0);
