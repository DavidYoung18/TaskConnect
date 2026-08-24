// Finds (and, only when explicitly confirmed, deletes) every piece of data tied to
// the current per-provider Cleaning category, ahead of the company-based rebuild.
//
// DRY RUN BY DEFAULT — prints exactly what it would delete and exits without
// touching anything. Only deletes when you pass --confirm.
//
// Usage:
//   ADMIN_EMAIL="you@realdomain.com" ADMIN_PASSWORD="..." npx tsx scripts/cleanup-cleaning-category.ts
//   ADMIN_EMAIL="you@realdomain.com" ADMIN_PASSWORD="..." npx tsx scripts/cleanup-cleaning-category.ts --confirm
//
// Requires an admin account (matches isAdmin() in firestore.rules) — a regular
// user session doesn't have read access broad enough to enumerate this data.
//
// What this finds/deletes:
//   1. users/{uid}/providerServices/{id} where categoryId == 'cleaning'
//      (collectionGroup query) — and the parent users/{uid} docs those belong to
//   2. users/{uid}/availability/*, users/{uid}/blockedSlots/* for those same uids
//   3. bookings/{id} where categoryId == 'cleaning'
//   4. chats/{id} for those bookings (chat doc id === booking id) + their messages
//   5. reviews/{id} where providerId is one of the cleaning provider uids from #1
//
// What this does NOT touch, and why:
//   - The categories/cleaning catalog doc itself — only provider/booking data under
//     it, since the category is being rebuilt, not removed.
//   - Any other category's providers/bookings/chats/reviews. Providers are locked to
//     one category at onboarding (see provider-onboarding-category.tsx — there's no
//     "add another category" flow), so a provider whose providerServices are
//     categoryId=='cleaning' cannot also have services in another category. Deleting
//     that provider's account cannot remove another category's data by construction.
//   - Customer accounts, even ones who booked a cleaning service — only the booking
//     (and its chat) gets removed, never the customer's users/{uid} doc.
//   - supportTickets — unrelated to category.
//   - Firebase AUTH accounts for the deleted providers. This only deletes Firestore
//     documents; the actual sign-in credentials for those provider accounts are a
//     separate system (Firebase Authentication) that this script cannot touch with
//     the client SDK. If you want those login accounts gone too (so the same
//     email/password can't sign in and land on stale state), delete them manually
//     via Firebase Console → Authentication, or tell me and I'll write a follow-up
//     using the Admin SDK.

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDf-bfHHIn8DPG2Qcz4e19D0C_O1fzgd5Q',
  authDomain: 'taskconnect-fc058.firebaseapp.com',
  projectId: 'taskconnect-fc058',
  storageBucket: 'taskconnect-fc058.firebasestorage.app',
  messagingSenderId: '520749611649',
  appId: '1:520749611649:web:10308c4e68f896267e6b80',
};

const CONFIRM = process.argv.includes('--confirm');

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables first.');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);

  console.log(CONFIRM ? '*** LIVE RUN — will delete ***\n' : '--- DRY RUN (no deletions) ---\n');

  // 1. Cleaning providerServices + the provider uids they belong to
  const servicesSnap = await getDocs(
    query(collectionGroup(db, 'providerServices'), where('categoryId', '==', 'cleaning')),
  );
  const providerUids = new Set<string>();
  const serviceDocPaths: string[] = [];
  for (const d of servicesSnap.docs) {
    const uid = d.ref.parent.parent!.id;
    providerUids.add(uid);
    serviceDocPaths.push(d.ref.path);
  }
  console.log(`Cleaning providerServices docs: ${serviceDocPaths.length}`);
  serviceDocPaths.forEach((p) => console.log(`  ${p}`));
  console.log(`Affected provider accounts (${providerUids.size}): ${[...providerUids].join(', ') || '(none)'}`);

  // 2. availability + blockedSlots for those providers
  const subcollectionPaths: string[] = [];
  for (const uid of providerUids) {
    for (const sub of ['availability', 'blockedSlots']) {
      const snap = await getDocs(collection(db, 'users', uid, sub));
      snap.docs.forEach((d) => subcollectionPaths.push(d.ref.path));
    }
  }
  console.log(`\n${subcollectionPaths.length} availability/blockedSlots doc(s) under those providers`);

  // 3. Cleaning bookings
  const bookingsSnap = await getDocs(query(collection(db, 'bookings'), where('categoryId', '==', 'cleaning')));
  console.log(`\nCleaning bookings: ${bookingsSnap.size}`);
  bookingsSnap.docs.forEach((d) => console.log(`  bookings/${d.id}`, JSON.stringify(d.data())));

  // 4. Chats + messages for those bookings (chatId === bookingId)
  let messageCount = 0;
  const chatIds: string[] = [];
  for (const b of bookingsSnap.docs) {
    const chatSnap = await getDocs(collection(db, 'chats', b.id, 'messages'));
    if (!chatSnap.empty || bookingsSnap.size > 0) {
      chatIds.push(b.id);
      messageCount += chatSnap.size;
    }
  }
  console.log(`\nChats tied to those bookings: ${chatIds.length} (with ${messageCount} total messages)`);

  // 5. Reviews for the deleted providers
  let reviewDocs: { id: string; path: string }[] = [];
  for (const uid of providerUids) {
    const snap = await getDocs(query(collection(db, 'reviews'), where('providerId', '==', uid)));
    snap.docs.forEach((d) => reviewDocs.push({ id: d.id, path: d.ref.path }));
  }
  console.log(`\nReviews for those providers: ${reviewDocs.length}`);
  reviewDocs.forEach((r) => console.log(`  ${r.path}`));

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`  ${providerUids.size} provider account(s) (users/{uid} docs)`);
  console.log(`  ${serviceDocPaths.length} providerServices doc(s)`);
  console.log(`  ${subcollectionPaths.length} availability/blockedSlots doc(s)`);
  console.log(`  ${bookingsSnap.size} booking(s)`);
  console.log(`  ${chatIds.length} chat(s), ${messageCount} message(s)`);
  console.log(`  ${reviewDocs.length} review(s)`);
  console.log('='.repeat(60));

  if (!CONFIRM) {
    console.log('\nDry run only — nothing was deleted. Re-run with --confirm to actually delete.');
    process.exit(0);
  }

  console.log('\nDeleting...');
  for (const p of serviceDocPaths) await deleteDoc(doc(db, p));
  for (const p of subcollectionPaths) await deleteDoc(doc(db, p));
  for (const b of bookingsSnap.docs) await deleteDoc(doc(db, 'bookings', b.id));
  for (const chatId of chatIds) {
    const msgs = await getDocs(collection(db, 'chats', chatId, 'messages'));
    for (const m of msgs.docs) await deleteDoc(doc(db, 'chats', chatId, 'messages', m.id));
    await deleteDoc(doc(db, 'chats', chatId));
  }
  for (const r of reviewDocs) await deleteDoc(doc(db, r.path));
  for (const uid of providerUids) await deleteDoc(doc(db, 'users', uid));

  console.log('Done. Firestore data deleted. Remember: Firebase Auth accounts for');
  console.log('these providers still exist — delete them via the Console if you want those gone too.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
