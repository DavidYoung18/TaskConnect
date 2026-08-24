import { collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '@/lib/firebase';
import { getCategoryNameKey, getSubServiceNameKey } from '@/lib/serviceNames';
import { useAuthUser } from '@/lib/useAuthUser';

type ServiceIcon =
  | { lib: 'ionicons'; name: React.ComponentProps<typeof Ionicons>['name'] }
  | { lib: 'mci'; name: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };

const subServiceIcons: Record<string, ServiceIcon> = {
  'blockage-drainage-removal':    { lib: 'mci',      name: 'pipe-leak' },
  'leakage-repair':               { lib: 'ionicons', name: 'water' },
  'toilet-repair-installation':   { lib: 'mci',      name: 'toilet' },
  'tap-mixer-repair-installation':{ lib: 'mci',      name: 'faucet' },
  'jet-spray-installation':       { lib: 'mci',      name: 'shower-head' },
  'geyser-installation':          { lib: 'mci',      name: 'water-boiler' },
};

function ServiceIcon({ id, selected }: { id: string; selected: boolean }) {
  const icon = subServiceIcons[id];
  const color = selected ? '#000000' : '#cccccc';
  if (!icon) return null;
  if (icon.lib === 'mci') {
    return <MaterialCommunityIcons name={icon.name} size={22} color={color} />;
  }
  return <Ionicons name={icon.name} size={22} color={color} />;
}
interface SubService {
  id: string;
  name: string;
}

interface Category {
  name: string;
  hasHourlyOption: boolean;
  hourlyRateRange: { minHours: number; maxHours: number };
  subServices: SubService[];
}

const DURATION_OPTIONS = [1, 2, 3, 4];

interface ServiceEntry {
  selected: boolean;
  price: string;
  estimatedDuration: number;
}

// Maps subServiceId → existing providerServices doc ID (for upsert in edit mode)
type ExistingDocMap = Record<string, string>;

export default function ProviderOnboardingServicesScreen() {
  const { t } = useTranslation();
  const { categoryId, mode } = useLocalSearchParams<{ categoryId: string; mode?: string }>();
  const isEditMode = mode === 'edit';

  const [category, setCategory] = useState<Category | null>(null);
  const [serviceState, setServiceState] = useState<Record<string, ServiceEntry>>({});
  const [hourlyEnabled, setHourlyEnabled] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [existingDocs, setExistingDocs] = useState<ExistingDocMap>({});
  const { user } = useAuthUser();

  function categoryName(): string {
    if (!category) return '';
    const key = getCategoryNameKey(categoryId);
    return key ? t(key) : category.name;
  }

  function subServiceName(service: SubService): string {
    const key = getSubServiceNameKey(service.id);
    return key ? t(key) : service.name;
  }

  useEffect(() => {
    if (!categoryId) return;
    if (isEditMode && !user) return;
    loadScreen();
  }, [categoryId, user]);

  async function loadScreen() {
    const categorySnap = await getDoc(doc(db, 'categories', categoryId));
    if (!categorySnap.exists()) return;
    const data = categorySnap.data() as Category;
    setCategory(data);

    // Build initial service state — all unselected/empty
    const initial: Record<string, ServiceEntry> = {};
    data.subServices.forEach((s) => {
      initial[s.id] = { selected: false, price: '', estimatedDuration: 1 };
    });

    if (isEditMode) {
      const uid = user?.uid;
      if (uid) {
        const q = query(
          collection(db, 'users', uid, 'providerServices'),
          where('categoryId', '==', categoryId),
        );
        const existing = await getDocs(q);
        const docMap: ExistingDocMap = {};

        existing.docs.forEach((d) => {
          const sd = d.data().subServiceId as string;
          docMap[sd] = d.id;

          if (sd === 'hourly') {
            setHourlyEnabled(true);
            setHourlyRate(String(d.data().hourlyRate ?? ''));
          } else if (initial[sd]) {
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
    const selectedEntries = category?.subServices.filter((s) => serviceState[s.id]?.selected) ?? [];

    // A category can have zero fixed sub-services and rely on hourly pricing alone (e.g.
    // furniture assembly) — only block continuing when NEITHER a fixed service NOR hourly
    // is selected, not just whenever the fixed-service list happens to be empty.
    if (selectedEntries.length === 0 && !hourlyEnabled) {
      Alert.alert(t('alerts.selectAtLeastOneService'));
      return;
    }

    const missingPrice = selectedEntries.find((s) => {
      const p = serviceState[s.id]?.price.trim();
      return !p || isNaN(Number(p));
    });
    if (missingPrice) {
      Alert.alert(t('alerts.invalidPriceForService', { name: subServiceName(missingPrice) }));
      return;
    }

    // Gated on hourlyEnabled, not just category.hasHourlyOption — hourly is an opt-in
    // toggle the provider switches on, not a requirement just because it's available.
    if (hourlyEnabled && (!hourlyRate.trim() || isNaN(Number(hourlyRate)))) {
      Alert.alert(t('alerts.hourlyRateRequired'));
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
          categoryId,
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

      if (hourlyEnabled && category) {
        const hourlyPayload = {
          categoryId,
          subServiceId: 'hourly',
          name: 'Hourly Booking',
          hourlyRate: parseFloat(hourlyRate),
          minHours: category.hourlyRateRange.minHours,
          maxHours: category.hourlyRateRange.maxHours,
          type: 'hourly',
        };
        if (isEditMode && existingDocs['hourly']) {
          batch.update(doc(servicesCol, existingDocs['hourly']), {
            hourlyRate: hourlyPayload.hourlyRate,
          });
        } else {
          batch.set(doc(servicesCol), hourlyPayload);
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
          {category && <Text style={styles.subtitle}>{categoryName()}</Text>}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!category && <Text style={styles.loadingText}>{t('common.loading')}</Text>}

        {category?.subServices.map((service) => {
          const entry = serviceState[service.id];
          const selected = entry?.selected ?? false;
          return (
            <View key={service.id} style={styles.serviceGroup}>
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
                <ServiceIcon id={service.id} selected={selected} />
                <Text style={styles.serviceName}>{subServiceName(service)}</Text>
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

        {category?.hasHourlyOption && (
          <View style={styles.serviceGroup}>
            <TouchableOpacity
              style={[styles.card, hourlyEnabled && styles.cardSelected]}
              onPress={() => setHourlyEnabled((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={styles.checkbox}>
                {hourlyEnabled
                  ? <Ionicons name="checkmark-circle" size={24} color="#000000" />
                  : <Ionicons name="ellipse-outline" size={24} color="#cccccc" />
                }
              </View>
              <Ionicons name="time-outline" size={22} color={hourlyEnabled ? '#000000' : '#cccccc'} />
              <View style={styles.hourlyInfo}>
                <Text style={styles.serviceName}>{t('subServices.hourlyBooking')}</Text>
                <Text style={styles.hourlyRange}>
                  {t('myServicesScreen.hourlyRangeHours', {
                    min: category.hourlyRateRange.minHours,
                    max: category.hourlyRateRange.maxHours,
                  })}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{t('myServicesScreen.hourlyRateLabel')}</Text>
              <TextInput
                style={styles.priceInput}
                placeholder={t('common.egValue', { value: 50000 })}
                placeholderTextColor="#999999"
                value={hourlyRate}
                onChangeText={setHourlyRate}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving}>
          <Text style={styles.continueButtonText}>
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
  list: {
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#999999',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  serviceGroup: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 8,
    marginBottom: 12,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
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
  hourlyInfo: {
    flex: 1,
  },
  hourlyRange: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  priceRow: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  durationPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
