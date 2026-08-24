import { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate, formatMoney, formatTimestamp } from '../lib/format';
import { useCategoryMap } from '../lib/useCategoryMap';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import type { Booking, BookingStatus, Message, User } from '../lib/types';

const SYSTEM_MESSAGE_LABELS: Record<string, string> = {
  completion_request: 'The provider marked this job as complete.',
  completion_confirmed: 'Job marked as complete.',
  completion_declined: 'Completion declined — job still in progress.',
};

// Bookings in these statuses represent unfinished work a customer forgot to close
// out themselves — everything else (already completed, or declined/cancelled) has
// nothing left for "Force Complete" to do.
const FORCE_COMPLETABLE_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'pending_completion',
  'reschedule_pending',
];

interface BookingDetailModalProps {
  booking: Booking;
  onClose: () => void;
  onUpdated: (booking: Booking) => void;
}

export default function BookingDetailModal({ booking, onClose, onUpdated }: BookingDetailModalProps) {
  const [customer, setCustomer] = useState<User | null>(null);
  const [provider, setProvider] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const categoryMap = useCategoryMap();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [customerSnap, providerSnap, messagesSnap] = await Promise.all([
        getDoc(doc(db, 'users', booking.customerId)),
        getDoc(doc(db, 'users', booking.providerId)),
        getDocs(query(collection(db, 'chats', booking.id, 'messages'), orderBy('sentAt', 'asc'))),
      ]);
      if (cancelled) return;

      setCustomer(customerSnap.exists() ? { id: customerSnap.id, ...(customerSnap.data() as Omit<User, 'id'>) } : null);
      setProvider(providerSnap.exists() ? { id: providerSnap.id, ...(providerSnap.data() as Omit<User, 'id'>) } : null);
      setMessages(messagesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) })));
      setLoading(false);
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [booking.id, booking.customerId, booking.providerId]);

  async function handleForceComplete() {
    if (completing) return;
    const confirmed = window.confirm(
      'Mark this booking as completed? The customer will still be able to leave a review afterward, but this skips their own confirmation step.',
    );
    if (!confirmed) return;

    setCompleting(true);
    await updateDoc(doc(db, 'bookings', booking.id), {
      status: 'completed',
      completedByAdmin: true,
    });
    // Mirrors createNotification() in the mobile app's src/lib/inAppNotifications.ts —
    // same collection/schema, written directly here since the admin app doesn't share
    // that package. This is the customer's only heads-up that the job was closed out
    // and a review is now possible, since they never got the normal in-app "Confirm
    // Completion" prompt for an admin-forced completion.
    await addDoc(collection(db, 'notifications'), {
      userId: booking.customerId,
      type: 'review_reminder',
      bookingId: booking.id,
      providerName: booking.providerName,
      read: false,
      createdAt: new Date().toISOString(),
    });
    setCompleting(false);
    onUpdated({ ...booking, status: 'completed', completedByAdmin: true });
  }

  function senderName(senderId: string): string {
    if (senderId === booking.customerId) return booking.customerName;
    if (senderId === booking.providerId) return booking.providerName;
    return 'Unknown';
  }

  const categoryLabel = categoryMap[booking.categoryId] ?? booking.categoryId;

  return (
    <Modal title="Booking Details" onClose={onClose}>
      <section className="detail-section">
        <h3>Service</h3>
        <dl className="detail-grid">
          <dt>Service</dt>
          <dd>{booking.serviceName}</dd>
          <dt>Category</dt>
          <dd>{categoryLabel}</dd>
          <dt>Date</dt>
          <dd>{formatDate(booking.scheduledDate, booking.scheduledTime)}</dd>
          <dt>Price</dt>
          <dd>{formatMoney(booking.price)}</dd>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={booking.status} />
            {booking.completedByAdmin && <span className="admin-closed-note"> (closed by admin)</span>}
          </dd>
          <dt>Address</dt>
          <dd>{booking.addressText ?? '—'}</dd>
        </dl>

        {FORCE_COMPLETABLE_STATUSES.includes(booking.status) && (
          <button
            type="button"
            className="force-complete-btn"
            onClick={handleForceComplete}
            disabled={completing}
          >
            {completing ? 'Completing…' : 'Force Complete'}
          </button>
        )}
      </section>

      <section className="detail-section">
        <h3>Customer</h3>
        <dl className="detail-grid">
          <dt>Name</dt>
          <dd>{booking.customerName}</dd>
          <dt>Email</dt>
          <dd>{customer?.email ?? '—'}</dd>
          <dt>Phone</dt>
          <dd>{customer?.phone ?? '—'}</dd>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Provider</h3>
        <dl className="detail-grid">
          <dt>Name</dt>
          <dd>{booking.providerName}</dd>
          <dt>Email</dt>
          <dd>{provider?.email ?? '—'}</dd>
          <dt>Phone</dt>
          <dd>{provider?.phone ?? '—'}</dd>
          <dt>Category</dt>
          <dd>{categoryLabel}</dd>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Chat Messages</h3>
        {loading ? (
          <p className="detail-empty">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="detail-empty">No messages yet</p>
        ) : (
          <div className="chat-log">
            {messages.map((m) =>
              m.senderId === 'system' ? (
                <div key={m.id} className="chat-system">
                  {SYSTEM_MESSAGE_LABELS[m.type ?? ''] ?? 'System message'}
                </div>
              ) : (
                <div key={m.id} className="chat-message">
                  <div className="chat-message-header">
                    <span className="chat-sender">{senderName(m.senderId)}</span>
                    <span className="chat-time">{formatTimestamp(m.sentAt)}</span>
                  </div>
                  <div className="chat-text">{m.text}</div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </Modal>
  );
}
