import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Category } from '../lib/types';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'categories')).then((snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) })));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="page-loading">Loading categories…</div>;
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">Categories</h1>
        <span className="count-badge">{categories.length} categories</span>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Sub-services</th>
              <th>Hourly</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.description ?? '—'}</td>
                <td>{c.subServices?.length ?? 0}</td>
                <td>{c.hasHourlyOption ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No categories found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
