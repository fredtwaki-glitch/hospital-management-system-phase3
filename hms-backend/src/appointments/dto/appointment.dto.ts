import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AppointmentStatus } from '../appointment.entity';

export class CreateAppointmentDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  providerId: string;

  // See CreatePatientDto.clientRequestId - same offline-replay purpose.
  @IsString()
  @IsOptional()
  clientRequestId?: string;

  @IsDateString()
  scheduledAt: string;

  @IsInt()
  @Min(5)
  @IsOptional()
  durationMinutes?: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
