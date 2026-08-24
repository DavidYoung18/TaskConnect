import { initializeApp } from 'firebase/app';
import { collection, deleteDoc, doc, getDocs, getFirestore } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyDf-bfHHIn8DPG2Qcz4e19D0C_O1fzgd5Q",
  authDomain: "taskconnect-fc058.firebaseapp.com",
  projectId: "taskconnect-fc058",
  storageBucket: "taskconnect-fc058.firebasestorage.app",
  messagingSenderId: "520749611649",
  appId: "1:520749611649:web:10308c4e68f896267e6b80",
});

const db = getFirestore(app);
const UID = 'Sq2TCPDZaQXWKkLn9BDZ74deS4z2';

async function main() {
  const snap = await getDocs(collection(db, 'users', UID, 'providerServices'));
  console.log(`Before: ${snap.docs.length} documents`);

  // Group by subServiceId
  const groups: Record<string, typeof snap.docs> = {};
  for (const d of snap.docs) {
    const key = d.data().subServiceId as string;
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  }

  let deleted = 0;
  for (const [subServiceId, docs] of Object.entries(groups)) {
    if (docs.length <= 1) continue;
    // Keep the last doc in the array, delete the rest
    const toDelete = docs.slice(0, -1);
    for (const d of toDelete) {
      console.log(`  Deleting duplicate ${d.id} (subServiceId: ${subServiceId})`);
      await deleteDoc(doc(db, 'users', UID, 'providerServices', d.id));
      deleted++;
    }
    console.log(`  Kept ${docs[docs.length - 1].id} (subServiceId: ${subServiceId})`);
  }

  const after = snap.docs.length - deleted;
  console.log(`\nDeleted ${deleted} duplicate(s). After: ${after} documents`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
