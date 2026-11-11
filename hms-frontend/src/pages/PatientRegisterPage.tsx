import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LedgerSteps } from '../components/LedgerSteps';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import { ApiError } from '../lib/api';
import { Patient } from '../lib/types';

function calculateAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function PatientRegisterPage() {
  const navigate = useNavigate();
  const { submitOrQueue } = useOfflineQueue();
  const [mrn, setMrn] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [guardianFullName, setGuardianFullName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const age = useMemo(() => calculateAge(dateOfBirth), [dateOfBirth]);
  const isMinor = age !== null && age < 18;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { queued, result } = await submitOrQueue<Patient>(
        'patient',
        '/patients',
        {
          mrn,
          firstName,
          lastName,
          dateOfBirth,
          phone: phone || undefined,
          email: email || undefined,
          ...(isMinor ? { guardianFullName, guardianPhone } : {}),
        },
        `${firstName} ${lastName} (MRN ${mrn})`,
      );

      if (queued) {
        // No real patient.id exists yet - it's only created once this
        // syncs. Go back to the list instead, where the queued entry
        // shows up as a pending card (see PatientsListPage).
        navigate('/patients');
      } else if (result) {
        navigate(`/patients/${result.id}`);
      }
    } catch (err) {
      setError((err as ApiError).message || 'Could not register patient');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">New record</div>
          <h1>Register patient</h1>
        </div>
      </div>

      <LedgerSteps current={0} />

      <form onSubmit={handleSubmit} className="ledger-card">
        <span className="ledger-card__tab">A &middot; PATIENT</span>

        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label htmlFor="mrn">Medical record number (MRN)</label>
          <input id="mrn" value={mrn} onChange={(e) => setMrn(e.target.value)} placeholder="MRN-0001" required />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="firstName">First name</label>
            <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>

        <div className="field">
          <label htmlFor="dateOfBirth">Date of birth</label>
          <input
            id="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
          />
          {age !== null && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 'var(--space-1)' }}>
              Age {age}
              {isMinor ? ' — a guardian is required for a minor patient' : ''}
            </div>
          )}
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7…" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        {isMinor && (
          <div
            style={{
              borderLeft: '3px solid var(--marigold)',
              paddingLeft: 'var(--space-4)',
              margin: 'var(--space-5) 0',
            }}
          >
            <h3 style={{ marginBottom: 'var(--space-3)' }}>Guardian</h3>
            <div className="field-row">
              <div className="field">
                <label htmlFor="guardianFullName">Guardian full name</label>
                <input
                  id="guardianFullName"
                  value={guardianFullName}
                  onChange={(e) => setGuardianFullName(e.target.value)}
                  required={isMinor}
                />
              </div>
              <div className="field">
                <label htmlFor="guardianPhone">Guardian phone</label>
                <input
                  id="guardianPhone"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  required={isMinor}
                />
              </div>
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Registering…' : 'Register patient →'}
        </button>
        <OfflineHint />
      </form>
    </div>
  );
}

function OfflineHint() {
  const { isOnline } = useOfflineQueue();
  if (isOnline) return null;
  return (
    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 'var(--space-2)' }}>
      You're offline — this will be queued and synced automatically once your connection returns.
    </p>
  );
}
