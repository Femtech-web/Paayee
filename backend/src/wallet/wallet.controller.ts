import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';

import { AuthGuard, type PaayeeRequest } from '../auth/auth.guard';
import { FeeQuoteDto } from './dto/fee-quote.dto';
import { RelayTransactionDto } from './dto/relay-transaction.dto';
import { FeeService } from './fee.service';
import { WalletService } from './wallet.service';

@Controller('v1/wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(FeeService) private readonly fees: FeeService,
  ) {}

  @Post('fees/quote')
  quote(@Req() request: PaayeeRequest, @Body() body: FeeQuoteDto) {
    return this.fees.quote(request.user!.privyUserId, body);
  }

  @Post('relay')
  relay(@Req() request: PaayeeRequest, @Body() body: RelayTransactionDto) {
    return this.wallet.relay(request.user!.privyUserId, body);
  }

  @Get('transactions/:transactionId')
  transaction(@Req() request: PaayeeRequest, @Param('transactionId') transactionId: string) {
    return this.wallet.transaction(request.user!.privyUserId, transactionId);
  }
}
