import { FormEvent, useEffect, useState } from 'react';
import { LedgerCard } from '../components/LedgerCard';
import { api, ApiError } from '../lib/api';

interface PharmacyItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  unitPrice: string;
  supplier?: string;
}

export function PharmacyPage() {
  const [items, setItems] = useState<PharmacyItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('10');
  const [supplier, setSupplier] = useState('');
  const [loading, setLoading] = useState(false);

  function load() {
    api
      .get<PharmacyItem[]>('/pharmacy/items')
      .then(setItems)
      .catch((err: ApiError) => setError(err.message));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/pharmacy/items', {
        sku,
        name,
        unitPrice: Number(unitPrice),
        reorderThreshold: Number(reorderThreshold),
        supplier: supplier || undefined,
      });
      setSku('');
      setName('');
      setUnitPrice('');
      setSupplier('');
      setShowForm(false);
      load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  async function receive(id: string) {
    const qty = Number(window.prompt('Quantity received?'));
    if (!qty) return;
    try {
      await api.post(`/pharmacy/items/${id}/receive`, { quantity: qty });
      load();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function dispense(id: string) {
    const qty = Number(window.prompt('Quantity to dispense?'));
    const patientId = window.prompt('Patient ID?');
    if (!qty || !patientId) return;
    try {
      await api.post(`/pharmacy/items/${id}/dispense`, { quantity: qty, patientId });
      load();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Inventory</div>
          <h1>Pharmacy</h1>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn btn-primary">
          {showForm ? 'Cancel' : '+ Add item'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="ledger-card">
          <span className="ledger-card__tab">NEW ITEM</span>
          <div className="field-row">
            <div className="field">
              <label>SKU</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} required />
            </div>
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Unit price</label>
              <input type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
            </div>
            <div className="field">
              <label>Reorder threshold</label>
              <input type="number" min={0} value={reorderThreshold} onChange={(e) => setReorderThreshold(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Supplier</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Add item'}
          </button>
        </form>
      )}

      {items?.length === 0 && <div className="empty-state">No pharmacy items yet.</div>}
      {items?.map((item) => (
        <LedgerCard
          key={item.id}
          tabLabel={item.sku}
          stampText={item.quantityOnHand <= item.reorderThreshold ? 'low stock' : 'in stock'}
          stampVariant={item.quantityOnHand <= item.reorderThreshold ? 'alert' : 'active'}
        >
          <div style={{ fontWeight: 600 }}>{item.name}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
            {item.quantityOnHand} {item.unit} on hand · KES {item.unitPrice} each {item.supplier ? `· ${item.supplier}` : ''}
          </div>
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={() => receive(item.id)} className="btn btn-secondary">
              Receive stock
            </button>
            <button onClick={() => dispense(item.id)} className="btn btn-secondary">
              Dispense
            </button>
          </div>
        </LedgerCard>
      ))}
    </div>
  );
}
