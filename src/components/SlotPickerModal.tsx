import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AvailableDate,
  DayAvailability,
  TimeBlock,
  filterSlotsForDate,
  generateSlots,
  getBlockedSlots,
  getUpcomingDates,
  isSlotBlocked,
} from '@/lib/availability';
import { formatTime } from '@/lib/dateFormat';

// The same date-accordion + slot-chip picker used for new bookings
// (provider-profile-view.tsx), extracted so the reschedule flow
// (provider/booking-detail.tsx) can present the exact same
// constrained-to-availability UI instead of a free-form date/time picker —
// this is what actually prevents a provider from proposing a reschedule into a
// slot they're already booked elsewhere.

export interface SlotPickerResult {
  dateStr: string;
  time: string;
  hours?: number;
}

interface SlotPickerModalProps {
  visible: boolean;
  onClose: () => void;
  providerId: string;
  availability: Record<string, DayAvailability>;
  title: string;
  confirmLabel: string;
  isHourly?: boolean;
  minHours?: number;
  maxHours?: number;
  hourlyRate?: number;
  // Company-style categories with multiple staff (e.g. curtain cleaning) don't need
  // single-technician slot conflict prevention — several employees can take the same
  // hour. Defaults to true (the AC/hourly-provider behavior of one person, one slot).
  checkConflicts?: boolean;
  onConfirm: (result: SlotPickerResult) => void;
}

export default function SlotPickerModal({
  visible,
  onClose,
  providerId,
  availability,
  title,
  confirmLabel,
  isHourly = false,
  minHours = 1,
  maxHours = 8,
  hourlyRate = 0,
  checkConflicts = true,
  onConfirm,
}: SlotPickerModalProps) {
  const { t, i18n } = useTranslation();
  const [expandedDateStr, setExpandedDateStr] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<AvailableDate | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [hours, setHours] = useState(minHours);
  const [blockedSlotsByDate, setBlockedSlotsByDate] = useState<Record<string, TimeBlock[]>>({});

  // Resets picker state each time the sheet opens, not just on first mount — without
  // this a previous selection (or one left over from a different booking) would
  // silently carry over the next time this same modal instance is reopened.
  useEffect(() => {
    if (!visible) return;
    setExpandedDateStr(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setHours(minHours);
    setBlockedSlotsByDate({});
  }, [visible, minHours]);

  async function handleDateRowPress(d: AvailableDate, isExpanded: boolean) {
    setExpandedDateStr(isExpanded ? null : d.dateStr);
    if (checkConflicts && !isExpanded && !(d.dateStr in blockedSlotsByDate)) {
      const blocks = await getBlockedSlots(providerId, d.dateStr);
      setBlockedSlotsByDate((prev) => ({ ...prev, [d.dateStr]: blocks }));
    }
  }

  const availableDates = getUpcomingDates(availability, false, i18n.language, t);
  const canContinue = selectedDate !== null && selectedTime !== null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#000000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {availableDates.length === 0 ? (
              <Text style={styles.noDataText}>{t('provider.noDatesAvailable')}</Text>
            ) : (
              availableDates.map((d, index) => {
                const rawSlots = generateSlots(availability[d.dayKey]?.blocks ?? []);
                const blockedRanges = checkConflicts ? (blockedSlotsByDate[d.dateStr] ?? []) : [];
                const slots = filterSlotsForDate(
                  rawSlots.filter((slot) => !isSlotBlocked(slot, blockedRanges)),
                  d.dateStr,
                );
                const isExpanded = expandedDateStr === d.dateStr;
                const isSelected = selectedDate?.dateStr === d.dateStr;
                const displayTime = isSelected
                  ? formatTime(selectedTime!, i18n.language)
                  : slots.length > 0
                    ? formatTime(slots[0], i18n.language)
                    : '';

                return (
                  <View key={d.dateStr}>
                    <TouchableOpacity
                      style={[
                        styles.dateRow,
                        index > 0 && styles.dateRowBorder,
                        isSelected && styles.dateRowSelected,
                      ]}
                      onPress={() => handleDateRowPress(d, isExpanded)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dateRowLabel, isSelected && styles.dateRowLabelSelected]}>
                        {d.label}
                      </Text>
                      <View style={styles.dateRowRight}>
                        {displayTime ? (
                          <Text style={[styles.dateRowTime, isSelected && styles.dateRowTimeSelected]}>
                            {displayTime}
                          </Text>
                        ) : null}
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={isSelected ? '#ffffff' : '#999999'}
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.slotsContainer}>
                        {slots.length === 0 ? (
                          <Text style={styles.noSlotsText}>{t('provider.noTimeSlotsAvailable')}</Text>
                        ) : (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.slotsScroll}
                          >
                            {slots.map((slot) => {
                              const slotSelected = isSelected && selectedTime === slot;
                              return (
                                <TouchableOpacity
                                  key={slot}
                                  style={[styles.slotChip, slotSelected && styles.slotChipSelected]}
                                  onPress={() => {
                                    setSelectedDate(d);
                                    setSelectedTime(slot);
                                    setExpandedDateStr(null);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.slotChipText, slotSelected && styles.slotChipTextSelected]}>
                                    {formatTime(slot, i18n.language)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
            <View style={{ height: 16 }} />
          </ScrollView>

          {isHourly && selectedDate && selectedTime && (
            <View style={styles.stepperSection}>
              <Text style={styles.stepperLabel}>{t('provider.numberOfHours')}</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperButton, hours <= minHours && styles.stepperButtonDisabled]}
                  onPress={() => setHours((h) => Math.max(minHours, h - 1))}
                  disabled={hours <= minHours}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={20} color={hours <= minHours ? '#cccccc' : '#000000'} />
                </TouchableOpacity>
                <Text style={styles.stepperCount}>{hours}</Text>
                <TouchableOpacity
                  style={[styles.stepperButton, hours >= maxHours && styles.stepperButtonDisabled]}
                  onPress={() => setHours((h) => Math.min(maxHours, h + 1))}
                  disabled={hours >= maxHours}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color={hours >= maxHours ? '#cccccc' : '#000000'} />
                </TouchableOpacity>
              </View>
              <Text style={styles.stepperTotal}>
                {t('provider.totalPrefix')}: {(hourlyRate * hours).toLocaleString('en-US')} {t('common.currency')}
              </Text>
            </View>
          )}

          <View style={styles.sheetFooter}>
            <TouchableOpacity
              style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
              onPress={() => {
                if (!selectedDate || !selectedTime) return;
                onConfirm({ dateStr: selectedDate.dateStr, time: selectedTime, hours: isHourly ? hours : undefined });
              }}
              disabled={!canContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  sheetBody: {
    maxHeight: 340,
  },
  noDataText: {
    color: '#bbbbbb',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dateRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dateRowSelected: {
    backgroundColor: '#000000',
  },
  dateRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  dateRowLabelSelected: {
    color: '#ffffff',
  },
  dateRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateRowTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  dateRowTimeSelected: {
    color: '#ffffff',
  },
  slotsContainer: {
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingVertical: 12,
  },
  slotsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  slotChip: {
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  slotChipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  slotChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  slotChipTextSelected: {
    color: '#ffffff',
  },
  noSlotsText: {
    fontSize: 13,
    color: '#bbbbbb',
    paddingHorizontal: 20,
  },
  stepperSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 12,
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  stepperButtonDisabled: {
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  stepperCount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    minWidth: 32,
    textAlign: 'center',
  },
  stepperTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  continueButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
