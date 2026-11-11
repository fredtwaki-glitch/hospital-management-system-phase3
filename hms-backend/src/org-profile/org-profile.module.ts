import { Module } from '@nestjs/common';
import { OrgProfileController } from './org-profile.controller';
import { OrgProfileService } from './org-profile.service';

@Module({
  controllers: [OrgProfileController],
  providers: [OrgProfileService],
  exports: [OrgProfileService],
})
export class OrgProfileModule {}
