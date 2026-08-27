import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AuthGuard, type PaayeeRequest } from '../auth/auth.guard';
import { ActivityRepository } from './activity.repository';
import { CreateOperationDto } from './dto/create-operation.dto';

@Controller('v1/activity')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(@Inject(ActivityRepository) private readonly activity: ActivityRepository) {}

  @Get()
  list(@Req() request: PaayeeRequest, @Query('symbol') symbol?: string) {
    return this.activity.list(request.user!.privyUserId, symbol?.toUpperCase());
  }

  @Get('receipts/:receiptId')
  receipt(@Req() request: PaayeeRequest, @Param('receiptId') receiptId: string) {
    return this.activity.receipt(request.user!.privyUserId, receiptId);
  }

  @Post('operations')
  createOperation(@Req() request: PaayeeRequest, @Body() body: CreateOperationDto) {
    return this.activity.createOperation(request.user!.privyUserId, body);
  }
}
