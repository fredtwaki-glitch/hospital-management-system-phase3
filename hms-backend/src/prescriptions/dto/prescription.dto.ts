import { IsEnum, IsInt, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { PrescriptionStatus } from '../prescription.entity';

export class CreatePrescriptionDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @IsString()
  medicationName: string;

  @IsString()
  dosage: string;

  @IsString()
  frequency: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  durationDays?: number;

  @IsString()
  @IsOptional()
  instructions?: string;
}

export class UpdatePrescriptionStatusDto {
  @IsEnum(PrescriptionStatus)
  status: PrescriptionStatus;
}
