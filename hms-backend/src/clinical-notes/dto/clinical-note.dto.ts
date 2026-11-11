import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ClinicalNoteType } from '../clinical-note.entity';

export class CreateClinicalNoteDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @IsEnum(ClinicalNoteType)
  noteType: ClinicalNoteType;

  @IsString()
  @MinLength(1)
  content: string;
}
