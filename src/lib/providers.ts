import {
  average,
  collection,
  collectionGroup,
  count,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getWeekAvailability } from '@/lib/availability';
import { parseLocalDate } from '@/lib/dateFormat';

// JS Date.getDay() is 0=Sunday..6=Saturday — maps that to the day-id strings
// DAYS_OF_WEEK/getWeekAvailability use (see src/lib/availability.ts).
const JS_DAY_TO_ID = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export interface ProviderService {
  subServiceId: string;
  name: string;
  type: 'fixed' | 'hourly' | 'cleaning-company' | 'curtain-company' | 'carpet-company';
  price?: number;
  hourlyRate?: number;
  estimatedDuration?: number;
  minHours?: number;
  maxHours?: number;
  // cleaning-company only
  about?: string;
  staffCount?: number;
  rateWithoutTools?: number;
  rateWithTools?: number;
  // curtain-company / carpet-company only (about is shared with cleaning-company above)
  ratePerSqm?: number;
}

export interface CleaningFilters {
  cleanersRequested?: number;
  date?: string;
}

export interface ProviderListing {
  uid: string;
  name: string;
  photoURL: string | null;
  jobsCompleted: number;
  averageRating: number;
  reviewCount: number;
  // Non-null when the provider has at least one hourly service
  hourlyRate: number | null;
  // Non-null for cleaning companies — the cheaper (without-tools) per-cleaner rate,
  // shown as the default listed price. The customer picks their tools tier (and the
  // matching rate) on the company's own profile screen, not during the results list.
  cleaningRate: number | null;
  // Cleaning-company only — always present alongside cleaningRate when applicable
  staffCount: number | null;
  rateWithoutTools: number | null;
  rateWithTools: number | null;
  // Non-null when the provider has a curtain-cleaning company service
  curtainRatePerSqm: number | null;
  // Non-null when the provider has a carpet-cleaning company service
  carpetRatePerSqm: number | null;
  services: ProviderService[];
}

export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
}

export async function getProviderRatingSummary(
  providerId: string,
): Promise<{ averageRating: number; reviewCount: number }> {
  const q = query(collection(db, 'reviews'), where('providerId', '==', providerId));
  const snap = await getAggregateFromServer(q, {
    averageRating: average('rating'),
    reviewCount: count(),
  });
  return {
    averageRating: snap.data().averageRating ?? 0,
    reviewCount: snap.data().reviewCount,
  };
}

export async function getProviderRecentReviews(providerId: string): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    where('providerId', '==', providerId),
    orderBy('createdAt', 'desc'),
    limit(5),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Review, 'id'>) }));
}

export async function getJobsCompleted(providerId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(
      collection(db, 'bookings'),
      where('providerId', '==', providerId),
      where('status', '==', 'completed'),
    ),
  );
  return snap.data().count;
}

