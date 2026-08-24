import { initializeApp } from 'firebase/app';
import { addDoc, collection, getFirestore } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyDf-bfHHIn8DPG2Qcz4e19D0C_O1fzgd5Q",
  authDomain: "taskconnect-fc058.firebaseapp.com",
  projectId: "taskconnect-fc058",
  storageBucket: "taskconnect-fc058.firebasestorage.app",
  messagingSenderId: "520749611649",
  appId: "1:520749611649:web:10308c4e68f896267e6b80",
});

const db = getFirestore(app);

// ── Fill in before running ───────────────────────────────────────────────────
const PROVIDER_ID   = 'Sq2TCPDZaQXWKkLn9BDZ74deS4z2';
const PROVIDER_NAME = 'David Young';
// ────────────────────────────────────────────────────────────────────────────

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const bookings = [
  {
    customerId: 'test-customer-id',
    customerName: 'Aziz Karimov',
    providerId: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    categoryId: 'plumbing',
    subServiceId: 'leakage-repair',
    serviceName: 'Leakage Repair',
    price: 50000,
    type: 'fixed',
    hours: null,
    addressId: 'test-address-id',
    addressText: '12 Amir Temur Street, Tashkent',
    scheduledDate: dateOffset(1),
    scheduledTime: '10:00',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    customerId: 'test-customer-id',
    customerName: 'Aziz Karimov',
    providerId: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    categoryId: 'plumbing',
    subServiceId: 'toilet-repair-installation',
    serviceName: 'Toilet Repairs and Installation',
    price: 80000,
    type: 'fixed',
    hours: null,
    addressId: 'test-address-id',
    addressText: '12 Amir Temur Street, Tashkent',
    scheduledDate: dateOffset(2),
    scheduledTime: '14:00',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    customerId: 'test-customer-id',
    customerName: 'Aziz Karimov',
    providerId: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    categoryId: 'plumbing',
    subServiceId: 'hourly',
    serviceName: 'Hourly Booking',
    price: 90000,
    type: 'hourly',
    hours: 3,
    addressId: 'test-address-id',
    addressText: '12 Amir Temur Street, Tashkent',
    scheduledDate: dateOffset(-5),
    scheduledTime: '09:00',
    status: 'completed',
    createdAt: new Date().toISOString(),
  },
];

async function main() {
  if (PROVIDER_ID === 'REPLACE_WITH_PROVIDER_UID') {
    console.error('❌  Set PROVIDER_ID and PROVIDER_NAME before running this script.');
    process.exit(1);
  }

  for (const booking of bookings) {
    const ref = await addDoc(collection(db, 'bookings'), booking);
    console.log(`✓ Created booking ${ref.id} — ${booking.serviceName} (${booking.status}) on ${booking.scheduledDate}`);
  }

  console.log('\nDone — 3 test bookings written to Firestore.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
