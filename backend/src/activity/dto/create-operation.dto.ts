import { IsEthereumAddress, IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateOperationDto {
  @IsInt()
  @Min(1)
  chainId!: number;

  @IsIn(['shield', 'unshield', 'public_send'])
  kind!: 'shield' | 'unshield' | 'public_send';

  @IsIn(['USDC', 'USDT'])
  tokenSymbol!: 'USDC' | 'USDT';

  @IsEthereumAddress()
  publicTokenAddress!: string;

  @IsEthereumAddress()
  confidentialTokenAddress!: string;

  @IsOptional()
  @IsEthereumAddress()
  destinationAddress?: string;

  @IsString()
  @Matches(/^[1-9][0-9]*$/)
  amountMinorUnits!: string;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  transactionHash!: string;
}
