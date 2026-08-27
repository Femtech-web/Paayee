import { IsIn, IsInt, IsString, Matches, Min } from 'class-validator';

export class FeeQuoteDto {
  @IsIn(['shield', 'unshield', 'private-send'])
  kind!: 'shield' | 'unshield' | 'private-send';

  @IsIn(['USDC', 'USDT'])
  assetCode!: 'USDC' | 'USDT';

  @IsIn(['NGN', 'USD', 'USDC', 'USDT'])
  displayCurrency!: 'NGN' | 'USD' | 'USDC' | 'USDT';

  @IsString()
  @Matches(/^[1-9][0-9]*$/)
  amountMinorUnits!: string;

  @IsInt()
  @Min(1)
  chainId!: number;
}
