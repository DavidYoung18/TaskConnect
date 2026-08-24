import { collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/lib/firebase';
import { useAuthUser } from '@/lib/useAuthUser';

// Fixed standard TV diagonal sizes (the sizes TVs actually ship in), not ranges —
// a customer knows their TV is a 55", not that it falls in a "43–55" bucket. Every
// TV mounter prices against this same fixed list; only their price per size differs.
const TV_SIZE_OPTIONS = [
  { id: 'tv-32', name: '32"', labelKey: 'subServices.tv32' },
  { id: 'tv-43', name: '43"', labelKey: 'subServices.tv43' },
  { id: 'tv-55', name: '55"', labelKey: 'subServices.tv55' },
  { id: 'tv-65', name: '65"', labelKey: 'subServices.tv65' },
  { id: 'tv-75', name: '75"', labelKey: 'subServices.tv75' },
  { id: 'tv-85', name: '85"', labelKey: 'subServices.tv85' },
  { id: 'tv-100', name: '100"', labelKey: 'subServices.tv100' },
];

interface ServiceEntry {
  selected: boolean;
  price: string;
}

// Maps subServiceId → existing providerServices doc ID (for upsert in edit mode)
type ExistingDocMap = Record<string, string>;

export default function ProviderOnboardingTvScreen() {
  const { t } = useTranslation();
  const { categoryId, mode } = useLocalSearchParams<{ categoryId?: string; mode?: string }>();
  const isEditMode = mode === 'edit';
  const resolvedCategoryId = categoryId ?? 'tv-mounting';

  const [serviceState, setServiceState] = useState<Record<string, ServiceEntry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingDocs, setExistingDocs] = useState<ExistingDocMap>({});
  const { user } = useAuthUser();

  useEffect(() => {
    if (isEditMode && !user) return;
    loadScreen();
  }, [user]);

  async function loadScreen() {
    const initial: Record<string, ServiceEntry> = {};
    TV_SIZE_OPTIONS.forEach((s) => {
      initial[s.id] = { selected: false, price: '' };
    });

    if (isEditMode) {
      const uid = user?.uid;
      if (uid) {
        const q = query(
          collection(db, 'users', uid, 'providerServices'),
          where('categoryId', '==', resolvedCategoryId),
        );
        const existing = await getDocs(q);
        const docMap: ExistingDocMap = {};

        existing.docs.forEach((d) => {
          const sd = d.data().subServiceId as string;
          docMap[sd] = d.id;

          if (initial[sd]) {
            initial[sd] = {
              selected: true,
              price: String(d.data().price ?? ''),
            };
          }
        });

        setExistingDocs(docMap);
      }
    }

    setServiceState(initial);
    setIsLoading(false);
  }

  function toggleService(id: string) {
    setServiceState((prev) => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id].selected, price: prev[id].selected ? '' : prev[id].price },
    }));
  }

  function setPrice(id: string, price: string) {
    setServiceState((prev) => ({
      ...prev,
      [id]: { ...prev[id], price },
    }));
  }

  async function handleContinue() {
    const selectedEntries = TV_SIZE_OPTIONS.filter((s) => serviceState[s.id]?.selected);

    if (selectedEntries.length === 0) {
      Alert.alert(t('alerts.selectAtLeastOneService'));
      return;
    }

    const missingPrice = selectedEntries.find((s) => {
      const p = serviceState[s.id]?.price.trim();
      return !p || isNaN(Number(p));
    });
    if (missingPrice) {
      Alert.alert(t('alerts.invalidPriceForService', { name: t(missingPrice.labelKey) }));
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert(t('alerts.errorTitle'), t('alerts.notSignedIn'));
      return;
    }

    setIsSaving(true);
    try {
      const servicesCol = collection(db, 'users', uid, 'providerServices');
      const batch = writeBatch(db);

      for (const s of selectedEntries) {
        const payload = {
          categoryId: resolvedCategoryId,
          subServiceId: s.id,
          name: s.name,
          price: parseFloat(serviceState[s.id].price),
          type: 'fixed',
        };
        if (isEditMode && existingDocs[s.id]) {
          batch.update(doc(servicesCol, existingDocs[s.id]), {
            price: payload.price,
          });
        } else {
          batch.set(doc(servicesCol), payload);
        }
      }

      await batch.commit();

      if (isEditMode) {
        router.back();
      } else {
        // The "Set Up Your Profile" (photo/about) step is meant to run exactly once,
        // right after a provider's very first setup — not every time someone re-adds
        // services through the "Add Category" flow after deleting them (that flow
        // can't otherwise tell "genuinely new provider" apart from "already onboarded,
        // just redoing this category"). onboardingComplete already being true before
        // this save is exactly that signal.
        const userSnap = await getDoc(doc(db, 'users', uid));
        const alreadyOnboarded = userSnap.exists() && userSnap.data().onboardingComplete === true;
        await updateDoc(doc(db, 'users', uid), { onboardingComplete: true });
        router.replace(alreadyOnboarded ? '/provider/(tabs)/home' : '/provider-onboarding-profile');
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
          <Text style={styles.title}>{isEditMode ? t('myServicesScreen.editServicesTitle') : t('myServicesScreen.yourServicesTitle')}</Text>
          <Text style={styles.subtitle}>{t('categories.tvMounting')}</Text>
        </View>
      </View>

      <Text style={styles.hint}>{t('providerOnboarding.tvSizeHint')}</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {isLoading && <Text style={styles.loadingText}>{t('common.loading')}</Text>}

        {!isLoading && TV_SIZE_OPTIONS.map((service) => {
          const entry = serviceState[service.id];
          const selected = entry?.selected ?? false;
          return (
            <View key={service.id}>
              <TouchableOpacity
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => toggleService(service.id)}
                activeOpacity={0.7}
              >
                <View style={styles.checkbox}>
                  {selected
                    ? <Ionicons name="checkmark-circle" size={24} color="#000000" />
                    : <Ionicons name="ellipse-outline" size={24} color="#cccccc" />
                  }
                </View>
                <Ionicons name="tv-outline" size={22} color={selected ? '#000000' : '#cccccc'} />
                <Text style={styles.serviceName}>{t(service.labelKey)}</Text>
              </TouchableOpacity>

              {selected && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{t('myServicesScreen.priceLabel')}</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder={t('common.egValue', { value: 100000 })}
                    placeholderTextColor="#999999"
                    value={entry.price}
                    onChangeText={(v) => setPrice(service.id, v)}
                    keyboardType="numeric"
                  />
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving}>
          <Text style={styles.continueButtonText}>{isSaving ? t('common.saving') : isEditMode ? t('common.saveChanges') : t('common.continue')}</Text>
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
  hint: {
    fontSize: 12,
    color: '#999999',
    paddingHorizontal: 24,
    marginBottom: 12,
    lineHeight: 17,
  },
  list: {
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#999999',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  cardSelected: {
    borderColor: '#000000',
    backgroundColor: '#f8f8f8',
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  priceRow: {
    marginTop: -4,
    marginBottom: 10,
    marginHorizontal: 4,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  priceInput: {
    fontSize: 15,
    color: '#000000',
    textAlign: 'right',
    minWidth: 120,
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
  continueButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
