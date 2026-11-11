import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { AppointmentsService } from '../appointments/appointments.service';
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import { LabOrdersService } from '../lab-orders/lab-orders.service';
import { InsuranceCoversService } from '../insurance-covers/insurance-covers.service';
import { PatientJwtAuthGuard } from './patient-jwt-auth.guard';

/**
 * Direct REST reads for the patient portal UI - distinct from the AI
 * chat endpoint, which is for conversational Q&A. A UI listing "your
 * appointments" shouldn't have to go through an LLM call. Every method
 * takes patientId from the verified token (req.user.sub), never from a
 * query param - same rule as AiResponderService's tool execution.
 */
@Controller('patient-portal/me')
@UseGuards(PatientJwtAuthGuard)
export class PatientSelfServiceController {
  constructor(
    private appointmentsService: AppointmentsService,
    private prescriptionsService: PrescriptionsService,
    private labOrdersService: LabOrdersService,
    private insuranceCoversService: InsuranceCoversService,
  ) {}

  @Get('appointments')
  appointments(@Req() req: TenantRequest) {
    const patientId = (req.user as any).sub;
    return this.appointmentsService.findAll(req.tenantDataSource, { patientId });
  }

  @Get('prescriptions')
  prescriptions(@Req() req: TenantRequest) {
    const patientId = (req.user as any).sub;
    return this.prescriptionsService.findByPatient(req.tenantDataSource, patientId);
  }

  @Get('lab-orders')
  labOrders(@Req() req: TenantRequest) {
    const patientId = (req.user as any).sub;
    return this.labOrdersService.findByPatient(req.tenantDataSource, patientId, patientId);
  }

  @Get('insurance-covers')
  insuranceCovers(@Req() req: TenantRequest) {
    const patientId = (req.user as any).sub;
    return this.insuranceCoversService.findByPatient(req.tenantDataSource, patientId);
  }
}
