import { Inject, Injectable } from '@nestjs/common';

import { AppConfig } from '../config';

type Currency = 'NGN' | 'USD' | 'USDC' | 'USDT';

@Injectable()
export class MarketService {
  private cached?: { expiresAt: number; ngnPerUsd: number; source: string };
  private ethCached?: { expiresAt: number; value: number };

  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  async rates(baseCurrency: Currency = 'NGN') {
    const market = await this.marketRate();
    const currencies: Currency[] = ['NGN', 'USD', 'USDC', 'USDT'];
    return {
      baseCurrency,
      provider: market.source,
      rateReference: `${market.source}:${market.ngnPerUsd}:${Math.floor(Date.now() / 60_000)}`,
      confidence: 'indicative' as const,
      asOf: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      rates: currencies
        .filter((currency) => currency !== baseCurrency)
        .map((currency) => ({ currency, rate: String(this.rate(baseCurrency, currency, market.ngnPerUsd)) })),
    };
  }

  async quote(input: { amount: number; sourceCurrency: Currency; targetCurrency: Currency }) {
    const market = await this.marketRate();
    const rate = this.rate(input.sourceCurrency, input.targetCurrency, market.ngnPerUsd);
    const fee = roundMoney(input.amount * this.config.conversionFeeBps / 10_000, input.sourceCurrency);
    const converted = roundMoney(Math.max(input.amount - fee, 0) * rate, input.targetCurrency);
    const now = Date.now();
    return {
      id: `paayee_quote_${now}_${Math.random().toString(36).slice(2, 8)}`,
      appId: 'paayee',
      kind: 'swap' as const,
      status: 'active' as const,
      market: 'NG',
      sourceAmount: money(input.amount, input.sourceCurrency),
      settlementAmount: money(converted, input.targetCurrency),
      fees: [{ label: 'Paayee conversion fee', amount: money(fee, input.sourceCurrency) }],
      rateReference: `1:${input.sourceCurrency}:${rate}:${input.targetCurrency}`,
      providerReference: market.source,
      expiresAt: new Date(now + 60_000).toISOString(),
      createdAt: new Date(now).toISOString(),
    };
  }

  async usdTo(currency: Currency): Promise<number> {
    const market = await this.marketRate();
    return this.rate('USD', currency, market.ngnPerUsd);
  }

  async ethUsd(): Promise<number> {
    if (this.ethCached && this.ethCached.expiresAt > Date.now()) return this.ethCached.value;
    try {
      const response = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) throw new Error(`Coinbase returned ${response.status}`);
      const body = await response.json() as { data?: { amount?: string } };
      const value = Number(body.data?.amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Coinbase did not return ETH-USD');
      this.ethCached = { expiresAt: Date.now() + 60_000, value };
      return value;
    } catch {
      return this.config.fallbackEthUsd;
    }
  }

  private rate(source: Currency, target: Currency, ngnPerUsd: number): number {
    if (source === target) return 1;
    const sourcePerUsd = source === 'NGN' ? ngnPerUsd : 1;
    const targetPerUsd = target === 'NGN' ? ngnPerUsd : 1;
    return targetPerUsd / sourcePerUsd;
  }

  private async marketRate() {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached;
    try {
      const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', {
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) throw new Error(`Coinbase returned ${response.status}`);
      const body = await response.json() as { data?: { rates?: Record<string, string> } };
      const ngnPerUsd = Number(body.data?.rates?.NGN);
      if (!Number.isFinite(ngnPerUsd) || ngnPerUsd <= 0) throw new Error('Coinbase did not return NGN');
      return (this.cached = { expiresAt: Date.now() + 60_000, ngnPerUsd, source: 'coinbase' });
    } catch {
      return (this.cached = {
        expiresAt: Date.now() + 30_000,
        ngnPerUsd: this.config.fallbackNgnPerUsd,
        source: 'paayee-fallback',
      });
    }
  }
}

function money(amount: number, currency: Currency) {
  const scale = currency === 'NGN' ? 2 : 6;
  return {
    currency,
    display: String(amount),
    minorUnits: String(Math.round(amount * 10 ** scale)),
    scale,
  };
}

function roundMoney(amount: number, currency: Currency) {
  const scale = currency === 'NGN' ? 2 : 6;
  return Math.round(amount * 10 ** scale) / 10 ** scale;
}
