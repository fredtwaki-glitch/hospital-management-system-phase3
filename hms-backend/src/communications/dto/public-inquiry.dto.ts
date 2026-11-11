import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class StartPublicInquiryDto {
  @IsString()
  @MinLength(1)
  message: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;
}

export class ContinuePublicInquiryDto {
  @IsUUID()
  conversationId: string;

  @IsString()
  @MinLength(1)
  message: string;
}
