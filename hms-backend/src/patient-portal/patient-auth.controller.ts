import { Body, Controller, Post, Req } from '@nestjs/common';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { PatientAuthService } from './patient-auth.service';
import { RequestPatientCodeDto, VerifyPatientCodeDto } from './dto/patient-portal.dto';

@Controller('patient-portal/auth')
export class PatientAuthController {
  constructor(private patientAuthService: PatientAuthService) {}

  @Post('request-code')
  requestCode(@Req() req: TenantRequest, @Body() dto: RequestPatientCodeDto) {
    return this.patientAuthService.requestCode(req.tenantDataSource, dto);
  }

  @Post('verify-code')
  verifyCode(@Req() req: TenantRequest, @Body() dto: VerifyPatientCodeDto) {
    return this.patientAuthService.verifyCode(req.tenantDataSource, req.tenant, dto);
  }
}
