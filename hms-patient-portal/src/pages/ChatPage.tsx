import { FormEvent, useState } from 'react';
import { api, ApiError } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi — I can help with questions about your appointments, prescriptions, or lab results on file. What would you like to know?' },
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages((m) => [...m, userMessage]);
    setInput('');
    setLoading(true);
    try {
      const result = await api.post<{ conversationId: string; reply: string | null; needsHuman: boolean }>('/patient-portal/chat', {
        conversationId,
        message: userMessage.content,
      });
      setConversationId(result.conversationId);
      if (result.reply) {
        setMessages((m) => [...m, { role: 'assistant', content: result.reply as string }]);
      }
      if (result.needsHuman) {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: 'I\u2019ve flagged this for our staff to follow up with you directly.' },
        ]);
      }
    } catch (err) {
      setError((err as ApiError).message || 'Could not send that — try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="eyebrow">Assistant</div>
      <h1 style={{ marginBottom: 'var(--space-4)' }}>Chat</h1>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 'var(--space-4)' }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-bubble--${m.role === 'user' ? 'user' : 'ai'}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="chat-bubble chat-bubble--ai">…</div>}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          style={{ flex: 1, padding: 'var(--space-3)', border: '1px solid var(--paper-line)', borderRadius: 'var(--radius-sm)' }}
        />
        <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}
