import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Address, getAddresses } from '@/lib/addresses';
import { formatWeekdayMonthDay } from '@/lib/dateFormat';
import { useAuthUser } from '@/lib/useAuthUser';

const SPACE_TYPE_OPTIONS = [
  { value: 'apartment', labelKey: 'cleaningIntake.apartment' },
  { value: 'house', labelKey: 'cleaningIntake.house' },
  { value: 'commercial', labelKey: 'cleaningIntake.commercial' },
];

const ROOM_COUNT_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '9+'];
const BATHROOM_COUNT_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '6+'];

const CLEANING_TYPE_OPTIONS = [
  { value: 'regular', labelKey: 'cleaningIntake.regularCleaning' },
  { value: 'deep', labelKey: 'cleaningIntake.deepCleaning' },
  { value: 'post-construction', labelKey: 'cleaningIntake.postConstructionCleaning' },
];

const TOTAL_STEPS = 8;

// Local, not toISOString() — the latter reads the date back in UTC and silently
// shifts it a day in positive-UTC-offset timezones (e.g. Tashkent, UTC+5).
function dateToLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// How far out a cleaning can be scheduled — without this, nothing stops a customer
// from scrolling the calendar into 2027+ and searching for a wildly wrong date.
// 90 days covers reasonable advance planning (e.g. a move-out clean ahead of a
// lease end) without leaving the range effectively unbounded.
function maxCleaningDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d;
}

