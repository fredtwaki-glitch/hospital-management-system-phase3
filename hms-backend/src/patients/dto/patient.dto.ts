import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { CitizenshipStatus, Gender, GuardianRelationship, IdentificationType } from '../patient.entity';

export class CreatePatientDto {
  @IsString()
  mrn: string;

  // Set by the offline queue when this write was made without
  // connectivity and is being replayed. Absent on a normal online
  // request. See PatientsService.create for how this is used.
  @IsString()
  @IsOptional()
  clientRequestId?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  // --- Citizenship / identification ---
  @IsEnum(CitizenshipStatus)
  @IsOptional()
  citizenshipStatus?: CitizenshipStatus;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsEnum(IdentificationType)
  @IsOptional()
  idType?: IdentificationType;

  @IsString()
  @IsOptional()
  idNumber?: string;

  // --- Student status ---
  @IsBoolean()
  @IsOptional()
  isStudent?: boolean;

  @IsString()
  @IsOptional()
  institutionName?: string;

  @IsString()
  @IsOptional()
  studentIdNumber?: string;

  // --- Guardian - required for minors, enforced in PatientsService,
  // not here, since "required" depends on dateOfBirth above, which
  // class-validator's per-field decorators can't cross-reference cleanly. ---
  @IsString()
  @IsOptional()
  guardianFullName?: string;

  @IsEnum(GuardianRelationship)
  @IsOptional()
  guardianRelationship?: GuardianRelationship;

  @IsString()
  @IsOptional()
  guardianPhone?: string;

  @IsEmail()
  @IsOptional()
  guardianEmail?: string;

  @IsString()
  @IsOptional()
  guardianIdNumber?: string;

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @IsString()
  @IsOptional()
  bloodType?: string;

  @IsArray()
  @IsOptional()
  allergies?: string[];
}

export class UpdatePatientDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEnum(CitizenshipStatus)
  @IsOptional()
  citizenshipStatus?: CitizenshipStatus;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsEnum(IdentificationType)
  @IsOptional()
  idType?: IdentificationType;

  @IsString()
  @IsOptional()
  idNumber?: string;

  @IsBoolean()
  @IsOptional()
  isStudent?: boolean;

  @IsString()
  @IsOptional()
  institutionName?: string;

  @IsString()
  @IsOptional()
  studentIdNumber?: string;

  @IsString()
  @IsOptional()
  guardianFullName?: string;

  @IsEnum(GuardianRelationship)
  @IsOptional()
  guardianRelationship?: GuardianRelationship;

  @IsString()
  @IsOptional()
  guardianPhone?: string;

  @IsEmail()
  @IsOptional()
  guardianEmail?: string;

  @IsString()
  @IsOptional()
  guardianIdNumber?: string;

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @IsString()
  @IsOptional()
  bloodType?: string;

  @IsArray()
  @IsOptional()
  allergies?: string[];

  @IsBoolean()
  @IsOptional()
  isDeceased?: boolean;
}
