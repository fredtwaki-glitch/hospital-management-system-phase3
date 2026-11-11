import { IsString, MinLength } from 'class-validator';

export class ApproveSupplierDraftDto {
  @IsString()
  @MinLength(1)
  finalContent: string; // staff's final (possibly edited) version of the AI draft
}
