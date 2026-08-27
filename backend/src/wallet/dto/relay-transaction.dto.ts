import { IsEthereumAddress, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class RelayTransactionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  feeQuoteId?: string;

  @IsString()
  @MaxLength(128)
  walletId!: string;

  @IsEthereumAddress()
  walletAddress!: string;

  @IsEthereumAddress()
  to!: string;

  @IsString()
  @Matches(/^0x(?:[a-fA-F0-9]{2})+$/)
  data!: `0x${string}`;

  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]+$/)
  value?: `0x${string}`;

  @IsString()
  @MaxLength(2048)
  authorizationSignature!: string;

  @IsString()
  @MaxLength(128)
  idempotencyKey!: string;

  @IsInt()
  @Min(1)
  requestExpiry!: number;
}
