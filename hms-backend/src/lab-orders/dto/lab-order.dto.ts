import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { LabOrderPriority, LabOrderStatus } from '../lab-order.entity';

export class CreateLabOrderDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @IsString()
  testName: string;

  @IsEnum(LabOrderPriority)
  @IsOptional()
  priority?: LabOrderPriority;
}

export class UpdateLabOrderStatusDto {
  @IsEnum(LabOrderStatus)
  status: LabOrderStatus;

  @IsString()
  @MinLength(1)
  @IsOptional()
  resultSummary?: string;

  @IsString()
  @IsOptional()
  resultAttachmentUrl?: string;
}
