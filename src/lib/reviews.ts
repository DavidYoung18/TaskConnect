import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function hasReviewForBooking(bookingId: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, 'reviews'), where('bookingId', '==', bookingId), limit(1)));
  return !snap.empty;
}
