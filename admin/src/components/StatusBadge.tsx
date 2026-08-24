import type { BookingStatus } from '../lib/types';

// Same palette as the mobile app's STATUS_CONFIG (src/app/provider/booking-detail.tsx).
const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#b45309', bg: '#fef3c7' },
  confirmed: { label: 'Confirmed', color: '#065f46', bg: '#d1fae5' },
  completed: { label: 'Completed', color: '#374151', bg: '#f3f4f6' },
  declined: { label: 'Declined', color: '#991b1b', bg: '#fee2e2' },
  pending_completion: { label: 'Awaiting Confirmation', color: '#1e40af', bg: '#dbeafe' },
  reschedule_pending: { label: 'Reschedule Requested', color: '#7c3aed', bg: '#ede9fe' },
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className="status-badge" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  );
}
