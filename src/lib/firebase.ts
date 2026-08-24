// Firebase initialization — exports `auth` (with AsyncStorage persistence) and `db` (Firestore).
// Import from this file anywhere in the app rather than calling Firebase SDK directly.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDf-bfHHIn8DPG2Qcz4e19D0C_O1fzgd5Q",
  authDomain: "taskconnect-fc058.firebaseapp.com",
  projectId: "taskconnect-fc058",
  storageBucket: "taskconnect-fc058.firebasestorage.app",
  messagingSenderId: "520749611649",
  appId: "1:520749611649:web:10308c4e68f896267e6b80",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);
