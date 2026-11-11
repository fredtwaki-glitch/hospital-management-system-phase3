import { IsEmail, IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';

export class RequestPatientCodeDto {
  @IsEmail()
  email: string;

  @IsString()
  mrn: string;
}

export class VerifyPatientCodeDto {
  @IsEmail()
  email: string;

  @IsString()
  mrn: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

export class PatientChatMessageDto {
  @IsUUID()
  @IsOptional()
  conversationId?: string; // omit to start a new conversation

  @IsString()
  @MinLength(1)
  message: string;
}
