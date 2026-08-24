import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';
import { getCategoryNameKey } from '@/lib/serviceNames';

interface CategoryRecord {
  id: string;
  rawName: string;
}

// Maps categoryId -> translated category name, e.g. "ac" -> "AC".
export function useCategoryMap(): Record<string, string> {
  const { t } = useTranslation();
  const [records, setRecords] = useState<CategoryRecord[]>([]);

  useEffect(() => {
    getDocs(collection(db, 'categories')).then((snap) => {
      setRecords(
        snap.docs.map((d) => ({ id: d.id, rawName: (d.data().name as string) ?? d.id }))
      );
    });
  }, []);

  const map: Record<string, string> = {};
  for (const { id, rawName } of records) {
    const key = getCategoryNameKey(id);
    map[id] = key ? t(key) : rawName;
  }
  return map;
}
