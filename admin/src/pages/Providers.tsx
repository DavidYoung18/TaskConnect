import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useCategoryMap } from '../lib/useCategoryMap';
import type { Booking, User } from '../lib/types';

interface ProviderRow {
  id: string;
  name: string;
  email: string;
  categoryId: string | null;
  jobsCompleted: number;
}

export default function Providers() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const categoryMap = useCategoryMap();

  useEffect(() => {
    async function load() {
      const providersSnap = await getDocs(query(collection(db, 'users'), where('userType', '==', 'provider')));
      const providers = providersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<User, 'id'>) }));

      const completedSnap = await getDocs(query(collection(db, 'bookings'), where('status', '==', 'completed')));
      const jobsCount: Record<string, number> = {};
      completedSnap.docs.forEach((d) => {
        const b = d.data() as Booking;
        jobsCount[b.providerId] = (jobsCount[b.providerId] ?? 0) + 1;
      });

      // Registered category comes from each provider's providerServices subcollection
      // (populated during onboarding) — the same source of truth the mobile app uses.
      const categoryEntries = await Promise.all(
        providers.map(async (p) => {
          const servicesSnap = await getDocs(
            query(collection(db, 'users', p.id, 'providerServices'), limit(1)),
          );
          const first = servicesSnap.docs[0]?.data() as { categoryId?: string } | undefined;
          return [p.id, first?.categoryId ?? null] as const;
        }),
      );
      const categoryByProvider = Object.fromEntries(categoryEntries);

      setRows(
        providers.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          categoryId: categoryByProvider[p.id] ?? null,
          jobsCompleted: jobsCount[p.id] ?? 0,
        })),
      );
      setLoading(false);
    }
    load();
  }, []);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.jobsCompleted - a.jobsCompleted),
    [rows],
  );

  if (loading) {
    return <div className="page-loading">Loading providers…</div>;
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">Providers</h1>
        <span className="count-badge">{rows.length} providers</span>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Category</th>
              <th>Jobs Completed</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.categoryId ? categoryMap[r.categoryId] ?? r.categoryId : '—'}</td>
                <td>{r.jobsCompleted}</td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No providers yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
