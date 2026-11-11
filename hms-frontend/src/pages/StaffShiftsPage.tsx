import { useCallback, useEffect, useState } from 'react';
import { LedgerCard } from '../components/LedgerCard';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';

interface StaffShift {
  id: string;
  staffNumber: string;
  startedAt: string;
  endedAt: string | null;
  status: 'in_progress' | 'completed';
  breakMinutes: number;
  minutesWorked: number | null;
  notes: string | null;
}

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

function formatMinutes(minutes: number | null) {
  if (minutes === null) return '—';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function StaffShiftsPage() {
  const { staffUser } = useAuth();
  const isAdmin = staffUser?.role === 'admin';

  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [allShifts, setAllShifts] = useState<StaffShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [notes, setNotes] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const activeShift = shifts.find((shift) => shift.status === 'in_progress');

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      setShifts(await api.get<StaffShift[]>('/staff-shifts/me'));
      if (isAdmin) setAllShifts(await api.get<StaffShift[]>('/staff-shifts'));
    } catch (err) {
      setError(errorMessage(err, 'Could not load shift history'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadShifts();
  }, [loadShifts]);

  // Keep the "running for" counter fresh while a shift is open.
  useEffect(() => {
    if (!activeShift) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [activeShift]);

  async function startShift() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.post<StaffShift>('/staff-shifts/start');
      await loadShifts();
    } catch (err) {
      setError(errorMessage(err, 'Could not start shift'));
    } finally {
      setBusy(false);
    }
  }

  async function completeShift() {
    if (!activeShift) return;
    const minutes = Number(breakMinutes);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
      setError('Break minutes must be a whole number between 0 and 1440.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const done = await api.patch<StaffShift>(`/staff-shifts/${activeShift.id}/complete`, {
        breakMinutes: minutes,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setBreakMinutes('0');
      setNotes('');
      setNotice(`Shift completed — ${formatMinutes(done.minutesWorked)} recorded and sent to payroll.`);
      await loadShifts();
    } catch (err) {
      // Server messages are specific (e.g. "started less than a minute ago",
      // "already completed") - show them as-is.
      setError(errorMessage(err, 'Could not complete shift'));
    } finally {
      setBusy(false);
    }
  }

  const runningMinutes = activeShift
    ? Math.max(0, Math.floor((now - new Date(activeShift.startedAt).getTime()) / 60_000))
    : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Staff management</div>
          <h1>Staff shifts</h1>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && (
        <div className="ledger-card" role="status">
          <span className="ledger-card__tab">DONE</span>
          {notice}
        </div>
      )}

      <LedgerCard
        tabLabel="CURRENT SHIFT"
        stampText={activeShift ? 'in progress' : 'off shift'}
        stampVariant={activeShift ? 'pending' : 'active'}
      >
        {loading ? (
          <p>Loading…</p>
        ) : activeShift ? (
          <>
            <p>
              Started {formatDate(activeShift.startedAt)} · running for <strong>{formatMinutes(runningMinutes)}</strong>
            </p>
            <div className="field-row">
              <div className="field">
                <label htmlFor="break-minutes">Break (minutes)</label>
                <input
                  id="break-minutes"
                  type="number"
                  min={0}
                  max={1440}
                  step={1}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label htmlFor="shift-notes">Notes (optional)</label>
                <input id="shift-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={completeShift} disabled={busy}>
              {busy ? 'Completing…' : 'Complete shift'}
            </button>
          </>
        ) : (
          <>
            <p>You do not have an active shift.</p>
            <button className="btn btn-primary" onClick={startShift} disabled={busy || loading}>
              {busy ? 'Starting…' : 'Start my shift'}
            </button>
          </>
        )}
      </LedgerCard>

      <h2 style={{ marginTop: 'var(--space-6)' }}>My recent shifts</h2>
      {!loading && shifts.length === 0 && <div className="empty-state">No shifts recorded yet.</div>}
      {shifts.map((shift) => (
        <LedgerCard
          key={shift.id}
          tabLabel={shift.status === 'in_progress' ? 'OPEN' : 'CLOSED'}
          stampText={shift.status === 'in_progress' ? 'in progress' : 'completed'}
          stampVariant={shift.status === 'in_progress' ? 'pending' : 'active'}
        >
          <div>
            {formatDate(shift.startedAt)} → {formatDate(shift.endedAt)}
          </div>
          <div className="mono" style={{ fontSize: 'var(--text-xs)', opacity: 0.75 }}>
            worked {formatMinutes(shift.minutesWorked)} · break {shift.breakMinutes} min
            {shift.notes ? ` · ${shift.notes}` : ''}
          </div>
        </LedgerCard>
      ))}

      {isAdmin && (
        <>
          <h2 style={{ marginTop: 'var(--space-6)' }}>All staff (admin)</h2>
          {allShifts.length === 0 ? (
            <div className="empty-state">No shifts recorded in this organization yet.</div>
          ) : (
            <div className="ledger-card data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff no.</th>
                    <th>Started</th>
                    <th>Ended</th>
                    <th>Break</th>
                    <th>Worked</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allShifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="mono">{shift.staffNumber}</td>
                      <td>{formatDate(shift.startedAt)}</td>
                      <td>{formatDate(shift.endedAt)}</td>
                      <td>{shift.breakMinutes} min</td>
                      <td>{formatMinutes(shift.minutesWorked)}</td>
                      <td>{shift.status === 'in_progress' ? 'In progress' : 'Completed'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
