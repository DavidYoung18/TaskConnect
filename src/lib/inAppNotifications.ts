import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { subscribeWithRetry } from '@/lib/firestoreSubscribe';

// Mirrors the real events the app already pushes OS notifications for (see the
// notifyCustomer/notifyProvider call sites in provider/booking-detail.tsx and
// rescheduleActions.ts) — this is the same set of moments, just also persisted so
// the customer has a browsable history, not only a transient push + tab badge count.
export type NotificationType =
  | 'booking_confirmed'
  | 'booking_declined'
  | 'completion_requested'
  | 'reschedule_proposed'
  | 'review_reminder';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  bookingId: string;
  providerName: string;
  read: boolean;
  createdAt: string;
}

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  bookingId: string;
  providerName: string;
}): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    ...params,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

// Single-field query (userId only) + client-side sort, same tradeoff bookings.tsx
// already makes deliberately — avoids depending on a composite index being deployed.
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void,
): () => void {
  return subscribeWithRetry<AppNotification[]>(
    (onNext, onError) =>
      onSnapshot(
        query(collection(db, 'notifications'), where('userId', '==', userId)),
        (snap) => {
          const results = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }));
          results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          onNext(results.slice(0, 50));
        },
        onError,
      ),
    callback,
    {
      onError: (error) => {
        if (auth.currentUser) console.error('subscribeToNotifications failed:', error);
      },
    },
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}
