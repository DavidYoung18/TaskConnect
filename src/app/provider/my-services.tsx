import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getCategoryNameKey, getSubServiceNameKey } from '@/lib/serviceNames';
import { useAuthUser } from '@/lib/useAuthUser';

const DURATION_OPTIONS = [1, 2, 3, 4];

interface ProviderService {
  id: string;
  categoryId: string;
  subServiceId: string;
  name: string;
  price?: number;
  hourlyRate?: number;
  estimatedDuration?: number;
  type: 'fixed' | 'hourly' | 'cleaning-company' | 'curtain-company' | 'carpet-company';
  // cleaning-company fields
  about?: string;
  staffCount?: number;
  rateWithoutTools?: number;
  rateWithTools?: number;
  // curtain-company / carpet-company field
  ratePerSqm?: number;
}

interface CategorySection {
  categoryId: string;
  rawCategoryName: string;
  services: ProviderService[];
}

interface EditTarget {
  service: ProviderService;
  currentValue: string;
}

function formatPrice(service: ProviderService, t: (key: string) => string): string {
  const currency = t('common.currency');
  if (service.type === 'hourly') {
    return `${(service.hourlyRate ?? 0).toLocaleString('en-US')} ${currency}${t('common.perHour')}`;
  }
  return `${(service.price ?? 0).toLocaleString('en-US')} ${currency}`;
}

function displayServiceName(service: ProviderService, t: (key: string) => string): string {
  const key = getSubServiceNameKey(service.subServiceId);
  return key ? t(key) : service.name;
}

function displayCategoryName(section: CategorySection, t: (key: string) => string): string {
  const key = getCategoryNameKey(section.categoryId);
  return key ? t(key) : section.rawCategoryName;
}

