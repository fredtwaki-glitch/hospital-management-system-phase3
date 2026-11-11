import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { InitiateStkPushDto, LinkTransactionToInvoiceDto } from './dto/mpesa.dto';
import { MpesaService } from './mpesa.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MpesaController {
  constructor(
    private mpesaService: MpesaService,
    private config: ConfigService,
  ) {}

  @Post('invoices/:id/mpesa/stk-push')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF, UserRole.FRONT_DESK)
  initiateStkPush(@Req() req: TenantRequest, @Param('id') invoiceId: string, @Body() dto: InitiateStkPushDto) {
    const user = req.user as any;
    return this.mpesaService.initiateStkPush(
      req.tenantDataSource,
      req.tenant.id,
      req.tenant.slug,
      invoiceId,
      dto.phoneNumber,
      user.sub,
      this.config.get('MPESA_CALLBACK_BASE_URL') ?? 'https://your-public-url.example.com',
    );
  }

  @Get('invoices/:id/mpesa-transactions')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF, UserRole.FRONT_DESK)
  findByInvoice(@Req() req: TenantRequest, @Param('id') invoiceId: string) {
    return this.mpesaService.findByInvoice(req.tenantDataSource, invoiceId);
  }

  // Completed C2B payments Safaricom confirmed but that couldn't be
  // matched to an invoice automatically (bad/blank account number, or a
  // patient paid ahead of any invoice existing) - staff resolve these
  // manually rather than money silently going untracked.
  @Get('mpesa/unmatched')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  listUnmatched(@Req() req: TenantRequest) {
    return this.mpesaService.listUnmatched(req.tenantDataSource);
  }

  @Post('mpesa/transactions/:id/link-invoice')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  linkToInvoice(@Req() req: TenantRequest, @Param('id') transactionId: string, @Body() dto: LinkTransactionToInvoiceDto) {
    const user = req.user as any;
    return this.mpesaService.linkToInvoice(req.tenantDataSource, req.tenant.id, transactionId, dto.invoiceId, user.sub);
  }
}
