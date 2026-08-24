import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

// Lets a Cleaning Company pick a photo from their library and uploads it to
// Firebase Storage at companyPhotos/{uid}/photo.jpg, then stores the resulting
// download URL on their users/{uid} doc. Returns null if the user cancels or
// denies the library permission — callers should treat that as a silent no-op,
// not an error.
export async function pickAndUploadCompanyPhoto(uid: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;

  const response = await fetch(result.assets[0].uri);
  const blob = await response.blob();

  const fileRef = ref(storage, `companyPhotos/${uid}/photo.jpg`);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  const photoURL = await getDownloadURL(fileRef);

  await updateDoc(doc(db, 'users', uid), { photoURL });
  return photoURL;
}
