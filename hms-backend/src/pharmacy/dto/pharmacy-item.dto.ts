import { IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePharmacyItemDto {
  @IsString()
  sku: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  quantityOnHand?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  reorderThreshold?: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  supplier?: string;
}

export class ReceiveStockDto {
  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class DispenseStockDto {
  @IsInt()
  @Min(1)
  quantity: number;

  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  prescriptionId?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
