import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { PayerType } from '../payer.entity';

export class CreatePayerDto {
  @IsString()
  name: string;

  @IsEnum(PayerType)
  payerType: PayerType;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  claimsSubmissionNotes?: string;
}

export class UpdatePayerDto {
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  claimsSubmissionNotes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
