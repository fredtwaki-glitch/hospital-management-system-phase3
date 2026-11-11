import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LedgerCard, stampVariantForStatus } from '../components/LedgerCard';
import { LedgerSteps } from '../components/LedgerSteps';
import { api, ApiError } from '../lib/api';
import { Invoice } from '../lib/types';

interface MpesaTransaction {
  id: string;
  status: string;
  phoneNumber: string;
  amount: string;
  mpesaReceiptNumber?: string;
  resultDescription?: string;
  createdAt: string;
}

const CLAIM_STATUSES = ['pending_submission', 'submitted', 'partially_approved', 'approved', 'rejected', 'paid'];

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [mpesaTransactions, setMpesaTransactions] = useState<MpesaTransaction[]>([]);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaMessage, setMpesaMessage] = useState<string | null>(null);
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [claimStatus, setClaimStatus] = useState('submitted');
  const [payerCoveredAmount, setPayerCoveredAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!id) return;
    api.get<Invoice>(`/invoices/${id}`).then(setInvoice).catch((err: ApiError) => setError(err.message));
    api
      .get<MpesaTransaction[]>(`/invoices/${id}/mpesa-transactions`)
      .then(setMpesaTransactions)
      .catch(() => {});
  }

  useEffect(load, [id]);

  async function handleStkPush(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setMpesaMessage(null);
    setError(null);
    setMpesaLoading(true);
    try {
      const result = await api.post<{ customerMessage: string }>(`/invoices/${id}/mpesa/stk-push`, { phoneNumber: mpesaPhone });
      setMpesaMessage(result.customerMessage || 'Payment prompt sent to the patient\u2019s phone.');
      load();
    } catch (err) {
      setError((err as ApiError).message || 'Could not send M-Pesa prompt');
    } finally {
      setMpesaLoading(false);
    }
  }

  async function handlePayment(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await api.post(`/invoices/${id}/payments`, { amount: Number(paymentAmount) });
      setPaymentAmount('');
      setSuccess('Payment recorded.');
      load();
    } catch (err) {
      setError((err as ApiError).message || 'Could not record payment');
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimUpdate(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await api.patch(`/invoices/${id}/claim`, {
        claimStatus,
        payerCoveredAmount: payerCoveredAmount ? Number(payerCoveredAmount) : undefined,
      });
      setSuccess('Claim updated.');
      load();
    } catch (err) {
      setError((err as ApiError).message || 'Could not update claim');
    } finally {
      setLoading(false);
    }
  }

  if (error && !invoice) return <div className="error-banner">{error}</div>;
  if (!invoice) return <p style={{ color: 'var(--ink-soft)' }}>Loading…</p>;

  const outstanding = parseFloat(invoice.totalAmount) - parseFloat(invoice.amountPaid) - parseFloat(invoice.amountReceivedFromPayer);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Bill</div>
          <h1>Invoice</h1>
        </div>
      </div>

      <LedgerSteps current={2} />

      <LedgerCard tabLabel="C · BILL" stampText={invoice.status.replace('_', ' ')} stampVariant={stampVariantForStatus(invoice.status)}>
        {invoice.lineItems?.map((li) => (
          <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 'var(--text-sm)' }}>
            <span>
              {li.description} {li.quantity && li.quantity > 1 ? `× ${li.quantity}` : ''}
            </span>
            <span className="mono">KES {li.unitPrice}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid var(--paper-line)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)' }}>
          <Row label="Total" value={`${invoice.currency} ${invoice.totalAmount}`} strong />
          <Row label="Patient paid" value={`${invoice.currency} ${invoice.amountPaid}`} />
          {parseFloat(invoice.amountReceivedFromPayer) > 0 && (
            <Row label="Received from payer" value={`${invoice.currency} ${invoice.amountReceivedFromPayer}`} />
          )}
          <Row label="Outstanding" value={`${invoice.currency} ${outstanding.toFixed(2)}`} strong />
        </div>
      </LedgerCard>

      {invoice.claimStatus !== 'not_applicable' && (
        <form onSubmit={handleClaimUpdate} className="ledger-card">
          <span className="ledger-card__tab">CLAIM</span>
          <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
            Current status: <strong style={{ color: 'var(--ink)' }}>{invoice.claimStatus.replace('_', ' ')}</strong> · Covered so far: {invoice.currency} {invoice.payerCoveredAmount}
          </div>
          <div className="field-row">
            <div className="field">
              <label>Update status</label>
              <select value={claimStatus} onChange={(e) => setClaimStatus(e.target.value)}>
                {CLAIM_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Payer covered amount ({invoice.currency})</label>
              <input type="number" min={0} value={payerCoveredAmount} onChange={(e) => setPayerCoveredAmount(e.target.value)} placeholder="leave blank to keep current" />
            </div>
          </div>
          <button type="submit" className="btn btn-secondary" disabled={loading}>
            {loading ? 'Updating…' : 'Update claim'}
          </button>
        </form>
      )}

      {outstanding > 0 && invoice.status !== 'void' && (
        <form onSubmit={handleStkPush} className="ledger-card">
          <span className="ledger-card__tab">M-PESA</span>
          {mpesaMessage && (
            <div style={{ color: 'var(--baraka)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
              {mpesaMessage} Ask the patient to check their phone and enter their PIN, then press "Refresh" below once
              they confirm.
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1 }}>
              <label htmlFor="mpesaPhone">Patient's phone (2547XXXXXXXX)</label>
              <input
                id="mpesaPhone"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                placeholder="254712345678"
                pattern="254(7|1)\d{8}"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={mpesaLoading}>
              {mpesaLoading ? 'Sending…' : `Send M-Pesa prompt for ${invoice.currency} ${outstanding.toFixed(2)}`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={load}>
              Refresh
            </button>
          </div>

          {mpesaTransactions.length > 0 && (
            <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--paper-line)', paddingTop: 'var(--space-3)' }}>
              {mpesaTransactions.map((tx) => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', padding: '4px 0' }}>
                  <span>
                    {tx.phoneNumber} · {tx.mpesaReceiptNumber || tx.resultDescription || 'awaiting confirmation'}
                  </span>
                  <span className="mono">
                    {invoice.currency} {tx.amount} · {tx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </form>
      )}

      {outstanding > 0 && invoice.status !== 'void' && (
        <form onSubmit={handlePayment} className="ledger-card">
          <span className="ledger-card__tab">RECORD CASH / OTHER PAYMENT</span>
          {error && <div className="error-banner">{error}</div>}
          {success && (
            <div style={{ color: 'var(--baraka)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{success}</div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1 }}>
              <label htmlFor="amount">Amount received ({invoice.currency})</label>
              <input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Recording…' : 'Record payment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>{label}</span>
      <span className="mono" style={{ fontWeight: strong ? 700 : 400 }}>
        {value}
      </span>
    </div>
  );
}
