import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { ClaimStatus } from '../invoice.entity';

export class CreateInvoiceLineItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsString()
  @IsOptional()
  sourceType?: string;

  @IsString()
  @IsOptional()
  sourceId?: string;
}

export class CreateInvoiceDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  lineItems: CreateInvoiceLineItemDto[];

  // Omit both for a plain self-pay invoice. If either is set, the
  // referenced cover must be ACTIVE (checked against
  // InsuranceCoversService.findActiveForBilling) and belong to this
  // same patient.
  @IsUUID()
  @IsOptional()
  primaryCoverId?: string;

  @IsUUID()
  @IsOptional()
  secondaryCoverId?: string;

  // Staff's initial estimate of what the payer(s) will cover, if known
  // up front (e.g. a known fixed-rate scheme). Left at 0/undetermined
  // otherwise and refined later via PATCH /invoices/:id/claim as the
  // claim is adjudicated.
  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedPayerCoveredAmount?: number;
}

export class RecordPaymentDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class UpdateClaimDto {
  @IsEnum(ClaimStatus)
  claimStatus: ClaimStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  payerCoveredAmount?: number;

  // Actual disbursement received from the payer - separate from
  // payerCoveredAmount (the approved/expected figure), added
  // incrementally as money actually lands, similar to RecordPaymentDto
  // on the patient side.
  @IsNumber()
  @IsPositive()
  @IsOptional()
  additionalAmountReceived?: number;
}