export async function getProvidersForCategory(
  categoryId: string,
  filters?: CleaningFilters,
): Promise<ProviderListing[]> {
  // ── 1. Collection-group query across ALL users' providerServices subcollections ──
  // Path: users/{uid}/providerServices/{docId}
  // collectionGroup lets us query every subcollection named 'providerServices' in one
  // round-trip, avoiding a full scan of the users collection + N sub-reads.
  // Requires a Firestore collection-group index on the 'categoryId' field — Firestore
  // will surface a link to create it on the first run if it's missing.
  const q = query(
    collectionGroup(db, 'providerServices'),
    where('categoryId', '==', categoryId),
  );
  const snap = await getDocs(q);

  // ── 2. Group services by provider UID (extracted from the doc path) ──
  const byUid: Record<string, ProviderService[]> = {};
  for (const d of snap.docs) {
    // doc.ref.parent       → CollectionReference  (providerServices)
    // doc.ref.parent.parent → DocumentReference   (users/{uid})
    const uid = d.ref.parent.parent!.id;
    if (!byUid[uid]) byUid[uid] = [];
    byUid[uid].push(d.data() as ProviderService);
  }

  // ── 2b. Filter by cleaning company capacity if provided ──
  // staffCount is already present on the cleaning-company doc fetched in step 1 —
  // no extra reads needed. Both rate tiers always exist once a company completes
  // onboarding, so only capacity needs to be checked here.
  if (filters?.cleanersRequested != null) {
    for (const uid of Object.keys(byUid)) {
      const pkg = byUid[uid].find((s) => s.type === 'cleaning-company');
      if (!pkg || (pkg.staffCount ?? 0) < filters.cleanersRequested) {
        delete byUid[uid];
      }
    }
  }

  // ── 2c. Filter cleaning companies by whether they work on the requested date ──
  // Cleaning companies still set a weekly working-hours schedule (see
  // provider/(tabs)/availability.tsx) even though a booked slot never blocks other
  // customers — this only checks whether the weekday itself is marked as a working
  // day at all, not whether a specific time is free.
  if (categoryId === 'cleaning' && filters?.date) {
    const weekday = JS_DAY_TO_ID[parseLocalDate(filters.date).getDay()];
    const candidateUids = Object.keys(byUid);
    const weeks = await Promise.all(
      candidateUids.map((uid) => getWeekAvailability(uid).catch(() => null)),
    );
    candidateUids.forEach((uid, i) => {
      if (!weeks[i]?.[weekday]?.isAvailable) {
        delete byUid[uid];
      }
    });
  }

  const uids = Object.keys(byUid);
  if (uids.length === 0) return [];

  // ── 3. Fetch user docs, completed-booking counts, and rating summaries in parallel ──
  const [userSnaps, countSnaps, ratingSnaps] = await Promise.all([
    Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid)))),
    Promise.all(
      uids.map((uid) =>
        getCountFromServer(
          query(
            collection(db, 'bookings'),
            where('providerId', '==', uid),
            where('status', '==', 'completed'),
          ),
        ),
      ),
    ),
    Promise.all(
      uids.map((uid) =>
        getProviderRatingSummary(uid).catch(() => ({ averageRating: 0, reviewCount: 0 })),
      ),
    ),
  ]);

  // ── 4. Assemble listings ──
  return uids
    .map((uid, i) => {
      const userSnap = userSnaps[i];
      if (!userSnap.exists()) return null;

      const services = byUid[uid];
      const hourlyService = services.find((s) => s.type === 'hourly');
      const cleaningPkg = services.find((s) => s.type === 'cleaning-company');
      const curtainPkg = services.find((s) => s.type === 'curtain-company');
      const carpetPkg = services.find((s) => s.type === 'carpet-company');
      const cleaningRate = cleaningPkg?.rateWithoutTools ?? null;

      const userData = userSnap.data();
      return {
        uid,
        // Company-style providers (cleaning, curtain, carpet) display their company name
        // to customers, never the account owner's personal name — every other category
        // still uses the personal name since there's no separate business-name concept.
        name: (cleaningPkg || curtainPkg || carpetPkg ? userData.companyName : undefined) || (userData.name as string) || 'Unknown',
        photoURL: (userData.photoURL as string | null) ?? null,
        jobsCompleted: countSnaps[i].data().count,
        averageRating: ratingSnaps[i].averageRating,
        reviewCount: ratingSnaps[i].reviewCount,
        hourlyRate: hourlyService?.hourlyRate ?? null,
        cleaningRate,
        staffCount: cleaningPkg?.staffCount ?? null,
        rateWithoutTools: cleaningPkg?.rateWithoutTools ?? null,
        rateWithTools: cleaningPkg?.rateWithTools ?? null,
        curtainRatePerSqm: curtainPkg?.ratePerSqm ?? null,
        carpetRatePerSqm: carpetPkg?.ratePerSqm ?? null,
        services,
      };
    })
    .filter((p): p is ProviderListing => p !== null);
}
