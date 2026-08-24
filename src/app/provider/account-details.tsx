import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { DocumentReference, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getAddresses } from '@/lib/addresses';
import { pickAndUploadCompanyPhoto } from '@/lib/companyPhoto';
import { useAuthUser } from '@/lib/useAuthUser';
import FullScreenImageViewer from '@/components/FullScreenImageViewer';

export default function AccountDetailsScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultAddress, setDefaultAddress] = useState('');
  const [isCleaningCompany, setIsCleaningCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [about, setAbout] = useState('');
  // Non-null only for a company account — "about" then lives on this providerServices
  // doc (cleaning-company/curtain-company/carpet-company), not on the user doc, since
  // that's where the customer-facing profile view reads it from for those categories.
  const [companyAboutRef, setCompanyAboutRef] = useState<DocumentReference | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuthUser();

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const uid = user?.uid;
    if (!uid) return;

    const [userSnap, addresses, cleaningSnap, curtainSnap, carpetSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getAddresses(uid),
      getDocs(
        query(
          collection(db, 'users', uid, 'providerServices'),
          where('categoryId', '==', 'cleaning'),
          where('type', '==', 'cleaning-company'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'users', uid, 'providerServices'),
          where('categoryId', '==', 'curtain-cleaning'),
          where('type', '==', 'curtain-company'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'users', uid, 'providerServices'),
          where('categoryId', '==', 'carpet-wash'),
          where('type', '==', 'carpet-company'),
        ),
      ),
    ]);

    if (userSnap.exists()) {
      const data = userSnap.data();
      setName(data.name ?? '');
      setEmail(data.email ?? '');
      setPhone(data.phone ?? '');
      setCompanyName(data.companyName ?? '');
      setPhotoURL(data.photoURL ?? null);
    }

    setIsCleaningCompany(!cleaningSnap.empty);

    // "about" lives on the company's own providerServices doc for a company account,
    // and on the user doc for an individual — whichever company doc exists (there's
    // ever only one per provider) wins; falls back to the user doc otherwise.
    const companyDoc = cleaningSnap.docs[0] ?? curtainSnap.docs[0] ?? carpetSnap.docs[0];
    if (companyDoc) {
      setAbout((companyDoc.data().about as string) ?? '');
      setCompanyAboutRef(companyDoc.ref);
    } else {
      setAbout((userSnap.exists() ? userSnap.data().about : '') ?? '');
      setCompanyAboutRef(null);
    }

    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
    if (defaultAddr) setDefaultAddress(defaultAddr.fullAddress);

    setLoading(false);
  }

  // Tapping the avatar itself only views the current photo full-screen — it never opens the
  // picker, so an accidental tap while just glancing at the photo can't trigger an upload.
  // With no photo yet, there's nothing to view, so it routes to the same upload action as the
  // button below instead of doing nothing.
  function handleAvatarPress() {
    if (photoURL) {
      setShowPhotoViewer(true);
    } else {
      handleUploadPress();
    }
  }

  async function handleUploadPress() {
    if (uploadingPhoto) return; // guards against a double-fired press presenting the native picker twice
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadCompanyPhoto(uid);
      if (url) setPhotoURL(url);
    } catch {
      Alert.alert(t('alerts.errorTitle'), t('common.error'));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (isCleaningCompany && !companyName.trim()) {
      Alert.alert(t('alerts.companyNameRequiredTitle'), t('alerts.companyNameRequiredMessage'));
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setSaving(true);
    try {
      const updates: Promise<void>[] = [];
      if (isCleaningCompany) {
        updates.push(updateDoc(doc(db, 'users', uid), { companyName: companyName.trim() }));
      }
      updates.push(
        companyAboutRef
          ? updateDoc(companyAboutRef, { about: about.trim() })
          : updateDoc(doc(db, 'users', uid), { about: about.trim() }),
      );
      await Promise.all(updates);
      Alert.alert(t('alerts.savedTitle'), t('alerts.detailsUpdatedMessage'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('alerts.errorTitle'), t('alerts.saveChangesError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profileMenu.accountDetails')}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {loading ? (
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        ) : (
          <>
            {/* Avatar — tap only views the photo full-screen, never opens the picker */}
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handleAvatarPress}
              activeOpacity={0.8}
              disabled={uploadingPhoto}
            >
              <View style={styles.avatar}>
                {uploadingPhoto ? (
                  <ActivityIndicator color="#999999" />
                ) : photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.avatarImage} contentFit="cover" />
                ) : name ? (
                  <Text style={styles.avatarInitials}>
                    {name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                ) : (
                  <Ionicons name="person" size={40} color="#999999" />
                )}
              </View>
            </TouchableOpacity>

            {/* The only trigger for the picker — every provider category can upload a photo,
                not just cleaning companies (see pickAndUploadCompanyPhoto/storage.rules,
                both already keyed by uid, not category). */}
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={handleUploadPress}
              activeOpacity={0.7}
              disabled={uploadingPhoto}
            >
              <Ionicons name="camera-outline" size={16} color="#000000" />
              <Text style={styles.changePhotoText}>
                {photoURL ? t('accountDetailsScreen.changePhotoButton') : t('accountDetailsScreen.uploadPhotoButton')}
              </Text>
            </TouchableOpacity>

            {/* Company name — cleaning companies only; this is what customers see */}
            {isCleaningCompany && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('providerOnboarding.companyNameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder={t('providerOnboarding.companyNamePlaceholder')}
                  placeholderTextColor="#999999"
                />
                <Text style={styles.fieldHint}>{t('providerOnboarding.companyNameHint')}</Text>
              </View>
            )}

            {/* About — companies edit their company "about" here too now (also still
                editable via their card in My Services); individuals edit their personal
                bio here, same field either way. */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                {companyAboutRef ? t('providerOnboarding.aboutYourCompany') : t('providerOnboarding.aboutYouLabel')}
              </Text>
              <TextInput
                style={[styles.input, styles.aboutInput]}
                value={about}
                onChangeText={setAbout}
                placeholder={t('providerOnboarding.aboutYouPlaceholder')}
                placeholderTextColor="#999999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Personal name — read-only */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                {isCleaningCompany ? t('accountDetailsScreen.accountOwnerLabel') : t('auth.name')}
              </Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyValue}>{name}</Text>
              </View>
              <Text style={styles.fieldHint}>
                {isCleaningCompany ? t('accountDetailsScreen.accountOwnerHint') : t('accountDetailsScreen.nameVerifiedHint')}
              </Text>
            </View>

            {/* Email — read-only */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyValue}>{email}</Text>
              </View>
              <Text style={styles.fieldHint}>{t('accountDetailsScreen.emailChangeHint')}</Text>
            </View>

            {/* Phone — read-only, matching name/email (see account-details.tsx, the
                customer counterpart, for the same decision) */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('accountDetailsScreen.phone')}</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyValue}>{phone}</Text>
              </View>
              <Text style={styles.fieldHint}>{t('accountDetailsScreen.phoneVerifiedHint')}</Text>
            </View>

            {/* Address */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('accountDetailsScreen.defaultAddress')}</Text>
              <View style={styles.addressRow}>
                <Text style={styles.addressValue} numberOfLines={2}>
                  {defaultAddress || t('bookingReviewScreen.noAddressSaved')}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/addresses')}
                  style={styles.changeButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeText}>{t('bookingReviewScreen.change')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Name, email, and phone are all read-only now — about (everyone) and companyName
          (cleaning companies) are the only fields left to save. Photo upload is a
          separate, immediate action above, not part of this form. */}
      {!loading && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>{saving ? t('common.saving') : t('common.saveChanges')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <FullScreenImageViewer
        visible={showPhotoViewer}
        uri={photoURL}
        onClose={() => setShowPhotoViewer(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    gap: 14,
  },
  backButton: {
    padding: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  avatarWrapper: {
    alignSelf: 'center',
    marginTop: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: '700',
    color: '#444444',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 28,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  scrollContent: {
    padding: 24,
  },
  loadingText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  field: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 12,
    color: '#999999',
    marginTop: 6,
  },
  readonlyBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readonlyValue: {
    fontSize: 16,
    color: '#444444',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
  },
  aboutInput: {
    minHeight: 100,
    paddingTop: 14,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  addressValue: {
    flex: 1,
    fontSize: 15,
    color: '#444444',
    lineHeight: 20,
  },
  changeButton: {
    flexShrink: 0,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    textDecorationLine: 'underline',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    backgroundColor: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
