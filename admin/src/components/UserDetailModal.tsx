import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate, formatMoney } from '../lib/format';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import type { Booking, User } from '../lib/types';

interface UserDetailModalProps {
  user: User;
  onClose: () => void;
}

export default function UserDetailModal({ user, onClose }: UserDetailModalProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [asCustomerSnap, asProviderSnap, reviewsSnap] = await Promise.all([
        getDocs(query(collection(db, 'bookings'), where('customerId', '==', user.id))),
        getDocs(query(collection(db, 'bookings'), where('providerId', '==', user.id))),
        user.userType === 'provider'
          ? getDocs(query(collection(db, 'reviews'), where('providerId', '==', user.id)))
          : Promise.resolve(null),
      ]);
      if (cancelled) return;

      const byId = new Map<string, Booking>();
      [...asCustomerSnap.docs, ...asProviderSnap.docs].forEach((d) => {
        byId.set(d.id, { id: d.id, ...(d.data() as Omit<Booking, 'id'>) });
      });
      setBookings([...byId.values()].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)));

      if (reviewsSnap) {
        const ratings = reviewsSnap.docs
          .map((d) => Number(d.data().rating) || 0)
          .filter((r) => r > 0);
        setReviewCount(ratings.length);
        setAvgRating(ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null);
      }

      setLoading(false);
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [user.id, user.userType]);

  const totalEarnings = bookings
    .filter((b) => b.providerId === user.id && b.status === 'completed')
    .reduce((sum, b) => sum + (b.price ?? 0), 0);

  return (
    <Modal title="User Details" onClose={onClose}>
      <section className="detail-section">
        <h3>Profile</h3>
        <dl className="detail-grid">
          <dt>Name</dt>
          <dd>{user.name || '—'}</dd>
          <dt>Email</dt>
          <dd>{user.email || '—'}</dd>
          <dt>Phone</dt>
          <dd>{user.phone ?? '—'}</dd>
          <dt>Type</dt>
          <dd>
            <span className={`type-pill type-${user.userType}`}>{user.userType}</span>
          </dd>
          <dt>Joined</dt>
          <dd>{user.createdAt ? formatDate(user.createdAt.slice(0, 10)) : '—'}</dd>
        </dl>
      </section>

      {user.userType === 'provider' && (
        <section className="detail-section">
          <h3>Provider Stats</h3>
          <dl className="detail-grid">
            <dt>Total Earnings</dt>
            <dd>{formatMoney(totalEarnings)}</dd>
            <dt>Average Rating</dt>
            <dd>
              {avgRating !== null
                ? `${avgRating.toFixed(1)} ★ (${reviewCount} review${reviewCount === 1 ? '' : 's'})`
                : 'No ratings yet'}
            </dd>
          </dl>
        </section>
      )}

      <section className="detail-section">
        <h3>Booking History</h3>
        {loading ? (
          <p className="detail-empty">Loading bookings…</p>
        ) : bookings.length === 0 ? (
          <p className="detail-empty">No bookings yet</p>
        ) : (
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Service</th>
                  <th>Date</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.customerId === user.id ? 'Customer' : 'Provider'}</td>
                    <td>{b.serviceName}</td>
                    <td>{formatDate(b.scheduledDate, b.scheduledTime)}</td>
                    <td>{formatMoney(b.price)}</td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Modal>
  );
}
