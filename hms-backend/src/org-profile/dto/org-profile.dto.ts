import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateOrgProfileDto {
  @IsString()
  @IsOptional()
  publicPhone?: string;

  @IsEmail()
  @IsOptional()
  publicEmail?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  openingHours?: string;

  @IsArray()
  @IsOptional()
  acceptedInsuranceProviders?: string[];

  @IsString()
  @IsOptional()
  additionalPublicNotes?: string;
}
