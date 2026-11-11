import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';

interface ClinicalNote {
  id: string;
  noteType: string;
  content: string;
  createdAt: string;
}

const NOTE_TYPES = ['progress', 'consultation', 'discharge', 'nursing'];

export function ClinicalNotesPanel({ patientId }: { patientId: string }) {
  const [notes, setNotes] = useState<ClinicalNote[] | null>(null);
  const [noteType, setNoteType] = useState('progress');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    api
      .get<ClinicalNote[]>(`/clinical-notes?patientId=${patientId}`)
      .then(setNotes)
      .catch((err: ApiError) => setError(err.message));
  }
  useEffect(load, [patientId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/clinical-notes', { patientId, noteType, content });
      setContent('');
      load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit} className="ledger-card">
        <span className="ledger-card__tab">NEW NOTE</span>
        <div className="field-row">
          <div className="field">
            <label>Type</label>
            <select value={noteType} onChange={(e) => setNoteType(e.target.value)}>
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Note</label>
          <textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} required />
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving…' : 'Add note'}
        </button>
      </form>

      {notes?.length === 0 && <div className="empty-state">No clinical notes yet.</div>}
      {notes?.map((n) => (
        <div key={n.id} className="ledger-card">
          <span className="ledger-card__tab">{n.noteType.toUpperCase()}</span>
          <p style={{ whiteSpace: 'pre-wrap' }}>{n.content}</p>
          <div className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 'var(--space-2)' }}>
            {new Date(n.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
