import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDocs, getFirestore, setDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyDf-bfHHIn8DPG2Qcz4e19D0C_O1fzgd5Q",
  authDomain: "taskconnect-fc058.firebaseapp.com",
  projectId: "taskconnect-fc058",
  storageBucket: "taskconnect-fc058.firebasestorage.app",
  messagingSenderId: "520749611649",
  appId: "1:520749611649:web:10308c4e68f896267e6b80",
});

const db = getFirestore(app);
const auth = getAuth(app);

// Writing to `categories` requires the admin account (see firestore.rules isAdmin()).
// Credentials are read from env vars — set them in your own shell, never hardcode them here:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/seed-categories.ts
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const categories = [
  {
    id: "cleaning",
    name: "Cleaning",
    description: "Home & office cleaning",
    hasHourlyOption: false,
    subServices: [],
  },
  {
    id: "plumbing",
    name: "Plumbing",
    description: "Pipes, faucets & more",
    hasHourlyOption: true,
    hourlyRateRange: { minHours: 1, maxHours: 8 },
    subServices: [
      { id: "blockage-drainage-removal", name: "Blockage/Drainage Removal" },
      { id: "leakage-repair", name: "Leakage Repair" },
      { id: "toilet-repair-installation", name: "Toilet Repairs and Installation" },
      { id: "tap-mixer-repair-installation", name: "Tap/Mixer Repairs and Installation" },
      { id: "jet-spray-installation", name: "Jet Spray Installation" },
      { id: "geyser-installation", name: "Geyser Installation" },
    ],
  },
  {
    id: "electrical",
    name: "Electrical",
    description: "Wiring & installations",
    hasHourlyOption: true,
    hourlyRateRange: { minHours: 1, maxHours: 8 },
    subServices: [
      { id: "chandelier-lights", name: "Chandelier and Lights" },
      { id: "switch-socket", name: "Switch and Socket" },
      { id: "wiring", name: "Wiring" },
      { id: "bulb-tube-lights", name: "Bulb and Tube Lights" },
      { id: "electrical-panel", name: "Electrical Panel/Distribution Board" },
      { id: "ev-charger-installation", name: "EV Charger Installation" },
    ],
  },
  {
    id: "carpet-wash",
    name: "Carpet Wash",
    description: "Deep carpet cleaning",
    hasHourlyOption: false,
    subServices: [],
  },
  {
    id: "tv-mounting",
    name: "TV Mounting",
    description: "TV & shelf mounting",
    hasHourlyOption: false,
    subServices: [],
  },
  {
    id: "deep-clean",
    name: "Deep Clean",
    description: "Full deep cleaning",
    hasHourlyOption: false,
    subServices: [],
  },
  {
    id: "painting",
    name: "Painting",
    description: "Wall & room painting",
    hasHourlyOption: false,
    subServices: [],
  },
  {
    id: "furniture",
    name: "Furniture",
    description: "Assembly & repair",
    hasHourlyOption: true,
    hourlyRateRange: { minHours: 1, maxHours: 8 },
    subServices: [],
  },
  {
    id: "ac",
    name: "AC",
    description: "Air conditioning repair, installation and replacement",
    hasHourlyOption: false,
    subServices: [
      { id: "ac-repair", name: "AC Repair", icon: "ac-repair" },
      { id: "ac-installation", name: "AC Installation", icon: "ac-installation" },
      { id: "ac-replacement", name: "AC Replacement", icon: "ac-replacement" },
    ],
  },
  {
    id: "curtain-cleaning",
    name: "Curtain Cleaning",
    description: "Curtain pickup & cleaning",
    hasHourlyOption: false,
    subServices: [],
  },
];

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars (the admin account from firestore.rules) before running this script.');
    process.exit(1);
  }
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);

  for (const { id, ...data } of categories) {
    await setDoc(doc(db, 'categories', id), data);
    console.log(`✓ Written: ${id}`);
  }

  console.log('\nReading back all documents...\n');
  const snap = await getDocs(collection(db, 'categories'));
  snap.docs
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((d) => {
      const data = d.data();
      console.log(`[${d.id}] ${data.name} — subServices: ${data.subServices?.length ?? 0}, hourly: ${data.hasHourlyOption}`);
    });

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
