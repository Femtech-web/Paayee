import { BadRequestException, Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { MarketService } from './market.service';

const currencies = ['NGN', 'USD', 'USDC', 'USDT'] as const;
type Currency = (typeof currencies)[number];

@Controller('v1/market')
@UseGuards(AuthGuard)
export class MarketController {
  constructor(@Inject(MarketService) private readonly market: MarketService) {}

  @Get('rates')
  rates(@Query('base') base = 'NGN') {
    return this.market.rates(readCurrency(base));
  }

  @Post('quotes')
  quote(@Body() body: { amount?: unknown; sourceCurrency?: unknown; targetCurrency?: unknown }) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    const sourceCurrency = readCurrency(body.sourceCurrency);
    const targetCurrency = readCurrency(body.targetCurrency);
    if (sourceCurrency === targetCurrency) throw new BadRequestException('Choose two different currencies');
    return this.market.quote({ amount, sourceCurrency, targetCurrency });
  }
}

function readCurrency(value: unknown): Currency {
  const currency = String(value ?? '').toUpperCase();
  if (!currencies.includes(currency as Currency)) throw new BadRequestException(`Unsupported currency: ${currency}`);
  return currency as Currency;
}
