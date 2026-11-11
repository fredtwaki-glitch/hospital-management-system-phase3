import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { SYSTEM_ACTOR_ID } from '../audit/system-actor';
import { BillingService } from '../billing/billing.service';
import { Invoice } from '../billing/invoice.entity';
import { Patient } from '../patients/patient.entity';
import { MpesaClientService } from './mpesa-client.service';
import { MpesaTransaction, MpesaTransactionStatus, MpesaTransactionType } from './mpesa-transaction.entity';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(
    private mpesaClient: MpesaClientService,
    private auditService: AuditService,
    private billingService: BillingService,
  ) {}

  /** Staff-initiated: patient is at the till, collecting a co-pay via STK push. */
  async initiateStkPush(
    tenantDataSource: DataSource,
    tenantId: string,
    tenantSlug: string,
    invoiceId: string,
    phoneNumber: string,
    actingUserId: string,
    callbackBaseUrl: string,
  ): Promise<{ transactionId: string; customerMessage: string }> {
    const invoice = await tenantDataSource.getRepository(Invoice).findOne({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const outstanding =
      parseFloat(invoice.totalAmount) - parseFloat(invoice.amountPaid) - parseFloat(invoice.amountReceivedFromPayer);
    if (outstanding <= 0) {
      throw new BadRequestException('This invoice has nothing outstanding to collect');
    }

    const stkResult = await this.mpesaClient.stkPush({
      phoneNumber,
      amount: outstanding,
      accountReference: invoice.id,
      transactionDesc: `Invoice ${invoice.id}`,
      // Tenant is embedded in the path since Safaricom's callback carries
      // none of our custom headers - see MpesaCallbackController.
      callbackUrl: `${callbackBaseUrl}/mpesa/callback/${tenantSlug}`,
    });

    const txRepo = tenantDataSource.getRepository(MpesaTransaction);
    const transaction = await txRepo.save(
      txRepo.create({
        invoiceId: invoice.id,
        transactionType: MpesaTransactionType.STK_PUSH,
        status: MpesaTransactionStatus.INITIATED,
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId,
        phoneNumber,
        amount: outstanding.toFixed(2),
      }),
    );

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'mpesa.stk_push_initiated',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      metadata: { transactionId: transaction.id, phoneNumber, amount: outstanding },
    });

    return { transactionId: transaction.id, customerMessage: stkResult.customerMessage };
  }

  /**
   * Safaricom's async result for an STK push. This is the ONE place
   * that turns an M-Pesa payment into an actual invoice payment - it
   * calls the exact same BillingService.recordPayment that a staff
   * member manually recording cash would call, so both payment paths
   * settle invoices identically.
   */
  async handleStkCallback(tenantDataSource: DataSource, tenantId: string, body: any): Promise<void> {
    const callback = body?.Body?.stkCallback;
    if (!callback) {
      this.logger.warn('Received malformed STK callback payload');
      return;
    }

    const txRepo = tenantDataSource.getRepository(MpesaTransaction);
    const transaction = await txRepo.findOne({ where: { checkoutRequestId: callback.CheckoutRequestID } });
    if (!transaction) {
      this.logger.warn(`No matching transaction for CheckoutRequestID ${callback.CheckoutRequestID}`);
      return;
    }

    transaction.rawCallbackPayload = body;

    if (callback.ResultCode === 0) {
      const items: Array<{ Name: string; Value: unknown }> = callback.CallbackMetadata?.Item ?? [];
      const getItem = (name: string) => items.find((i) => i.Name === name)?.Value;

      transaction.status = MpesaTransactionStatus.COMPLETED;
      transaction.mpesaReceiptNumber = String(getItem('MpesaReceiptNumber') ?? '');
      await txRepo.save(transaction);

      await this.auditService.record(tenantDataSource, {
        userId: SYSTEM_ACTOR_ID,
        action: 'mpesa.stk_push_completed',
        resourceType: 'Invoice',
        resourceId: transaction.invoiceId,
        metadata: { transactionId: transaction.id, receiptNumber: transaction.mpesaReceiptNumber },
      });

      if (transaction.invoiceId) {
        await this.billingService.recordPayment(
          tenantDataSource,
          tenantId,
          transaction.invoiceId,
          { amount: parseFloat(transaction.amount) },
          SYSTEM_ACTOR_ID,
        );
      }
    } else {
      transaction.status =
        callback.ResultCode === 1032 ? MpesaTransactionStatus.CANCELLED : MpesaTransactionStatus.FAILED;
      transaction.resultDescription = callback.ResultDesc;
      await txRepo.save(transaction);

      await this.auditService.record(tenantDataSource, {
        userId: SYSTEM_ACTOR_ID,
        action: 'mpesa.stk_push_failed',
        resourceType: 'Invoice',
        resourceId: transaction.invoiceId,
        metadata: { transactionId: transaction.id, resultDesc: callback.ResultDesc },
      });
    }
  }

  /**
   * C2B validation - Safaricom asks "should this payment be allowed to
   * proceed" BEFORE money moves. We accept broadly rather than reject:
   * rejecting stops a patient's payment from going through at all, which
   * is a worse failure mode than accepting a payment we can't yet match
   * to an invoice (that gets reconciled afterward - see
   * handleC2bConfirmation and listUnmatched).
   */
  async handleC2bValidation(): Promise<{ ResultCode: number; ResultDesc: string }> {
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  /**
   * C2B confirmation - fires AFTER money has already moved, so unlike
   * the STK flow there's no "reject" path here, only "record and try to
   * match." Matches on BillRefNumber (what the patient typed as the
   * account number) against an invoice id first, then a patient MRN's
   * most recent outstanding invoice as a fallback.
   */
  async handleC2bConfirmation(tenantDataSource: DataSource, tenantId: string, body: any): Promise<void> {
    const billRefNumber: string = (body.BillRefNumber || '').trim();
    const amount = parseFloat(body.TransAmount);
    const phoneNumber = body.MSISDN;
    const mpesaReceiptNumber = body.TransID;

    const invoice = await this.matchInvoiceForC2b(tenantDataSource, billRefNumber);

    const txRepo = tenantDataSource.getRepository(MpesaTransaction);
    const transaction = await txRepo.save(
      txRepo.create({
        invoiceId: invoice?.id,
        transactionType: MpesaTransactionType.C2B,
        status: MpesaTransactionStatus.COMPLETED,
        mpesaReceiptNumber,
        phoneNumber,
        amount: amount.toFixed(2),
        rawCallbackPayload: body,
      }),
    );

    await this.auditService.record(tenantDataSource, {
      userId: SYSTEM_ACTOR_ID,
      action: 'mpesa.c2b_payment_received',
      resourceType: 'Invoice',
      resourceId: invoice?.id,
      metadata: { transactionId: transaction.id, billRefNumber, matched: Boolean(invoice) },
    });

    if (invoice) {
      await this.billingService.recordPayment(tenantDataSource, tenantId, invoice.id, { amount }, SYSTEM_ACTOR_ID);
    } else {
      this.logger.warn(`C2B payment ${mpesaReceiptNumber} (ref "${billRefNumber}") could not be matched to an invoice - needs manual reconciliation`);
    }
  }

  private async matchInvoiceForC2b(tenantDataSource: DataSource, billRefNumber: string): Promise<Invoice | null> {
    if (!billRefNumber) return null;

    const invoiceRepo = tenantDataSource.getRepository(Invoice);

    // Try as a direct invoice id first (what we ask patients to use as
    // the account number when billing hands them a reference).
    const byId = await invoiceRepo.findOne({ where: { id: billRefNumber } });
    if (byId) return byId;

    // Fall back to MRN - patients paying ahead of a visit, before an
    // invoice necessarily exists yet, may only have their MRN to quote.
    const patient = await tenantDataSource.getRepository(Patient).findOne({ where: { mrn: billRefNumber } });
    if (!patient) return null;

    return invoiceRepo.findOne({
      where: { patientId: patient.id },
      order: { createdAt: 'DESC' },
    });
  }

  async listUnmatched(tenantDataSource: DataSource): Promise<MpesaTransaction[]> {
    return tenantDataSource
      .getRepository(MpesaTransaction)
      .createQueryBuilder('tx')
      .where('tx.invoiceId IS NULL')
      .andWhere('tx.status = :status', { status: MpesaTransactionStatus.COMPLETED })
      .orderBy('tx.createdAt', 'DESC')
      .getMany();
  }

  async linkToInvoice(
    tenantDataSource: DataSource,
    tenantId: string,
    transactionId: string,
    invoiceId: string,
    actingUserId: string,
  ): Promise<MpesaTransaction> {
    const txRepo = tenantDataSource.getRepository(MpesaTransaction);
    const transaction = await txRepo.findOne({ where: { id: transactionId } });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    if (transaction.invoiceId) {
      throw new BadRequestException('This transaction is already linked to an invoice');
    }

    const invoice = await tenantDataSource.getRepository(Invoice).findOne({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    transaction.invoiceId = invoiceId;
    const saved = await txRepo.save(transaction);

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'mpesa.transaction_manually_linked',
      resourceType: 'Invoice',
      resourceId: invoiceId,
      metadata: { transactionId },
    });

    // Manual reconciliation still settles the invoice the normal way.
    await this.billingService.recordPayment(
      tenantDataSource,
      tenantId,
      invoiceId,
      { amount: parseFloat(transaction.amount) },
      actingUserId,
    );

    return saved;
  }

  async findByInvoice(tenantDataSource: DataSource, invoiceId: string): Promise<MpesaTransaction[]> {
    return tenantDataSource.getRepository(MpesaTransaction).find({ where: { invoiceId }, order: { createdAt: 'DESC' } });
  }
}