export default function CleaningIntakeScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthUser();

  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [spaceType, setSpaceType] = useState<string | null>(null);
  const [squareMeters, setSquareMeters] = useState('');
  const [roomCount, setRoomCount] = useState<string | null>(null);
  const [bathroomCount, setBathroomCount] = useState<string | null>(null);
  const [cleaningType, setCleaningType] = useState<string | null>(null);
  const [cleanersRequested, setCleanersRequested] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getAddresses(user.uid).then((list) => {
        setAddresses(list);
        setSelectedAddressId((prev) => {
          if (prev && list.some((a) => a.id === prev)) return prev;
          const def = list.find((a) => a.isDefault) ?? list[0];
          return def?.id ?? null;
        });
      });
    }, [user]),
  );

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const cleanersNum = parseInt(cleanersRequested.trim(), 10);
  const sqmNum = parseFloat(squareMeters.trim());

  const stepValid = [
    selectedAddress !== null,
    spaceType !== null,
    squareMeters.trim() !== '' && !isNaN(sqmNum) && sqmNum > 0,
    roomCount !== null,
    bathroomCount !== null,
    cleaningType !== null,
    cleanersRequested.trim() !== '' && !isNaN(cleanersNum) && cleanersNum > 0,
    selectedDate !== null,
  ][step];

  function handleBack() {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((s) => s - 1);
  }

  function handleNext() {
    if (!stepValid) return;
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    if (!selectedAddress) return;
    const params = [
      'categoryId=cleaning',
      `spaceType=${spaceType}`,
      `squareMeters=${sqmNum}`,
      `roomCount=${roomCount}`,
      `bathroomCount=${bathroomCount}`,
      `cleaningType=${cleaningType}`,
      `cleanersRequested=${cleanersNum}`,
      `addressId=${selectedAddress.id}`,
      `date=${dateToLocalDateStr(selectedDate)}`,
    ];
    router.push(`/provider-list?${params.join('&')}`);
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('cleaningIntake.selectAddressQuestion')}</Text>
            {addresses.length === 0 ? (
              <Text style={styles.emptyText}>{t('addressesScreen.noSavedAddresses')}</Text>
            ) : (
              addresses.map((a) => {
                const selected = selectedAddressId === a.id;
                return (
                  <View key={a.id} style={[styles.card, selected && styles.cardSelected]}>
                    <TouchableOpacity
                      onPress={() => setSelectedAddressId(a.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
                    >
                      <View style={styles.radioOuter}>
                        {selected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                    {/* Tapping the text takes you to the map to confirm exactly where this
                        saved address points — the radio circle above is the only thing that
                        just selects it, matching how addresses.tsx already lets you tap
                        through to view/edit a saved address on the map. */}
                    <TouchableOpacity
                      style={styles.cardTextBlock}
                      onPress={() => router.push(`/add-address?id=${a.id}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{a.label}</Text>
                      <Text style={styles.cardSub} numberOfLines={2}>{a.fullAddress}</Text>
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={18} color="#999999" />
                  </View>
                );
              })
            )}
            <TouchableOpacity
              style={styles.addAddressButton}
              onPress={() => router.push('/add-address')}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#000000" />
              <Text style={styles.addAddressText}>{t('addressesScreen.addAddress')}</Text>
            </TouchableOpacity>
          </View>
        );
      case 1:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('cleaningIntake.spaceTypeQuestion')}</Text>
            {SPACE_TYPE_OPTIONS.map((opt) => {
              const selected = spaceType === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => setSpaceType(opt.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioOuter}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{t(opt.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      case 2:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('cleaningIntake.squareMetersQuestion')}</Text>
            <TextInput
              style={styles.numberInput}
              value={squareMeters}
              onChangeText={setSquareMeters}
              keyboardType="numeric"
              placeholder={t('common.egValue', { value: 70 })}
              placeholderTextColor="#999999"
              autoFocus
            />
          </View>
        );
      case 3:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('cleaningIntake.roomCountQuestion')}</Text>
            <View style={styles.pillRow}>
              {ROOM_COUNT_OPTIONS.map((opt) => {
                const selected = roomCount === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.pill, selected && styles.pillSelected]}
                    onPress={() => setRoomCount(opt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      case 4:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('cleaningIntake.bathroomCountQuestion')}</Text>
            <View style={styles.pillRow}>
              {BATHROOM_COUNT_OPTIONS.map((opt) => {
                const selected = bathroomCount === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.pill, selected && styles.pillSelected]}
                    onPress={() => setBathroomCount(opt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      case 5:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('cleaningIntake.cleaningTypeQuestion')}</Text>
            {CLEANING_TYPE_OPTIONS.map((opt) => {
              const selected = cleaningType === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => setCleaningType(opt.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioOuter}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{t(opt.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      case 6:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('cleaningIntake.cleanersRequestedQuestion')}</Text>
            <TextInput
              style={styles.numberInput}
              value={cleanersRequested}
              onChangeText={setCleanersRequested}
              keyboardType="number-pad"
              placeholder={t('common.egValue', { value: 2 })}
              placeholderTextColor="#999999"
              autoFocus
            />
            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={16} color="#1e40af" style={styles.noticeIcon} />
              <Text style={styles.noticeText}>{t('cleaningIntake.cleanersGuidelineNote')}</Text>
            </View>
            <View style={styles.noticeBox}>
              <Ionicons name="time-outline" size={16} color="#1e40af" style={styles.noticeIcon} />
              <Text style={styles.noticeText}>{t('cleaningIntake.workingHoursNote')}</Text>
            </View>
          </View>
        );
      case 7:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('cleaningIntake.dateQuestion')}</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                mode="date"
                display="inline"
                value={selectedDate}
                minimumDate={new Date()}
                maximumDate={maxCleaningDate()}
                onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                  if (selected) setSelectedDate(selected);
                }}
                themeVariant="light"
                textColor="#000000"
                accentColor="#000000"
                locale={i18n.language}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowAndroidDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={20} color="#000000" />
                  <Text style={styles.dateButtonText}>
                    {formatWeekdayMonthDay(selectedDate, i18n.language)}
                  </Text>
                </TouchableOpacity>
                {showAndroidDatePicker && (
                  <DateTimePicker
                    mode="date"
                    display="calendar"
                    value={selectedDate}
                    minimumDate={new Date()}
                    maximumDate={maxCleaningDate()}
                    onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                      setShowAndroidDatePicker(false);
                      if (selected) setSelectedDate(selected);
                    }}
                  />
                )}
              </>
            )}
          </View>
        );
      default:
        return null;
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('cleaningIntake.title')}</Text>
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {renderStep()}
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !stepValid && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!stepValid}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>
            {step < TOTAL_STEPS - 1 ? t('common.continue') : t('cleaningIntake.findCompanies')}
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 14,
  },
  backButton: {
    padding: 2,
    flexShrink: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e8e8e8',
  },
  progressDotActive: {
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  emptyText: {
    color: '#999999',
    fontSize: 14,
    marginBottom: 12,
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
    gap: 14,
  },
  cardSelected: {
    borderColor: '#000000',
    backgroundColor: '#f8f8f8',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cccccc',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  cardTextBlock: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
    lineHeight: 20,
  },
  cardLabelSelected: {
    color: '#000000',
  },
  cardSub: {
    fontSize: 12,
    color: '#999999',
  },
  cardIcon: {
    flexShrink: 0,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 14,
    marginTop: 4,
  },
  addAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  numberInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  pillSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  pillTextSelected: {
    color: '#ffffff',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  noticeIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#1e3a8a',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  nextButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
