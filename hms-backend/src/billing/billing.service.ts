import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/event-bus.service';
import { InsuranceCoversService } from '../insurance-covers/insurance-covers.service';
import { CreateInvoiceDto, RecordPaymentDto, UpdateClaimDto } from './dto/invoice.dto';
import { ClaimStatus, Invoice, InvoiceLineItem, InvoiceStatus } from './invoice.entity';

@Injectable()
export class BillingService {
  constructor(
    private auditService: AuditService,
    private eventBus: DomainEventBus,
    private insuranceCoversService: InsuranceCoversService,
  ) {}

  async createInvoice(
    tenantDataSource: DataSource,
    tenantId: string,
    dto: CreateInvoiceDto,
    actingUserId: string,
  ): Promise<Invoice> {
    const invoiceRepo = tenantDataSource.getRepository(Invoice);
    const lineItemRepo = tenantDataSource.getRepository(InvoiceLineItem);

    const total = dto.lineItems.reduce((sum, li) => sum + li.unitPrice * (li.quantity ?? 1), 0);

    // Validate any referenced cover(s) up front - active, and actually
    // belongs to this patient. Better to fail loudly here than create
    // an invoice pointing at a stale or mismatched policy.
    if (dto.primaryCoverId) {
      const cover = await this.insuranceCoversService.findActiveForBilling(tenantDataSource, dto.primaryCoverId);
      if (cover.patientId !== dto.patientId) {
        throw new BadRequestException('primaryCoverId does not belong to this patient');
      }
    }
    if (dto.secondaryCoverId) {
      const cover = await this.insuranceCoversService.findActiveForBilling(tenantDataSource, dto.secondaryCoverId);
      if (cover.patientId !== dto.patientId) {
        throw new BadRequestException('secondaryCoverId does not belong to this patient');
      }
    }

    const hasCover = Boolean(dto.primaryCoverId || dto.secondaryCoverId);
    const payerCoveredAmount = dto.estimatedPayerCoveredAmount ?? 0;
    const patientResponsibility = Math.max(total - payerCoveredAmount, 0);

    const invoice = await invoiceRepo.save(
      invoiceRepo.create({
        patientId: dto.patientId,
        appointmentId: dto.appointmentId,
        currency: dto.currency ?? 'KES',
        totalAmount: total.toFixed(2),
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
        primaryCoverId: dto.primaryCoverId,
        secondaryCoverId: dto.secondaryCoverId,
        claimStatus: hasCover ? ClaimStatus.PENDING_SUBMISSION : ClaimStatus.NOT_APPLICABLE,
        payerCoveredAmount: payerCoveredAmount.toFixed(2),
        patientResponsibility: patientResponsibility.toFixed(2),
      }),
    );

    await lineItemRepo.save(
      dto.lineItems.map((li) =>
        lineItemRepo.create({
          invoiceId: invoice.id,
          description: li.description,
          quantity: li.quantity ?? 1,
          unitPrice: li.unitPrice.toFixed(2),
          sourceType: li.sourceType,
          sourceId: li.sourceId,
        }),
      ),
    );

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'invoice.created',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      metadata: { totalAmount: invoice.totalAmount, hasCover, primaryCoverId: dto.primaryCoverId },
    });

    // Payroll reconciliation and Automation Suite approval workflows
    // both subscribe to this per the architecture doc's event table.
    await this.eventBus.publish(tenantDataSource, tenantId, 'invoice.generated', {
      invoiceId: invoice.id,
      patientId: invoice.patientId,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      hasCover,
    });

    if (hasCover) {
      // Automation Suite hook: route to a claims-submission workflow/queue.
      await this.eventBus.publish(tenantDataSource, tenantId, 'invoice.claim_pending', {
        invoiceId: invoice.id,
        primaryCoverId: dto.primaryCoverId,
        secondaryCoverId: dto.secondaryCoverId,
      });
    }

    return invoice;
  }

  async findOne(tenantDataSource: DataSource, id: string): Promise<Invoice & { lineItems: InvoiceLineItem[] }> {
    const invoice = await tenantDataSource.getRepository(Invoice).findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const lineItems = await tenantDataSource.getRepository(InvoiceLineItem).find({ where: { invoiceId: id } });
    return { ...invoice, lineItems };
  }

  async findByPatient(tenantDataSource: DataSource, patientId: string): Promise<Invoice[]> {
    return tenantDataSource.getRepository(Invoice).find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  /** Direct payment FROM THE PATIENT - cash, M-Pesa, card, etc. */
  async recordPayment(
    tenantDataSource: DataSource,
    tenantId: string,
    id: string,
    dto: RecordPaymentDto,
    actingUserId: string,
  ): Promise<Invoice> {
    const repo = tenantDataSource.getRepository(Invoice);
    const invoice = await repo.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Cannot record payment against a void invoice');
    }

    invoice.amountPaid = (parseFloat(invoice.amountPaid) + dto.amount).toFixed(2);
    const saved = await this.applySettlementStatus(tenantDataSource, invoice);

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'invoice.payment_recorded',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      metadata: { amount: dto.amount, newStatus: saved.status },
    });

    if (saved.status === InvoiceStatus.PAID) {
      await this.eventBus.publish(tenantDataSource, tenantId, 'invoice.paid', { invoiceId: invoice.id, patientId: invoice.patientId });
    }

    return saved;
  }

  /**
   * Progresses a claim through adjudication - staff update this as the
   * payer responds (submitted -> approved/rejected/partially_approved -> paid).
   * Separate from recordPayment because this is money coming from the
   * PAYER, not the patient, and a claim can be updated multiple times
   * (e.g. approved now, disbursed later) independent of anything the
   * patient does.
   */
  async updateClaim(
    tenantDataSource: DataSource,
    tenantId: string,
    id: string,
    dto: UpdateClaimDto,
    actingUserId: string,
  ): Promise<Invoice> {
    const repo = tenantDataSource.getRepository(Invoice);
    const invoice = await repo.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (!invoice.primaryCoverId && !invoice.secondaryCoverId) {
      throw new BadRequestException('This invoice has no insurance cover attached - nothing to claim');
    }

    const previousStatus = invoice.claimStatus;
    invoice.claimStatus = dto.claimStatus;

    if (dto.payerCoveredAmount !== undefined) {
      invoice.payerCoveredAmount = dto.payerCoveredAmount.toFixed(2);
      invoice.patientResponsibility = Math.max(
        parseFloat(invoice.totalAmount) - dto.payerCoveredAmount,
        0,
      ).toFixed(2);
    }

    if (dto.additionalAmountReceived) {
      invoice.amountReceivedFromPayer = (parseFloat(invoice.amountReceivedFromPayer) + dto.additionalAmountReceived).toFixed(2);
    }

    const saved = await this.applySettlementStatus(tenantDataSource, invoice);

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'invoice.claim_updated',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      metadata: { from: previousStatus, to: dto.claimStatus, payerCoveredAmount: invoice.payerCoveredAmount },
    });

    await this.eventBus.publish(tenantDataSource, tenantId, 'invoice.claim_status_changed', {
      invoiceId: invoice.id,
      patientId: invoice.patientId,
      claimStatus: dto.claimStatus,
    });

    return saved;
  }

  /**
   * Recomputes overall invoice status from total settlement - patient
   * payments PLUS payer disbursements, against the invoice total. Both
   * recordPayment and updateClaim funnel through here so the two money
   * flows are always evaluated together, not independently.
   */
  private async applySettlementStatus(tenantDataSource: DataSource, invoice: Invoice): Promise<Invoice> {
    const totalSettled = parseFloat(invoice.amountPaid) + parseFloat(invoice.amountReceivedFromPayer);
    invoice.status = totalSettled >= parseFloat(invoice.totalAmount) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
    if (totalSettled === 0) {
      invoice.status = InvoiceStatus.ISSUED;
    }
    return tenantDataSource.getRepository(Invoice).save(invoice);
  }
}
