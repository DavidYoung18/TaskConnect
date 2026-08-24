// Same Firebase project as the Labbe mobile app (src/lib/firebase.ts).
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDf-bfHHIn8DPG2Qcz4e19D0C_O1fzgd5Q',
  authDomain: 'taskconnect-fc058.firebaseapp.com',
  projectId: 'taskconnect-fc058',
  storageBucket: 'taskconnect-fc058.firebasestorage.app',
  messagingSenderId: '520749611649',
  appId: '1:520749611649:web:10308c4e68f896267e6b80',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
