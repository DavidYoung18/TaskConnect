import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { pickAndUploadCompanyPhoto } from '@/lib/companyPhoto';
import { useAuthUser } from '@/lib/useAuthUser';

export default function ProviderOnboardingCarpetScreen() {
  const { t } = useTranslation();
  const { mode } = useLocalSearchParams<{ categoryId?: string; mode?: string }>();
  const isEditMode = mode === 'edit';

  const [companyName, setCompanyName] = useState('');
  const [about, setAbout] = useState('');
  const [rate, setRate] = useState('');
  const [existingDocId, setExistingDocId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { user } = useAuthUser();

  useEffect(() => {
    if (!isEditMode || !user) return;
    loadExisting();
  }, [user]);

  async function loadExisting() {
    const uid = user?.uid;
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'providerServices'),
      where('categoryId', '==', 'carpet-wash'),
      where('type', '==', 'carpet-company'),
    );
    const [snap, userSnap] = await Promise.all([getDocs(q), getDoc(doc(db, 'users', uid))]);

    if (userSnap.exists()) {
      setCompanyName((userSnap.data().companyName as string) ?? '');
      setPhotoURL((userSnap.data().photoURL as string) ?? null);
    }

    if (snap.empty) return;
    const d = snap.docs[0];
    const data = d.data();
    setExistingDocId(d.id);
    setAbout((data.about as string) ?? '');
    setRate(String(data.ratePerSqm ?? ''));
  }

  async function handleUploadPhoto() {
    if (uploadingPhoto) return;
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
    if (!companyName.trim()) {
      Alert.alert(t('alerts.companyNameRequiredTitle'), t('alerts.companyNameRequiredMessage'));
      return;
    }
    const rateNum = parseFloat(rate.trim());
    if (!rate.trim() || isNaN(rateNum) || rateNum <= 0) {
      Alert.alert(t('alerts.invalidRateTitle'), t('providerOnboarding.invalidRateMessage'));
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert(t('alerts.errorTitle'), t('alerts.notSignedIn'));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        categoryId: 'carpet-wash',
        type: 'carpet-company',
        name: 'Carpet Cleaning Company',
        about: about.trim(),
        ratePerSqm: rateNum,
      };

      if (isEditMode && existingDocId) {
        await updateDoc(doc(db, 'users', uid, 'providerServices', existingDocId), payload);
      } else {
        await addDoc(collection(db, 'users', uid, 'providerServices'), payload);
      }

      if (isEditMode) {
        await updateDoc(doc(db, 'users', uid), { companyName: companyName.trim() });
        router.back();
      } else {
        await updateDoc(doc(db, 'users', uid), { companyName: companyName.trim(), onboardingComplete: true });
        router.replace('/provider/(tabs)/home');
      }
    } catch {
      Alert.alert(t('alerts.errorTitle'), t('common.error'));
    } finally {
      setIsSaving(false);
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
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{t('providerOnboarding.carpetCompanySetupTitle')}</Text>
          <Text style={styles.subtitle}>{t('categories.carpetWash')}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Company photo — optional */}
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={handleUploadPhoto}
          activeOpacity={0.8}
          disabled={uploadingPhoto}
        >
          <View style={styles.avatar}>
            {uploadingPhoto ? (
              <ActivityIndicator color="#999999" />
            ) : photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Ionicons name="business" size={36} color="#999999" />
            )}
          </View>
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={13} color="#ffffff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.photoHint}>
          {photoURL
            ? t('accountDetailsScreen.changePhotoButton')
            : t('accountDetailsScreen.uploadPhotoButton')}
        </Text>

        {/* Company name */}
        <Text style={styles.sectionLabel}>{t('providerOnboarding.companyNameLabel')}</Text>
        <Text style={styles.hint}>{t('providerOnboarding.companyNameHint')}</Text>
        <TextInput
          style={styles.nameInput}
          value={companyName}
          onChangeText={setCompanyName}
          placeholder={t('providerOnboarding.carpetCompanyNamePlaceholder')}
          placeholderTextColor="#999999"
        />

        {/* About */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>{t('providerOnboarding.aboutYourCompany')}</Text>
        <TextInput
          style={styles.aboutInput}
          value={about}
          onChangeText={setAbout}
          placeholder={t('providerOnboarding.carpetAboutPlaceholder')}
          placeholderTextColor="#999999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Rate */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>{t('providerOnboarding.carpetRateLabel')}</Text>
        <Text style={styles.hint}>{t('providerOnboarding.carpetRateHint')}</Text>
        <View style={styles.rateInputRow}>
          <TextInput
            style={styles.rateInput}
            value={rate}
            onChangeText={setRate}
            keyboardType="numeric"
            placeholder={t('common.egValue', { value: 15000 })}
            placeholderTextColor="#999999"
          />
          <Text style={styles.rateCurrency}>{t('common.currency')}/m²</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? t('common.saving') : isEditMode ? t('common.saveChanges') : t('common.continue')}
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 14,
  },
  backButton: {
    padding: 2,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  photoHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    marginTop: 28,
  },
  hint: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 12,
    lineHeight: 17,
  },
  nameInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
  },
  aboutInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 14,
    fontSize: 15,
    color: '#000000',
    minHeight: 100,
  },
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  rateInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  rateCurrency: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
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