export default function MyServicesScreen() {
  const { t } = useTranslation();
  const [sections, setSections] = useState<CategorySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDuration, setEditDuration] = useState(1);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { user } = useAuthUser();

  useEffect(() => {
    if (!user) return;
    loadServices();
  }, [user]);

  async function loadServices() {
    const uid = user?.uid;
    if (!uid) return;

    const [snap, userSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'providerServices')),
      getDoc(doc(db, 'users', uid)),
    ]);
    if (userSnap.exists()) setCompanyName((userSnap.data().companyName as string) ?? '');

    const services: ProviderService[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ProviderService, 'id'>),
    }));

    const grouped: Record<string, ProviderService[]> = {};
    for (const s of services) {
      if (!grouped[s.categoryId]) grouped[s.categoryId] = [];
      grouped[s.categoryId].push(s);
    }

    const categoryIds = Object.keys(grouped);
    const categoryDocs = await Promise.all(
      categoryIds.map((id) => getDoc(doc(db, 'categories', id)))
    );

    const result: CategorySection[] = categoryIds.map((categoryId, i) => ({
      categoryId,
      rawCategoryName: categoryDocs[i].exists()
        ? (categoryDocs[i].data() as { name: string }).name
        : categoryId,
      services: grouped[categoryId],
    }));

    setSections(result);
    setLoading(false);
  }

  function openEdit(service: ProviderService) {
    const current = service.type === 'hourly'
      ? String(service.hourlyRate ?? '')
      : service.type === 'curtain-company' || service.type === 'carpet-company'
        ? String(service.ratePerSqm ?? '')
        : String(service.price ?? '');
    setEditTarget({ service, currentValue: current });
    setEditValue(current);
    setEditDuration(service.estimatedDuration ?? 1);
    // Focus the input after the modal renders
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function closeEdit() {
    setEditTarget(null);
    setEditValue('');
    setEditDuration(1);
  }

  function confirmDelete(service: ProviderService) {
    Alert.alert(
      t('myServicesScreen.removeService'),
      t('alerts.removeServiceConfirm', { name: displayServiceName(service, t) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.remove'), style: 'destructive', onPress: () => handleDelete(service) },
      ]
    );
  }

  async function handleDelete(service: ProviderService) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      await deleteDoc(doc(db, 'users', uid, 'providerServices', service.id));

      setSections((prev) =>
        prev
          .map((section) => ({
            ...section,
            services: section.services.filter((s) => s.id !== service.id),
          }))
          .filter((section) => section.services.length > 0)
      );
    } catch {
      Alert.alert(t('alerts.errorTitle'), t('alerts.removeServiceError'));
    }
  }

  async function handleSave() {
    if (!editTarget) return;

    const num = parseFloat(editValue.trim());
    if (!editValue.trim() || isNaN(num) || num <= 0) {
      Alert.alert(t('alerts.invalidPriceTitle'), t('alerts.invalidPriceMessage'));
      return;
    }

    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not signed in');

      const isSqmRate = editTarget.service.type === 'curtain-company' || editTarget.service.type === 'carpet-company';
      const field = editTarget.service.type === 'hourly' ? 'hourlyRate' : isSqmRate ? 'ratePerSqm' : 'price';
      const isFixed = editTarget.service.type === 'fixed';
      await updateDoc(
        doc(db, 'users', uid, 'providerServices', editTarget.service.id),
        isFixed ? { [field]: num, estimatedDuration: editDuration } : { [field]: num }
      );

      // Update local state without refetching
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          services: section.services.map((s) =>
            s.id === editTarget.service.id
              ? { ...s, [field]: num, ...(isFixed ? { estimatedDuration: editDuration } : {}) }
              : s
          ),
        }))
      );

      closeEdit();
    } catch {
      Alert.alert(t('alerts.errorTitle'), t('alerts.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('provider.myServices')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading && <Text style={styles.emptyText}>{t('common.loading')}</Text>}

        {!loading && sections.length === 0 && (
          <Text style={styles.emptyText}>{t('myServicesScreen.noServicesYet')}</Text>
        )}

        {sections.map((section) => (
          <View key={section.categoryId} style={styles.section}>
            <Text style={styles.sectionHeader}>{displayCategoryName(section, t)}</Text>

            {(() => {
              const cleaningEntry = section.services.find((s) => s.type === 'cleaning-company');
              const curtainEntry = section.services.find((s) => s.type === 'curtain-company');
              const carpetEntry = section.services.find((s) => s.type === 'carpet-company');
              const regularServices = section.services.filter(
                (s) => s.type !== 'cleaning-company' && s.type !== 'curtain-company' && s.type !== 'carpet-company',
              );
              return (
                <>
                  {cleaningEntry && (
                    <TouchableOpacity
                      style={styles.cleaningCard}
                      onPress={() => router.push('/provider-onboarding-cleaning?categoryId=cleaning&mode=edit')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.cleaningCardHeader}>
                        <Text style={styles.cleaningCardTitle}>
                          {companyName || t('myServicesScreen.cleaningServicesTitle')}
                        </Text>
                        <Ionicons name="pencil-outline" size={14} color="#999999" />
                      </View>
                      <Text style={styles.cleaningDetail}>
                        {t('myServicesScreen.staffCountValue', { count: cleaningEntry.staffCount ?? 0 })}
                      </Text>
                      <View style={styles.cleaningRates}>
                        <Text style={styles.cleaningRate}>
                          {t('myServicesScreen.rateWithoutToolsValue', { price: (cleaningEntry.rateWithoutTools ?? 0).toLocaleString('en-US') })}
                        </Text>
                        <Text style={styles.cleaningRate}>
                          {t('myServicesScreen.rateWithToolsValue', { price: (cleaningEntry.rateWithTools ?? 0).toLocaleString('en-US') })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Curtain/carpet cards open the same lightweight price-only modal used
                      for regular services below — company name and photo are edited from
                      Account Details now, not from here. */}
                  {curtainEntry && (
                    <TouchableOpacity
                      style={styles.cleaningCard}
                      onPress={() => openEdit(curtainEntry)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.cleaningCardHeader}>
                        <Text style={styles.cleaningCardTitle}>
                          {companyName || t('myServicesScreen.curtainServicesTitle')}
                        </Text>
                        <Ionicons name="pencil-outline" size={14} color="#999999" />
                      </View>
                      <Text style={styles.cleaningRate}>
                        {t('myServicesScreen.ratePerSqmValue', { price: (curtainEntry.ratePerSqm ?? 0).toLocaleString('en-US') })}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {carpetEntry && (
                    <TouchableOpacity
                      style={styles.cleaningCard}
                      onPress={() => openEdit(carpetEntry)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.cleaningCardHeader}>
                        <Text style={styles.cleaningCardTitle}>
                          {companyName || t('myServicesScreen.carpetServicesTitle')}
                        </Text>
                        <Ionicons name="pencil-outline" size={14} color="#999999" />
                      </View>
                      <Text style={styles.cleaningRate}>
                        {t('myServicesScreen.ratePerSqmValue', { price: (carpetEntry.ratePerSqm ?? 0).toLocaleString('en-US') })}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {regularServices.length > 0 && (
                    <View style={styles.serviceList}>
                      {regularServices.map((service, index) => (
                        <View
                          key={service.id}
                          style={[
                            styles.serviceRow,
                            index < regularServices.length - 1 && styles.serviceRowBorder,
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.serviceRowMain}
                            onPress={() => openEdit(service)}
                            activeOpacity={0.6}
                          >
                            <View style={styles.serviceNameCol}>
                              <Text style={styles.serviceName}>{displayServiceName(service, t)}</Text>
                              {service.type === 'fixed' && service.estimatedDuration != null && (
                                <Text style={styles.serviceDuration}>~{service.estimatedDuration}hr</Text>
                              )}
                            </View>
                            <View style={styles.priceChip}>
                              <Text style={styles.servicePrice}>{formatPrice(service, t)}</Text>
                              <Ionicons name="pencil-outline" size={13} color="#999999" />
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => confirmDelete(service)}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="trash-outline" size={16} color="#cc3333" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              );
            })()}

            {/* Companies (cleaning, curtain, carpet) only ever have the one company
                "service" doc, already editable via its card above — there's nothing to
                add more of, so this button is only relevant for per-job categories.
                AC and TV mounting price against their own hardcoded, category-specific
                lists (AC_SUB_SERVICES / TV_SIZE_OPTIONS) — not the generic services
                form, which has no idea those lists exist and would show nothing. */}
            {!['cleaning', 'curtain-cleaning', 'carpet-wash'].includes(section.categoryId) && (
              <TouchableOpacity
                style={styles.addMoreButton}
                onPress={() =>
                  section.categoryId === 'ac'
                    ? router.push(`/provider-onboarding-ac?categoryId=ac&mode=edit`)
                    : section.categoryId === 'tv-mounting'
                      ? router.push(`/provider-onboarding-tv?categoryId=tv-mounting&mode=edit`)
                      : router.push(`/provider-onboarding-services?categoryId=${section.categoryId}&mode=edit`)
                }
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color="#000000" />
                <Text style={styles.addMoreText}>{t('myServicesScreen.addMoreServices')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {!loading && sections.length === 0 && (
          <TouchableOpacity
            style={styles.addCategoryButton}
            onPress={() => router.push('/provider-onboarding-category?mode=add')}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
            <Text style={styles.addCategoryText}>{t('myServicesScreen.addNewCategory')}</Text>
          </TouchableOpacity>
        )}

        {!loading && sections.length > 0 && (
          <Text style={styles.lockNote}>
            {t('myServicesScreen.categoryLockNote', { category: displayCategoryName(sections[0], t) })}
          </Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Price edit modal */}
      <Modal
        visible={editTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeEdit} />

          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editTarget ? displayServiceName(editTarget.service, t) : ''}</Text>
            <Text style={styles.modalLabel}>
              {editTarget?.service.type === 'hourly'
                ? t('myServicesScreen.hourlyRateLabel')
                : editTarget?.service.type === 'curtain-company' || editTarget?.service.type === 'carpet-company'
                  ? t('providerOnboarding.curtainRateLabel')
                  : t('myServicesScreen.priceLabel')}
            </Text>

            <TextInput
              ref={inputRef}
              style={styles.modalInput}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              placeholder={t('common.egValue', { value: 80000 })}
              placeholderTextColor="#999999"
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            {editTarget?.service.type === 'fixed' && (
              <>
                <Text style={styles.modalLabel}>{t('myServicesScreen.estimatedDuration')}</Text>
                <View style={styles.durationPills}>
                  {DURATION_OPTIONS.map((hrs) => {
                    const isActive = editDuration === hrs;
                    return (
                      <TouchableOpacity
                        key={hrs}
                        style={[styles.durationPill, isActive && styles.durationPillActive]}
                        onPress={() => setEditDuration(hrs)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.durationPillText, isActive && styles.durationPillTextActive]}>
                          {hrs}hr
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeEdit} activeOpacity={0.7}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveText}>{saving ? t('common.updating') : t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
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
  scrollContent: {
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  serviceList: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    overflow: 'hidden',
    marginBottom: 8,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  serviceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  serviceRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteButton: {
    padding: 4,
    flexShrink: 0,
  },
  serviceNameCol: {
    flex: 1,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
  },
  serviceDuration: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444444',
  },
  cleaningCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 8,
    gap: 6,
  },
  cleaningCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cleaningCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  cleaningDetail: {
    fontSize: 13,
    color: '#666666',
  },
  cleaningRates: {
    gap: 2,
  },
  cleaningRate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444444',
  },
  cleaningTools: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  addCategoryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  lockNote: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  durationPills: {
    flexDirection: 'row',
    gap: 8,
  },
  durationPill: {
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
