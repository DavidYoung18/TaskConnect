import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  DAYS_OF_WEEK,
  DayAvailability,
  TimeBlock,
  addManualDayBlock,
  getBlockedSlots,
  getWeekAvailability,
  removeManualDayBlock,
  saveDayAvailability,
} from '@/lib/availability';
import { Booking } from '@/lib/bookings';
import { displayBookingServiceName } from '@/lib/serviceNames';
import { formatMonthDay, formatTime as formatTimeLocale } from '@/lib/dateFormat';
import { useAuthUser } from '@/lib/useAuthUser';
import ProviderBottomNav from '@/components/ProviderBottomNav';

const DAY_JS_INDEX: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
};

function nextOccurrenceDate(dayId: string): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let diff = DAY_JS_INDEX[dayId] - today.getDay();
  if (diff < 0) diff += 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

function nextOccurrenceLabel(dayId: string, language: string): string {
  const d = nextOccurrenceDate(dayId);
  return formatMonthDay(d, language);
}

// Builds "YYYY-MM-DD" from LOCAL date components — not toISOString(), which reads
// the date back in UTC and silently shifts it by a day in positive-UTC-offset
// timezones (e.g. Tashkent, UTC+5: local midnight is 19:00 the previous UTC day).
function nextOccurrenceDateStr(dayId: string): string {
  const d = nextOccurrenceDate(dayId);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateToHHMM(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatTime(hhmm: string, language: string): string {
  const parts = hhmm.split(':');
  if (parts.length < 2) return '';
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return '';
  return formatTimeLocale(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, language);
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

const CLEANING_DEFAULT_BLOCK = { startTime: '08:00', endTime: '18:00' };

type DayRow =
  | { kind: 'editable'; index: number; block: TimeBlock }
  | { kind: 'locked'; booking: Booking; endTime: string };

export default function AvailabilityTab() {
  const { t, i18n } = useTranslation();
  const [week, setWeek] = useState<Record<string, DayAvailability>>({});
  const [loading, setLoading] = useState(true);
  const [isCleaningProvider, setIsCleaningProvider] = useState(false);
  const [blockedSlotsByDay, setBlockedSlotsByDay] = useState<Record<string, TimeBlock[]>>({});
  const [confirmedBookingsByDay, setConfirmedBookingsByDay] = useState<Record<string, Booking[]>>({});
  const [serviceDurationMap, setServiceDurationMap] = useState<Record<string, number>>({});

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerStep, setPickerStep] = useState<'start' | 'end'>('start');
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [pickerEditIndex, setPickerEditIndex] = useState<number | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [tempStart, setTempStart] = useState('');
  const { user } = useAuthUser();

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    getWeekAvailability(uid).then((data) => {
      setWeek(data);
      setLoading(false);
    });

    const cleaningQuery = query(
      collection(db, 'users', uid, 'providerServices'),
      where('categoryId', '==', 'cleaning'),
      limit(1),
    );
    getDocs(cleaningQuery).then((snap) => {
      setIsCleaningProvider(!snap.empty);
    });

    // One-off: subServiceId -> estimatedDuration, so we can compute an end time
    // for confirmed bookings (which only store a start time) without a per-booking query.
    getDocs(collection(db, 'users', uid, 'providerServices')).then((snap) => {
      const map: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as { subServiceId?: string; estimatedDuration?: number };
        if (data.subServiceId && data.estimatedDuration != null) {
          map[data.subServiceId] = data.estimatedDuration;
        }
      });
      setServiceDurationMap(map);
    });
  }, [user]);

  function getBookingEndTime(b: Booking): string {
    let durationHours = 1;
    if (b.type === 'hourly' && b.hours) {
      durationHours = b.hours;
    } else if (b.subServiceId && serviceDurationMap[b.subServiceId] != null) {
      durationHours = serviceDurationMap[b.subServiceId];
    }
    const [h, m] = b.scheduledTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationHours * 60;
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;
    return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  }

  function findOverlappingBooking(dayId: string, startTime: string, endTime: string): Booking | null {
    const bookings = confirmedBookingsByDay[dayId] ?? [];
    for (const b of bookings) {
      if (rangesOverlap(startTime, endTime, b.scheduledTime, getBookingEndTime(b))) return b;
    }
    return null;
  }

  // Fetch blockedSlots + confirmed bookings for each day card that's toggled on, so the
  // provider can see at a glance which hours are already taken. Re-runs when `week`
  // changes (e.g. toggling a day on) and skips days already cached.
  useEffect(() => {
    if (loading) return;
    const uid = user?.uid;
    if (!uid) return;

    const daysNeedingFetch = DAYS_OF_WEEK.filter(
      (dayId) => week[dayId]?.isAvailable && !(dayId in confirmedBookingsByDay),
    );
    if (daysNeedingFetch.length === 0) return;

    Promise.all(
      daysNeedingFetch.map(async (dayId) => {
        const dateStr = nextOccurrenceDateStr(dayId);
        const [blocked, confirmedSnap] = await Promise.all([
          getBlockedSlots(uid, dateStr),
          getDocs(
            query(
              collection(db, 'bookings'),
              where('providerId', '==', uid),
              where('status', '==', 'confirmed'),
              where('scheduledDate', '==', dateStr),
            ),
          ),
        ]);
        const confirmedBookings = confirmedSnap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }),
        );
        return { dayId, blocked, confirmedBookings };
      }),
    ).then((results) => {
      setBlockedSlotsByDay((prev) => {
        const next = { ...prev };
        results.forEach(({ dayId, blocked }) => { next[dayId] = blocked; });
        return next;
      });
      setConfirmedBookingsByDay((prev) => {
        const next = { ...prev };
        results.forEach(({ dayId, confirmedBookings }) => { next[dayId] = confirmedBookings; });
        return next;
      });
    });
  }, [week, loading, user]);

  async function handleToggle(dayId: string, value: boolean) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    if (!value) {
      // Toggling OFF — refuse if there's a confirmed booking on this day's next occurrence
      const dateStr = nextOccurrenceDateStr(dayId);
      const confirmedQuery = query(
        collection(db, 'bookings'),
        where('providerId', '==', uid),
        where('status', '==', 'confirmed'),
        where('scheduledDate', '==', dateStr),
      );
      const confirmedSnap = await getDocs(confirmedQuery);
      if (!confirmedSnap.empty) {
        Alert.alert(
          t('alerts.cannotMarkUnavailableTitle'),
          t('alerts.cannotMarkUnavailableMessage', { date: nextOccurrenceLabel(dayId, i18n.language) }),
        );
        return;
      }
    }

    let blocks = week[dayId]?.blocks ?? [];
    if (isCleaningProvider && value && blocks.length === 0) {
      blocks = [CLEANING_DEFAULT_BLOCK];
    }

    const updated: DayAvailability = { ...week[dayId], isAvailable: value, blocks };
    setWeek((prev) => ({ ...prev, [dayId]: updated }));
    await saveDayAvailability(uid, dayId, updated);
  }

  async function handleDeleteBlock(dayId: string, index: number) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const blockToDelete = week[dayId].blocks[index];
    const overlapping = findOverlappingBooking(dayId, blockToDelete.startTime, blockToDelete.endTime);
    if (overlapping) {
      Alert.alert(
        t('alerts.cannotDeleteTitle'),
        t('alerts.cannotDeleteBlockMessage', {
          range: `${formatTime(overlapping.scheduledTime, i18n.language)} – ${formatTime(getBookingEndTime(overlapping), i18n.language)}`,
        }),
      );
      return;
    }

    const blocks = week[dayId].blocks.filter((_, i) => i !== index);
    const updated: DayAvailability = { ...week[dayId], blocks };
    setWeek((prev) => ({ ...prev, [dayId]: updated }));
    await saveDayAvailability(uid, dayId, updated);
  }

  // "Block this day" — a one-off block for this weekday's next calendar occurrence only.
  // Does not touch the recurring weekly pattern (week[dayId].isAvailable/blocks), which is
  // exactly the point: the provider is off *this* Wednesday, not every Wednesday.
  async function handleBlockDay(dayId: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    if ((confirmedBookingsByDay[dayId] ?? []).length > 0) {
      Alert.alert(
        t('alerts.cannotMarkUnavailableTitle'),
        t('alerts.cannotMarkUnavailableMessage', { date: nextOccurrenceLabel(dayId, i18n.language) }),
      );
      return;
    }

    const dateStr = nextOccurrenceDateStr(dayId);
    await addManualDayBlock(uid, dateStr);
    setBlockedSlotsByDay((prev) => ({
      ...prev,
      [dayId]: [...(prev[dayId] ?? []), { startTime: '00:00', endTime: '23:59', reason: 'manual' }],
    }));
  }

  async function handleUnblockDay(dayId: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const dateStr = nextOccurrenceDateStr(dayId);
    await removeManualDayBlock(uid, dateStr);
    setBlockedSlotsByDay((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] ?? []).filter((b) => b.reason !== 'manual'),
    }));
  }

  function hhmmToDate(hhmm: string): Date {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  function openStartPicker(dayId: string, editIndex?: number) {
    setPickerDayId(dayId);
    setPickerStep('start');
    setPickerEditIndex(editIndex ?? null);
    setTempStart('');
    // Pre-fill with existing start time when editing
    if (editIndex !== undefined) {
      setPickerDate(hhmmToDate(week[dayId].blocks[editIndex].startTime));
    } else {
      setPickerDate(new Date());
    }
    setPickerVisible(true);
  }

  function handlePickerChange(_event: DateTimePickerEvent, date?: Date) {
    if (date) setPickerDate(date);
  }

  function handlePickerNext() {
    const start = dateToHHMM(pickerDate);
    setTempStart(start);
    setPickerStep('end');
    // Pre-fill end time when editing, otherwise reset
    if (pickerEditIndex !== null && pickerDayId) {
      setPickerDate(hhmmToDate(week[pickerDayId].blocks[pickerEditIndex].endTime));
    } else {
      setPickerDate(new Date());
    }
  }

  async function handlePickerDone() {
    const endTime = dateToHHMM(pickerDate);
    if (timeToMinutes(endTime) <= timeToMinutes(tempStart)) {
      Alert.alert(t('alerts.endTimeAfterStart'));
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid || !pickerDayId) return;

    const overlapping = findOverlappingBooking(pickerDayId, tempStart, endTime);
    if (overlapping) {
      Alert.alert(
        t('alerts.timeConflictTitle'),
        t('alerts.timeConflictMessage'),
      );
      return;
    }

    const newBlock = { startTime: tempStart, endTime };
    const blocks = pickerEditIndex !== null
      ? week[pickerDayId].blocks.map((b, i) => (i === pickerEditIndex ? newBlock : b))
      : [...week[pickerDayId].blocks, newBlock];
    const updated: DayAvailability = { ...week[pickerDayId], blocks };
    setWeek((prev) => ({ ...prev, [pickerDayId!]: updated }));
    setPickerVisible(false);
    await saveDayAvailability(uid, pickerDayId, updated);
  }

  function handlePickerCancel() {
    setPickerVisible(false);
    setPickerStep('start');
    setPickerEditIndex(null);
    setTempStart('');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('provider.availability')}</Text>
        <Text style={styles.subtitle}>{t('availabilityScreen.subtitle')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {loading && <Text style={styles.loadingText}>{t('common.loading')}</Text>}

        {!loading && DAYS_OF_WEEK.map((dayId) => {
          const day = week[dayId];
          if (!day) return null;

          const rows: DayRow[] = day.blocks
            .map((block, index): DayRow => ({ kind: 'editable', index, block }))
            .concat(
              (confirmedBookingsByDay[dayId] ?? []).map(
                (booking): DayRow => ({ kind: 'locked', booking, endTime: getBookingEndTime(booking) }),
              ),
            )
            .sort((a, b) => {
              const aStart = a.kind === 'editable' ? a.block.startTime : a.booking.scheduledTime;
              const bStart = b.kind === 'editable' ? b.block.startTime : b.booking.scheduledTime;
              return aStart.localeCompare(bStart);
            });

          const manualBlock = (blockedSlotsByDay[dayId] ?? []).find((b) => b.reason === 'manual');

          return (
            <View key={dayId} style={styles.card}>
              <View style={styles.dayRow}>
                <Text style={styles.dayName}>{t(`daysOfWeek.${dayId}`)}, {nextOccurrenceLabel(dayId, i18n.language)}</Text>
                <Switch
                  value={day.isAvailable}
                  onValueChange={(v) => handleToggle(dayId, v)}
                  trackColor={{ false: '#e8e8e8', true: '#000000' }}
                  thumbColor="#ffffff"
                />
              </View>

              {day.isAvailable && !isCleaningProvider && (
                <View style={styles.blocksSection}>
                  {rows.length === 0 && (
                    <Text style={styles.noBlocksText}>{t('availabilityScreen.noTimeBlocks')}</Text>
                  )}

                  {rows.map((row) =>
                    row.kind === 'editable' ? (
                      <View key={`block-${row.index}`} style={styles.blockRow}>
                        <TouchableOpacity
                          style={styles.blockEditArea}
                          onPress={() => openStartPicker(dayId, row.index)}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="time-outline" size={16} color="#666666" />
                          <Text style={styles.blockText}>
                            {formatTime(row.block.startTime, i18n.language)} – {formatTime(row.block.endTime, i18n.language)}
                          </Text>
                          <Ionicons name="pencil-outline" size={13} color="#cccccc" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteBlock(dayId, row.index)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={18} color="#999999" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View key={`locked-${row.booking.id}`} style={styles.lockedRow}>
                        <Ionicons name="lock-closed" size={14} color="#999999" />
                        <View style={styles.lockedTextCol}>
                          <Text style={styles.lockedTimeText}>
                            {formatTime(row.booking.scheduledTime, i18n.language)} – {formatTime(row.endTime, i18n.language)}
                          </Text>
                          <Text style={styles.lockedServiceText}>({displayBookingServiceName(row.booking, t)})</Text>
                        </View>
                        <Text style={styles.lockedBadge}>{t('provider.booked')}</Text>
                      </View>
                    )
                  )}

                  {manualBlock && (
                    <View style={styles.manualBlockRow}>
                      <Ionicons name="close-circle" size={14} color="#999999" />
                      <Text style={styles.manualBlockText}>
                        {nextOccurrenceLabel(dayId, i18n.language)} — {t('provider.unavailable')}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleUnblockDay(dayId)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={18} color="#999999" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.addBlockButton}
                    onPress={() => openStartPicker(dayId)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={18} color="#000000" />
                    <Text style={styles.addBlockText}>{t('availabilityScreen.addTimeBlock')}</Text>
                  </TouchableOpacity>

                  {!manualBlock && (
                    <TouchableOpacity
                      style={styles.blockDayButton}
                      onPress={() => handleBlockDay(dayId)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ban-outline" size={16} color="#999999" />
                      <Text style={styles.blockDayText}>{t('availabilityScreen.blockThisDay')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      <ProviderBottomNav activeTab="availability" />

      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pickerStep === 'start'
                ? pickerEditIndex !== null ? t('availabilityScreen.editStartTime') : t('availabilityScreen.selectStartTime')
                : pickerEditIndex !== null ? t('availabilityScreen.editEndTime') : t('availabilityScreen.selectEndTime')}
            </Text>

            {pickerStep === 'end' && (
              <Text style={styles.modalSubtitle}>
                {t('availabilityScreen.startPrefix')}: {formatTime(tempStart, i18n.language)}
              </Text>
            )}

            <View style={styles.pickerContainer}>
              <DateTimePicker
                mode="time"
                display="spinner"
                value={pickerDate}
                onChange={handlePickerChange}
                style={styles.picker}
                themeVariant="light"
                textColor="#000000"
                accentColor="#000000"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handlePickerCancel}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              {pickerStep === 'start' ? (
                <TouchableOpacity style={styles.modalDoneButton} onPress={handlePickerNext}>
                  <Text style={styles.modalDoneText}>{t('availabilityScreen.next')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.modalDoneButton} onPress={handlePickerDone}>
                  <Text style={styles.modalDoneText}>{t('availabilityScreen.done')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#999999',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  blocksSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  noBlocksText: {
    fontSize: 13,
    color: '#999999',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  blockEditArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockText: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  lockedTextCol: {
    flex: 1,
  },
  lockedTimeText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  lockedServiceText: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
    marginTop: 1,
  },
  lockedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    flexShrink: 0,
  },
  manualBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#999999',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  manualBlockText: {
    flex: 1,
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  addBlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  addBlockText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  blockDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  blockDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999999',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 216,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  modalDoneButton: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDoneText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
