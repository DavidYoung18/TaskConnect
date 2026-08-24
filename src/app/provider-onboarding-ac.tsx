import { collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/lib/firebase';
import { useAuthUser } from '@/lib/useAuthUser';

const AC_SUB_SERVICES = [
  { id: 'ac-repair', name: 'AC Repair', labelKey: 'subServices.acRepair', icon: 'construct-outline' as const },
  { id: 'ac-installation', name: 'AC Installation', labelKey: 'subServices.acInstallation', icon: 'build-outline' as const },
  { id: 'ac-replacement', name: 'AC Replacement', labelKey: 'subServices.acReplacement', icon: 'swap-horizontal-outline' as const },
];

const DURATION_OPTIONS = [1, 2, 3, 4];

interface ServiceEntry {
  selected: boolean;
  price: string;
  estimatedDuration: number;
}

// Maps subServiceId → existing providerServices doc ID (for upsert in edit mode)
type ExistingDocMap = Record<string, string>;

export default function ProviderOnboardingAcScreen() {
  const { t } = useTranslation();
  const { categoryId, mode } = useLocalSearchParams<{ categoryId?: string; mode?: string }>();
  const isEditMode = mode === 'edit';
  const resolvedCategoryId = categoryId ?? 'ac';

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
    // Build initial service state — all unselected/empty
    const initial: Record<string, ServiceEntry> = {};
    AC_SUB_SERVICES.forEach((s) => {
      initial[s.id] = { selected: false, price: '', estimatedDuration: 1 };
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
              estimatedDuration: Number(d.data().estimatedDuration) || 1,
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

  function setDuration(id: string, estimatedDuration: number) {
    setServiceState((prev) => ({
      ...prev,
      [id]: { ...prev[id], estimatedDuration },
    }));
  }

  async function handleContinue() {
    const selectedEntries = AC_SUB_SERVICES.filter((s) => serviceState[s.id]?.selected);

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
          estimatedDuration: serviceState[s.id].estimatedDuration,
          type: 'fixed',
        };
        if (isEditMode && existingDocs[s.id]) {
          // Update existing doc — avoids duplicate
          batch.update(doc(servicesCol, existingDocs[s.id]), {
            price: payload.price,
            estimatedDuration: payload.estimatedDuration,
          });
        } else {
          batch.set(doc(servicesCol), payload);
        }
      }

      await batch.commit();

      if (isEditMode) {
        router.back();
      } else {
        // See provider-onboarding-tv.tsx for why this checks onboardingComplete first —
        // the profile step should only ever run once, not every time a provider re-adds
        // this category's services after deleting them via "Add Category".
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
          <Text style={styles.subtitle}>{t('categories.ac')}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {isLoading && <Text style={styles.loadingText}>{t('common.loading')}</Text>}

        {!isLoading && AC_SUB_SERVICES.map((service) => {
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
                <Ionicons name={service.icon} size={22} color={selected ? '#000000' : '#cccccc'} />
                <Text style={styles.serviceName}>{t(service.labelKey)}</Text>
              </TouchableOpacity>

              {selected && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{t('myServicesScreen.priceLabel')}</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder={t('common.egValue', { value: 80000 })}
                    placeholderTextColor="#999999"
                    value={entry.price}
                    onChangeText={(v) => setPrice(service.id, v)}
                    keyboardType="numeric"
                  />
                </View>
              )}

              {selected && (
                <View style={styles.durationRow}>
                  <Text style={styles.priceLabel}>{t('myServicesScreen.estimatedDuration')}</Text>
                  <View style={styles.durationPills}>
                    {DURATION_OPTIONS.map((hrs) => {
                      const isActive = entry.estimatedDuration === hrs;
                      return (
                        <TouchableOpacity
                          key={hrs}
                          style={[styles.durationPill, isActive && styles.durationPillActive]}
                          onPress={() => setDuration(service.id, hrs)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.durationPillText, isActive && styles.durationPillTextActive]}>
                            {hrs}{t('myServicesScreen.hourAbbrev')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
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
  durationRow: {
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
  durationPills: {
    flexDirection: 'row',
    gap: 8,
  },
  durationPill: {
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  durationPillActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  durationPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  durationPillTextActive: {
    color: '#ffffff',
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
