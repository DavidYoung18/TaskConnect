import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { pickAndUploadCompanyPhoto } from '@/lib/companyPhoto';

// Last step for individual providers (plumbers, electricians, AC techs, etc.) right after
// they've set up their services and pricing — never shown to the company-style categories
// (cleaning, curtain cleaning), which already collect their own company photo/about during
// their dedicated onboarding screens. Both fields here are optional: onboardingComplete was
// already set to true by the previous screen, so skipping just leaves them blank — a provider
// can still add either later from Account Details.
export default function ProviderOnboardingProfileScreen() {
  const { t } = useTranslation();
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [about, setAbout] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleUploadPress() {
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

  async function finish() {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      router.replace('/provider/(tabs)/home');
      return;
    }
    setIsSaving(true);
    try {
      if (about.trim()) {
        await updateDoc(doc(db, 'users', uid), { about: about.trim() });
      }
    } catch {
      // Photo (if any) already uploaded successfully above — don't block finishing
      // onboarding over the about text failing to save; it can still be added later.
    } finally {
      setIsSaving(false);
      router.replace('/provider/(tabs)/home');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{t('providerOnboarding.profileSetupTitle')}</Text>
          <Text style={styles.subtitle}>{t('providerOnboarding.profileSetupSubtitle')}</Text>
        </View>
        <TouchableOpacity onPress={finish} disabled={isSaving}>
          <Text style={styles.skipText}>{t('providerOnboarding.skipForNow')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={handleUploadPress}
          activeOpacity={0.8}
          disabled={uploadingPhoto}
        >
          <View style={styles.avatar}>
            {uploadingPhoto ? (
              <ActivityIndicator color="#999999" />
            ) : photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={40} color="#999999" />
            )}
          </View>
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color="#ffffff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.photoHint}>
          {photoURL
            ? t('accountDetailsScreen.changePhotoButton')
            : t('accountDetailsScreen.uploadPhotoButton')}
        </Text>

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
          {t('providerOnboarding.aboutYouLabel')}
        </Text>
        <TextInput
          style={styles.aboutInput}
          value={about}
          onChangeText={setAbout}
          placeholder={t('providerOnboarding.aboutYouPlaceholder')}
          placeholderTextColor="#999999"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.finishButton, isSaving && styles.finishButtonDisabled]}
          onPress={finish}
          disabled={isSaving}
        >
          <Text style={styles.finishButtonText}>
            {isSaving ? t('common.saving') : t('providerOnboarding.finishSetup')}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 14,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    paddingTop: 4,
  },
  scroll: {
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    alignSelf: 'center',
    marginTop: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
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
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
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
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    marginTop: 32,
  },
  aboutInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 14,
    fontSize: 15,
    color: '#000000',
    minHeight: 120,
  },
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
  finishButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finishButtonDisabled: {
    opacity: 0.4,
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
