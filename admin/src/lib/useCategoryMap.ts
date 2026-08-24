import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Category } from './types';

// Maps categoryId -> human-readable category name, e.g. "cleaning" -> "Cleaning".
export function useCategoryMap(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    getDocs(collection(db, 'categories')).then((snap) => {
      const next: Record<string, string> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as Omit<Category, 'id'>;
        next[d.id] = data.name ?? d.id;
      });
      setMap(next);
    });
  }, []);

  return map;
}
