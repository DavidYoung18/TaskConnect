import { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatTimestamp } from '../lib/format';
import Modal from './Modal';
import type { SupportTicket, TicketMessage, TicketStatus } from '../lib/types';

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

interface SupportTicketModalProps {
  ticket: SupportTicket;
  onClose: () => void;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
}

export default function SupportTicketModal({ ticket, onClose, onStatusChange }: SupportTicketModalProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);

  useEffect(() => {
    loadMessages();
  }, [ticket.id]);

  async function loadMessages() {
    setLoading(true);
    const snap = await getDocs(
      query(collection(db, 'supportTickets', ticket.id, 'messages'), orderBy('createdAt', 'asc')),
    );
    setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TicketMessage, 'id'>) })));
    setLoading(false);
  }

  async function handleStatusChange(next: TicketStatus) {
    setStatus(next);
    await updateDoc(doc(db, 'supportTickets', ticket.id), { status: next, updatedAt: serverTimestamp() });
    onStatusChange(ticket.id, next);
  }

  async function handleSendReply() {
    const trimmed = reply.trim();
    if (!trimmed || sending) return;
    setSending(true);
    await addDoc(collection(db, 'supportTickets', ticket.id, 'messages'), {
      senderId: 'admin',
      senderType: 'admin',
      text: trimmed,
      createdAt: serverTimestamp(),
    });
    // Admin replies don't reopen a resolved ticket the way a user message does on
    // the mobile side (src/lib/supportTickets.ts) — a reply after marking
    // something resolved is just a follow-up note, not a sign the issue reopened.
    await updateDoc(doc(db, 'supportTickets', ticket.id), { updatedAt: serverTimestamp() });
    setReply('');
    setSending(false);
    await loadMessages();
  }

  function senderLabel(m: TicketMessage): string {
    if (m.senderType === 'admin') return 'Support (You)';
    return ticket.userName || m.senderId;
  }

  return (
    <Modal title={`Ticket: ${ticket.subject}`} onClose={onClose}>
      <section className="detail-section">
        <h3>Details</h3>
        <dl className="detail-grid">
          <dt>User</dt>
          <dd>
            {ticket.userName} <span className={`type-pill type-${ticket.userType}`}>{ticket.userType}</span>
          </dd>
          <dt>Created</dt>
          <dd>{formatTimestamp(ticket.createdAt)}</dd>
          <dt>Last update</dt>
          <dd>{formatTimestamp(ticket.updatedAt)}</dd>
          <dt>Status</dt>
          <dd>
            <select
              className="status-select"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </dd>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Messages</h3>
        {loading ? (
          <p className="detail-empty">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="detail-empty">No messages yet</p>
        ) : (
          <div className="chat-log">
            {messages.map((m) => (
              <div key={m.id} className={`chat-message${m.senderType === 'admin' ? ' chat-message-admin' : ''}`}>
                <div className="chat-message-header">
                  <span className="chat-sender">{senderLabel(m)}</span>
                  <span className="chat-time">{formatTimestamp(m.createdAt)}</span>
                </div>
                <div className="chat-text">{m.text}</div>
              </div>
            ))}
          </div>
        )}

        <div className="reply-row">
          <textarea
            className="reply-input"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply…"
            rows={3}
          />
          <button
            type="button"
            className="reply-send-btn"
            onClick={handleSendReply}
            disabled={!reply.trim() || sending}
          >
            {sending ? 'Sending…' : 'Send Reply'}
          </button>
        </div>
      </section>
    </Modal>
  );
}
