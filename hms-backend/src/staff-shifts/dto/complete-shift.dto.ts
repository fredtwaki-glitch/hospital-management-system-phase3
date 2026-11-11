import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CompleteShiftDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
