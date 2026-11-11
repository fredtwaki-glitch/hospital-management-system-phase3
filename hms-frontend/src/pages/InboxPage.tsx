import { useEffect, useState } from 'react';
import { LedgerCard } from '../components/LedgerCard';
import { api, ApiError } from '../lib/api';

interface Conversation {
  id: string;
  channel: string;
  status: string;
  subject?: string;
  supplierName?: string;
  updatedAt: string;
}
interface Message {
  id: string;
  senderType: string;
  content: string;
  isDraft: boolean;
  createdAt: string;
}

export function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<Conversation[]>('/staff/conversations')
      .then(setConversations)
      .catch((err: ApiError) => setError(err.message));
  }
  useEffect(load, []);

  function openConversation(c: Conversation) {
    setSelected(c);
    setReply('');
    api.get<Message[]>(`/staff/conversations/${c.id}/messages`).then(setMessages).catch(() => {});
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    try {
      await api.post(`/staff/conversations/${selected.id}/reply`, { content: reply, setStatus: 'resolved' });
      setReply('');
      openConversation(selected);
      load();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Inbox</div>
          <h1>Conversations</h1>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'var(--space-5)' }}>
        <div>
          {conversations?.length === 0 && <div className="empty-state">Nothing needs attention right now.</div>}
          {conversations?.map((c) => (
            <div key={c.id} onClick={() => openConversation(c)} style={{ cursor: 'pointer' }}>
              <LedgerCard
                tabLabel={c.channel.replace('_', ' ').toUpperCase()}
                stampText={c.status.replace('_', ' ')}
                stampVariant={c.status === 'awaiting_human' ? 'pending' : c.status === 'resolved' ? 'active' : 'pending'}
              >
                <div style={{ fontSize: 'var(--text-sm)' }}>{c.subject || c.supplierName || '(no subject)'}</div>
              </LedgerCard>
            </div>
          ))}
        </div>

        {selected && (
          <div className="ledger-card" style={{ marginTop: 'var(--space-3)' }}>
            <span className="ledger-card__tab">THREAD</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: 400, overflowY: 'auto' }}>
              {messages.map((m) => (
                <div key={m.id} style={{ fontSize: 'var(--text-sm)' }}>
                  <div className="eyebrow">
                    {m.senderType} {m.isDraft ? '· draft' : ''}
                  </div>
                  <div>{m.content}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" style={{ flex: 1, padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--paper-line)', borderRadius: 'var(--radius-sm)' }} />
              <button onClick={sendReply} className="btn btn-primary">
                Send &amp; resolve
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
