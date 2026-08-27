import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateOperationDto } from '../src/activity/dto/create-operation.dto';

const validOperation = {
  amountMinorUnits: '1250000',
  chainId: 11155111,
  confidentialTokenAddress: '0x9854C9845f02765000e33bFEe88b75B6539059eA',
  kind: 'shield',
  publicTokenAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  tokenSymbol: 'USDC',
  transactionHash: `0x${'a'.repeat(64)}`,
};

describe('CreateOperationDto', () => {
  it('accepts a valid user-signed privacy operation', async () => {
    const errors = await validate(plainToInstance(CreateOperationDto, validOperation));
    expect(errors).toHaveLength(0);
  });

  it('rejects zero amounts and unsupported assets', async () => {
    const dto = plainToInstance(CreateOperationDto, {
      ...validOperation,
      amountMinorUnits: '0',
      tokenSymbol: 'ETH',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['amountMinorUnits', 'tokenSymbol']));
  });
});
