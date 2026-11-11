import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, Matches, MinLength } from 'class-validator';
import { TenantStatus, TenantType } from '../../tenant/tenant.entity';

export class PlatformLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(63)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @IsString()
  name: string;

  @IsEnum(TenantType)
  type: TenantType;

  @IsString()
  @IsOptional()
  dataResidencyRegion?: string;
}

export class UpdateTenantProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  dataResidencyRegion?: string;
}

// Deliberately its own endpoint/DTO, not folded into UpdateTenantProfileDto -
// changing the subdomain a hospital's staff/patients actually use is a
// bigger operational event than renaming, and should require deliberately
// calling a distinctly-named action, not slip in alongside a name edit.
export class UpdateTenantSlugDto {
  @IsString()
  @MinLength(2)
  @MaxLength(63)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  newSlug: string;
}

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  status: TenantStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

const KNOWN_MODULES = ['hms', 'payroll', 'automation'];

export class UpdateTenantModulesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(KNOWN_MODULES, { each: true })
  licensedModules: string[];
}
