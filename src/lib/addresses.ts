import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Address {
  id: string;
  label: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

type AddressData = Omit<Address, 'id'>;

function addressesCol(uid: string) {
  return collection(db, 'users', uid, 'addresses');
}

export async function addAddress(uid: string, data: AddressData): Promise<void> {
  await addDoc(addressesCol(uid), data);
}

export async function getAddresses(uid: string): Promise<Address[]> {
  const snap = await getDocs(addressesCol(uid));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AddressData) }));
}

export async function getAddress(uid: string, addressId: string): Promise<Address | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'addresses', addressId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as AddressData) };
}

export async function updateAddress(
  uid: string,
  addressId: string,
  data: Partial<AddressData>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'addresses', addressId), data);
}

export async function deleteAddress(uid: string, addressId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'addresses', addressId));
}

export async function setDefaultAddress(uid: string, addressId: string): Promise<void> {
  const snap = await getDocs(addressesCol(uid));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { isDefault: d.id === addressId });
  });
  await batch.commit();
}
