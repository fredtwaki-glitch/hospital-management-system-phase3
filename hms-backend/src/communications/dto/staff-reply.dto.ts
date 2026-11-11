import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ConversationStatus } from '../conversation.entity';

export class StaffReplyDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsEnum(ConversationStatus)
  @IsOptional()
  setStatus?: ConversationStatus;
}
