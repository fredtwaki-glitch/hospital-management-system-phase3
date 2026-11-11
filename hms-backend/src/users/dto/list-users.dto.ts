import { IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../user.entity';

export class ListUsersQueryDto {
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
