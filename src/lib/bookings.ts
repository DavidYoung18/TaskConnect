import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  getDocs,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { subscribeWithRetry } from '@/lib/firestoreSubscribe';

export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  providerId: string;
  providerName: string;
  categoryId: string;
  subServiceId: string;
  serviceName: string;
  price: number;
  type: 'fixed' | 'hourly' | 'cleaning-company' | 'curtain-company' | 'carpet-company';
  hours: number | null;
  // cleaning-company only — informational intake fields (steps 2-6), not used for
  // matching/filtering, plus the two matching/pricing inputs (cleanersRequested, toolsOption)
  spaceType?: 'apartment' | 'house' | 'commercial';
  squareMeters?: number;
  roomCount?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '9+';
  bathroomCount?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '6+';
  cleaningType?: 'regular' | 'deep' | 'post-construction';
  cleanersRequested?: number;
  toolsOption?: 'customer-provides' | 'company-provides';
  // tv-mounting only — intake fields, same role as the cleaning-company fields above.
  tvCount?: number;
  wallMaterial?: 'brick' | 'concrete' | 'drywall' | 'foam-block';
  // tv-mounting only — one entry per distinct size the customer picked, since a
  // booking can cover several TVs of different sizes at once. subServiceId matches
  // the provider's providerServices doc (tv-32, tv-43, etc.) so its display name is
  // resolved the same way any other sub-service name is, via getSubServiceNameKey.
  tvSizes?: { subServiceId: string; quantity: number; price: number }[];
  addressId: string;
  addressText: string;
  latitude?: number;
  longitude?: number;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'declined' | 'completed' | 'pending_completion' | 'reschedule_pending';
  createdAt: string;
  // Set while status is 'reschedule_pending' — the provider's proposed new date/time,
  // kept alongside the untouched original scheduledDate/scheduledTime so both are visible
  // during the pending decision. Cleared once accepted; deliberately left in place (as a
  // cleanup marker) after a decline — see provider/booking-detail.tsx's reschedule cleanup
  // effect for why the customer's decline can't clear these itself.
  proposedDate?: string;
  proposedStartTime?: string;
  proposedEndTime?: string;
  // Transient hand-off pair, set only for the instant between a customer accepting a
  // reschedule and the provider's own client (the only writer blockedSlots.rules
  // allows) picking up the change — see acceptReschedule's blockedSlots-swap comment
  // in rescheduleActions.ts and the matching cleanup effect in
  // provider/booking-detail.tsx. Absent once that cleanup runs.
  previousScheduledDate?: string;
  previousScheduledTime?: string;
  // Set by proposeReschedule at the moment a reschedule is proposed: true iff the
  // booking was already 'confirmed' (so scheduledDate/scheduledTime were already
  // held in blockedSlots via blockScheduleSlot on accept). False when reschedule is
  // requested straight from a still-'pending' booking — Request Reschedule doubling
  // as the provider's response, skipping accept entirely — which never had a
  // blockedSlots entry to release. Read by both cleanup effects in
  // provider/booking-detail.tsx to decide whether a release is needed at all;
  // cleared once the reschedule resolves (accepted, declined, or reverted).
  rescheduleHadBlockedSlot?: boolean;
  // Set by acceptReschedule (always, for non-cleaning-company bookings) as the signal
  // for provider/booking-detail.tsx's accept-cleanup effect to run — it can't be
  // inferred from previousScheduledDate/previousScheduledTime alone, since those are
  // only present when rescheduleHadBlockedSlot was true. Cleared once that effect runs.
  needsBlockedSlotSync?: boolean;
  // Set to false at creation (a "go check on this" nudge for the customer's own new
  // request) and again whenever the PROVIDER changes this booking's status (accept,
  // decline, mark complete, propose a reschedule). Flipped back to true the next time
  // the customer opens their Bookings tab (see markBookingsSeenByCustomer). Powers the
  // Bookings-tab badge in CustomerBottomNav, the same pattern as the chat unread badge.
  customerViewed?: boolean;
}

export async function getProviderBookings(
  providerId: string,
  statuses: string[],
): Promise<Booking[]> {
  const q = query(
    collection(db, 'bookings'),
    where('providerId', '==', providerId),
    where('status', 'in', statuses),
    orderBy('scheduledDate', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }));
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const snap = await getDoc(doc(db, 'bookings', bookingId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Booking, 'id'>) };
}

export function subscribeToProviderBookings(
  providerId: string,
  statuses: string[],
  callback: (bookings: Booking[]) => void,
): () => void {
  return subscribeWithRetry<Booking[]>(
    (onNext, onError) => {
      const q = query(
        collection(db, 'bookings'),
        where('providerId', '==', providerId),
        where('status', 'in', statuses),
        orderBy('scheduledDate', 'desc'),
      );
      return onSnapshot(
        q,
        (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }))),
        onError,
      );
    },
    callback,
    {
      // Also catches a missing composite index (providerId == / status in / orderBy
      // scheduledDate) — that fails with 'failed-precondition', not covered by the retry
      // above, so it's still logged here rather than failing completely silently.
      onError: (error) => console.error('subscribeToProviderBookings failed:', error),
    },
  );
}

export function subscribeToBooking(
  bookingId: string,
  callback: (booking: Booking | null) => void,
): () => void {
  return subscribeWithRetry<Booking | null>(
    (onNext, onError) =>
      onSnapshot(
        doc(db, 'bookings', bookingId),
        (snap) => onNext(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Booking, 'id'>) } : null),
        onError,
      ),
    callback,
    { onError: (error) => console.error('subscribeToBooking failed:', error) },
  );
}

export async function updateBookingStatus(
  bookingId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  await updateDoc(doc(db, 'bookings', bookingId), { status, ...extra });
}

// Bookings-tab badge count — bookings this customer hasn't looked at since the
// provider last changed their status. See customerViewed on the Booking interface.
export function subscribeToUnseenBookingsCount(
  customerId: string,
  callback: (count: number) => void,
): () => void {
  return subscribeWithRetry<number>(
    (onNext, onError) => {
      const q = query(
        collection(db, 'bookings'),
        where('customerId', '==', customerId),
        where('customerViewed', '==', false),
      );
      return onSnapshot(q, (snap) => onNext(snap.size), onError);
    },
    callback,
    {
      // Same expected sign-out timing gap as subscribeToUnreadChatCount in chats.ts —
      // only log if the user is actually still signed in.
      onError: (error) => {
        if (!auth.currentUser) return;
        console.error('subscribeToUnseenBookingsCount failed:', error);
      },
    },
  );
}

// Called when the customer opens their Bookings tab — clears the badge by marking
// every currently-unseen booking of theirs as viewed.
export async function markBookingsSeenByCustomer(customerId: string): Promise<void> {
  const q = query(
    collection(db, 'bookings'),
    where('customerId', '==', customerId),
    where('customerViewed', '==', false),
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { customerViewed: true })));
}
