import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { ClinicalNotesService } from './clinical-notes.service';
import { CreateClinicalNoteDto } from './dto/clinical-note.dto';

/**
 * Every route on this controller is restricted to clinical staff only.
 * BILLING_STAFF and FRONT_DESK are deliberately absent from every
 * @Roles() list below - not just omitted by oversight. If a future role
 * needs partial access (e.g. a lab tech needing note context), add it
 * explicitly and document why, rather than widening this by default.
 */
@Controller('clinical-notes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClinicalNotesController {
  constructor(private clinicalNotesService: ClinicalNotesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  create(@Req() req: TenantRequest, @Body() dto: CreateClinicalNoteDto) {
    const user = req.user as any;
    return this.clinicalNotesService.create(req.tenantDataSource, req.tenant.id, dto, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  findByPatient(@Req() req: TenantRequest, @Query('patientId') patientId: string) {
    const user = req.user as any;
    return this.clinicalNotesService.findByPatient(req.tenantDataSource, patientId, user.sub);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  findOne(@Req() req: TenantRequest, @Param('id') id: string) {
    const user = req.user as any;
    return this.clinicalNotesService.findOne(req.tenantDataSource, id, user.sub);
  }
}
