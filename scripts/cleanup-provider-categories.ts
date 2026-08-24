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
const KEEP_CATEGORY_ID = 'plumbing';

async function main() {
  const snap = await getDocs(collection(db, 'users', UID, 'providerServices'));
  console.log(`Before: ${snap.docs.length} documents`);

  const removedCategoryIds = new Set<string>();
  let deleted = 0;

  for (const d of snap.docs) {
    const categoryId = d.data().categoryId as string;
    if (categoryId === KEEP_CATEGORY_ID) continue;

    console.log(`  Deleting ${d.id} (categoryId: ${categoryId})`);
    await deleteDoc(doc(db, 'users', UID, 'providerServices', d.id));
    removedCategoryIds.add(categoryId);
    deleted++;
  }

  const after = snap.docs.length - deleted;
  console.log(`\nDeleted ${deleted} document(s). After: ${after} documents`);
  console.log(`Removed categoryIds: ${removedCategoryIds.size ? [...removedCategoryIds].join(', ') : '(none)'}`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
