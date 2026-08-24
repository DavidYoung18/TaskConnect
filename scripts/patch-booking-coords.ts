import { initializeApp } from 'firebase/app';
import { doc, getFirestore, updateDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyDf-bfHHIn8DPG2Qcz4e19D0C_O1fzgd5Q",
  authDomain: "taskconnect-fc058.firebaseapp.com",
  projectId: "taskconnect-fc058",
  storageBucket: "taskconnect-fc058.firebasestorage.app",
  messagingSenderId: "520749611649",
  appId: "1:520749611649:web:10308c4e68f896267e6b80",
});

const db = getFirestore(app);

const IDS = [
  'hlwZ2mPG7Ohy1dkoEvZl',
  'NfAywDRZEKcBhxEPaDE0',
  'DWLKI8kSTrsZZn2HAkMG',
];

async function main() {
  for (const id of IDS) {
    await updateDoc(doc(db, 'bookings', id), {
      latitude: 41.2995,
      longitude: 69.2401,
    });
    console.log(`✓ Patched ${id}`);
  }
  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
