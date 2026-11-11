import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { CoverCategory, CoverPriority, CoverStatus, RelationshipToPolicyholder } from '../patient-insurance-cover.entity';

export class CreateInsuranceCoverDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  payerId: string;

  @IsEnum(CoverCategory)
  coverCategory: CoverCategory;

  // Required specifically when coverCategory is CORPORATE - enforced
  // here rather than left to staff convention, since a corporate cover
  // without a named employer isn't meaningfully distinguishable from a
  // personal one.
  @ValidateIf((o) => o.coverCategory === CoverCategory.CORPORATE)
  @IsString()
  organizationName?: string;

  @IsString()
  memberNumber: string;

  @IsEnum(RelationshipToPolicyholder)
  @IsOptional()
  relationshipToPolicyholder?: RelationshipToPolicyholder;

  @IsEnum(CoverPriority)
  priority: CoverPriority;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validTo?: string;
}

export class UpdateInsuranceCoverDto {
  @IsEnum(CoverStatus)
  @IsOptional()
  status?: CoverStatus;

  @IsEnum(CoverPriority)
  @IsOptional()
  priority?: CoverPriority;

  @IsDateString()
  @IsOptional()
  validTo?: string;
}
