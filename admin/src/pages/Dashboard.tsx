import { useEffect, useState } from 'react';
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { formatDate, formatMoney } from '../lib/format';
import type { Booking } from '../lib/types';

interface DashboardStats {
  totalUsers: number;
  totalProviders: number;
  totalCustomers: number;
  totalBookings: number;
  platformRevenue: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const usersRef = collection(db, 'users');
      const bookingsRef = collection(db, 'bookings');

      const [usersCount, providersCount, customersCount, bookingsCount, recentSnap, completedSnap] =
        await Promise.all([
          getCountFromServer(usersRef),
          getCountFromServer(query(usersRef, where('userType', '==', 'provider'))),
          getCountFromServer(query(usersRef, where('userType', '==', 'customer'))),
          getCountFromServer(bookingsRef),
          getDocs(query(bookingsRef, orderBy('createdAt', 'desc'), limit(10))),
          getDocs(query(bookingsRef, where('status', '==', 'completed'))),
        ]);

      const platformRevenue = completedSnap.docs.reduce(
        (sum, d) => sum + (Number((d.data() as Booking).price) || 0),
        0,
      );

      setStats({
        totalUsers: usersCount.data().count,
        totalProviders: providersCount.data().count,
        totalCustomers: customersCount.data().count,
        totalBookings: bookingsCount.data().count,
        platformRevenue,
      });
      setRecentBookings(
        recentSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) })),
      );
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !stats) {
    return <div className="page-loading">Loading dashboard…</div>;
  }

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      <div className="stat-grid">
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Total Providers" value={stats.totalProviders} />
        <StatCard label="Total Customers" value={stats.totalCustomers} />
        <StatCard label="Total Bookings" value={stats.totalBookings} />
        <StatCard label="Platform Revenue" value={formatMoney(stats.platformRevenue)} />
      </div>

      <h2 className="section-title">Recent Bookings</h2>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Provider</th>
              <th>Service</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentBookings.map((b) => (
              <tr key={b.id}>
                <td>{b.customerName}</td>
                <td>{b.providerName}</td>
                <td>{b.serviceName}</td>
                <td>
                  <StatusBadge status={b.status} />
                </td>
                <td>{formatDate(b.scheduledDate, b.scheduledTime)}</td>
              </tr>
            ))}
            {recentBookings.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No bookings yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
