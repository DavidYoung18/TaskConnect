import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { collection, deleteField, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import MapView, { Marker } from 'react-native-maps';
import { db } from '@/lib/firebase';
import { Booking, subscribeToBooking, updateBookingStatus } from '@/lib/bookings';
import { getOrCreateChatForBooking, sendSystemMessage } from '@/lib/chats';
import { sendPushNotification } from '@/lib/notifications';
import { createNotification } from '@/lib/inAppNotifications';
import { DayAvailability, addBlockedSlot, getWeekAvailability, removeBlockedSlot } from '@/lib/availability';
import { proposeReschedule } from '@/lib/rescheduleActions';
import { getSpaceTypeKey, getCleaningTypeKey, getToolsOptionShortKey, getBathroomCountLabel, getWallMaterialKey, getSubServiceNameKey, displayBookingServiceName } from '@/lib/serviceNames';
import { formatMonthDayYear, formatTime, parseLocalDate, parseLocalDateTime } from '@/lib/dateFormat';
import SlotPickerModal, { SlotPickerResult } from '@/components/SlotPickerModal';

function dateToDateStr(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function dateToHHMM(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// Shared by blockScheduleSlot (on accept) and the reschedule flow (which must
// know the current booking's duration to correctly free its original blockedSlots
// range before proposing a new one).
async function computeDurationHours(b: Booking): Promise<number> {
  if (b.type === 'hourly' && b.hours) return b.hours;
  if (!b.subServiceId) return 1;
  const q = query(
    collection(db, 'users', b.providerId, 'providerServices'),
    where('subServiceId', '==', b.subServiceId),
  );
  const snap = await getDocs(q);
  const svc = snap.docs[0]?.data() as { estimatedDuration?: number } | undefined;
  return svc?.estimatedDuration ?? 1;
}

function addDurationToTime(time: string, durationHours: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + durationHours * 60;
  return `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
}

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = totalMinutes % 60;
  return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
}

// endTime omitted → falls back to showing just the start time.
function formatDateWithRange(date: string, startTime: string, endTime: string | undefined, language: string): string {
  const timePart = endTime
    ? `${formatTime(startTime, language)} – ${formatTime(endTime, language)}`
    : formatTime(startTime, language);
  return `${formatMonthDayYear(parseLocalDate(date), language)} · ${timePart}`;
}

function formatPrice(price: number, currency: string): string {
  return price.toLocaleString('en-US') + ' ' + currency;
}


interface MapAppOption {
  label: string;
  url: string;
}

function buildMapAppCandidates(
  lat: number,
  lng: number,
): { checkUrl: string; label: string; build: () => string }[] {
  const candidates: { checkUrl: string; label: string; build: () => string }[] = [];

  if (Platform.OS === 'ios') {
    // Apple Maps is a built-in system app on iOS — always present — but we still
    // probe it via canOpenURL for consistency with the other two.
    //
    // Deliberately NOT passing saddr (origin) — every one of these apps already
    // defaults to the device's own current-location detection when no source is
    // given, which is more reliable than piping this app's own expo-location fix
    // through a URL param. An earlier version fetched and passed an explicit
    // saddr here; that's the prime suspect for Apple Maps showing "Directions not
    // available from this location" with no Start button — a bad, stale, or
    // simulator-default coordinate in saddr can make Apple Maps refuse to route,
    // whereas omitting it entirely lets Maps resolve its own current location the
    // same way it does for any other directions request.
    candidates.push({
      checkUrl: 'maps://',
      label: 'Apple Maps',
      build: () => `maps://?daddr=${lat},${lng}&dirflg=d`,
    });
    candidates.push({
      checkUrl: 'comgooglemaps://',
      label: 'Google Maps',
      build: () => `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
    });
  } else {
    // Android has no Apple Maps. Google Maps' own navigation scheme doubles as
    // its installed-app probe.
    candidates.push({
      checkUrl: `google.navigation:q=${lat},${lng}`,
      label: 'Google Maps',
      build: () => `google.navigation:q=${lat},${lng}`,
    });
  }

  // Yandex Maps uses the same URI scheme on both platforms.
  candidates.push({
    checkUrl: 'yandexmaps://',
    label: 'Yandex Maps',
    build: () => `yandexmaps://build_route_on_map?lat_to=${lat}&lon_to=${lng}`,
  });

  // Waze also uses the same scheme on both platforms. Its URI scheme has no origin
  // param — Waze always routes from the device's current location.
  candidates.push({
    checkUrl: 'waze://',
    label: 'Waze',
    build: () => `waze://?ll=${lat},${lng}&navigate=yes`,
  });

  return candidates;
}

async function openDirectionsPicker(lat: number, lng: number, t: (key: string) => string) {
  const candidates = buildMapAppCandidates(lat, lng);
  const available: MapAppOption[] = [];

  for (const candidate of candidates) {
    try {
      const canOpen = await Linking.canOpenURL(candidate.checkUrl);
      if (canOpen) available.push({ label: candidate.label, url: candidate.build() });
    } catch {
      // Scheme not queryable (e.g. not declared in native config) — treat as not installed.
    }
  }

  // Requested explicitly for debugging the "Directions not available" report — logs
  // exactly what was detected and what URL each option will actually launch.
  console.log('[directions] lat/lng:', lat, lng, '| detected apps:', available);

  const webFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  if (available.length === 0) {
    console.log('[directions] no map apps detected, opening web fallback:', webFallbackUrl);
    Linking.openURL(webFallbackUrl);
    return;
  }

  function openSelected(url: string) {
    console.log('[directions] opening:', url);
    Linking.openURL(url);
  }

  if (Platform.OS === 'ios') {
    const options = [...available.map((a) => a.label), t('common.cancel')];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t('bookingDetail.chooseMapsApp'),
        options,
        cancelButtonIndex: options.length - 1,
      },
      (index) => {
        if (index === options.length - 1) return;
        openSelected(available[index].url);
      },
    );
  } else {
    Alert.alert(
      t('bookingDetail.chooseMapsApp'),
      undefined,
      [
        ...available.map((a) => ({ text: a.label, onPress: () => openSelected(a.url) })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ],
    );
  }
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending:            { color: '#b45309', bg: '#fef3c7' },
  confirmed:          { color: '#065f46', bg: '#d1fae5' },
  completed:          { color: '#374151', bg: '#f3f4f6' },
  declined:           { color: '#991b1b', bg: '#fee2e2' },
  pending_completion: { color: '#1e40af', bg: '#dbeafe' },
  reschedule_pending: { color: '#7c3aed', bg: '#ede9fe' },
};

const STATUS_LABEL_KEY: Record<string, string> = {
  pending:            'booking.pending',
  confirmed:          'booking.confirmed',
  completed:          'booking.completed',
  declined:           'booking.declined',
  pending_completion: 'booking.awaitingConfirmation',
  reschedule_pending: 'booking.rescheduleRequested',
};

export default function BookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Free-form date/time picker — cleaning-company bookings only (no availability
  // schedule to constrain against, see handleAccept's skip below).
  const [reschedulePickerVisible, setReschedulePickerVisible] = useState(false);
  const [reschedulePickerStep, setReschedulePickerStep] = useState<'date' | 'time'>('date');
  const [reschedulePickerValue, setReschedulePickerValue] = useState(new Date());
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Availability-constrained slot picker — every other category. Same component
  // used for new bookings (provider-profile-view.tsx), so a provider can only
  // propose a time they're actually free for.
  const [slotPickerVisible, setSlotPickerVisible] = useState(false);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({});

  useEffect(() => {
    if (!bookingId) return;
    const unsubscribe = subscribeToBooking(bookingId, (b) => {
      setBooking(b);
      setLoading(false);
    });
    return unsubscribe;
  }, [bookingId]);

  // One-off lookup — customerId doesn't change for a given booking, so this
  // doesn't need to re-run on every snapshot update.
  useEffect(() => {
    if (!booking?.customerId) return;
    getDoc(doc(db, 'users', booking.customerId)).then((userSnap) => {
      if (userSnap.exists()) {
        setCustomerPhone((userSnap.data().phone as string) ?? '');
      }
    });
  }, [booking?.customerId]);

  // Same providerServices lookup used in blockScheduleSlot — fetches how long this
  // specific fixed-price service is expected to take, so we can show an end time.
  useEffect(() => {
    if (!booking?.subServiceId || booking.type !== 'fixed') {
      setEstimatedDuration(null);
      return;
    }
    const q = query(
      collection(db, 'users', booking.providerId, 'providerServices'),
      where('subServiceId', '==', booking.subServiceId),
    );
    getDocs(q).then((snap) => {
      const svc = snap.docs[0]?.data() as { estimatedDuration?: number } | undefined;
      setEstimatedDuration(svc?.estimatedDuration ?? null);
    });
  }, [booking?.subServiceId, booking?.providerId, booking?.type]);

  // Customer-declined-reschedule cleanup. Declining only sets status: 'declined' and
  // deliberately leaves proposedDate/proposedStartTime/proposedEndTime/
  // rescheduleHadBlockedSlot in place as markers — the customer can't release the
  // ORIGINAL blockedSlots entry themselves (firestore.rules restricts blockedSlots
  // writes to the owning provider). Proposing a reschedule never touches blockedSlots
  // (the swap only happens on acceptance, see the accept-cleanup effect below), so
  // it's the ORIGINAL slot — still held from the booking's initial accept — that
  // needs releasing here, not the proposed one. rescheduleHadBlockedSlot gates
  // whether there's actually anything to release at all: Request Reschedule can now
  // be used directly on a still-'pending' booking (skipping accept), which was never
  // blocked in the first place, so declining it must NOT attempt to release a
  // nonexistent entry. This effect performs the release (when needed) from the
  // provider's own session the next time they view the booking, then clears the
  // marker fields so it only runs once. Skipped entirely for cleaning-company
  // bookings, which never hold a blockedSlots entry (see handleAccept's skip below).
  useEffect(() => {
    if (
      !booking ||
      booking.type === 'cleaning-company' ||
      booking.status !== 'declined' ||
      !booking.proposedDate ||
      !booking.proposedStartTime ||
      !booking.proposedEndTime
    ) {
      return;
    }
    (async () => {
      if (booking.rescheduleHadBlockedSlot) {
        const durationHours = await computeDurationHours(booking);
        await removeBlockedSlot(booking.providerId, booking.scheduledDate, {
          startTime: booking.scheduledTime,
          endTime: addDurationToTime(booking.scheduledTime, durationHours),
        });
      }
      await updateDoc(doc(db, 'bookings', booking.id), {
        proposedDate: deleteField(),
        proposedStartTime: deleteField(),
        proposedEndTime: deleteField(),
        rescheduleHadBlockedSlot: deleteField(),
      });
    })();
  }, [booking?.status, booking?.type, booking?.proposedDate, booking?.proposedStartTime, booking?.proposedEndTime, booking?.rescheduleHadBlockedSlot]);

  // Customer-accepted-reschedule cleanup. acceptReschedule (customer-side) can't
  // write blockedSlots itself (owner-only, same constraint as above), so it signals
  // via needsBlockedSlotSync — always set on a successful accept, since there's
  // always a NEW slot (booking.scheduledDate/scheduledTime, already updated by the
  // time this runs) to claim. previousScheduledDate/previousScheduledTime are only
  // present when there's also an OLD slot to release — absent when Request Reschedule
  // was used straight from a still-'pending' booking, which was never blocked. This
  // effect performs whichever of release/claim actually applies from the provider's
  // own session the next time they view the booking, then clears the marker fields so
  // it only runs once. Skipped entirely for cleaning-company bookings, which never
  // hold a blockedSlots entry (see handleAccept's skip below).
  useEffect(() => {
    if (
      !booking ||
      booking.type === 'cleaning-company' ||
      booking.status !== 'confirmed' ||
      !booking.needsBlockedSlotSync
    ) {
      return;
    }
    (async () => {
      const durationHours = await computeDurationHours(booking);
      if (booking.previousScheduledDate && booking.previousScheduledTime) {
        await removeBlockedSlot(booking.providerId, booking.previousScheduledDate, {
          startTime: booking.previousScheduledTime,
          endTime: addDurationToTime(booking.previousScheduledTime, durationHours),
        });
      }
      await addBlockedSlot(booking.providerId, booking.scheduledDate, {
        startTime: booking.scheduledTime,
        endTime: addDurationToTime(booking.scheduledTime, durationHours),
      });
      await updateDoc(doc(db, 'bookings', booking.id), {
        previousScheduledDate: deleteField(),
        previousScheduledTime: deleteField(),
        needsBlockedSlotSync: deleteField(),
      });
    })();
  }, [
    booking?.status,
    booking?.type,
    booking?.needsBlockedSlotSync,
    booking?.previousScheduledDate,
    booking?.previousScheduledTime,
    booking?.scheduledDate,
    booking?.scheduledTime,
  ]);

  async function notifyCustomer(customerId: string, bookingId: string, title: string, body: string) {
    try {
      const snap = await getDoc(doc(db, 'users', customerId));
      const token = snap.data()?.pushToken;
      if (token) {
        await sendPushNotification(token, title, body, { type: 'booking', bookingId, role: 'customer' });
      }
    } catch {
      // Notification failures shouldn't block the booking action
    }
  }

  async function blockScheduleSlot(b: Booking) {
    try {
      const durationHours = await computeDurationHours(b);
      await addBlockedSlot(b.providerId, b.scheduledDate, {
        startTime: b.scheduledTime,
        endTime: addDurationToTime(b.scheduledTime, durationHours),
      });
    } catch {
      // Slot blocking failures shouldn't block the accept flow
    }
  }

  async function handleAccept() {
    if (!booking || acting) return;
    setActing(true);
    await updateBookingStatus(booking.id, 'confirmed', { customerViewed: false });
    await getOrCreateChatForBooking(booking);
    // Cleaning companies have no availability schedule to block — customers pick a
    // date freely, with no per-company slot check (see cleaning intake flow).
    if (booking.type !== 'cleaning-company') {
      await blockScheduleSlot(booking);
    }
    await notifyCustomer(
      booking.customerId,
      booking.id,
      'Booking Accepted',
      `${booking.providerName} accepted your booking for ${booking.serviceName}.`,
    );
    await createNotification({
      userId: booking.customerId,
      type: 'booking_confirmed',
      bookingId: booking.id,
      providerName: booking.providerName,
    });
    setActing(false);
    router.back();
  }

  function handleDecline() {
    if (!booking || acting) return;
    Alert.alert(
      t('alerts.declineBookingTitle'),
      t('alerts.declineBookingConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.decline'),
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            await updateBookingStatus(booking.id, 'declined', { customerViewed: false });
            await notifyCustomer(
              booking.customerId,
              booking.id,
              'Booking Declined',
              `${booking.providerName} declined your booking for ${booking.serviceName}.`,
            );
            await createNotification({
              userId: booking.customerId,
              type: 'booking_declined',
              bookingId: booking.id,
              providerName: booking.providerName,
            });
            setActing(false);
            router.back();
          },
        },
      ],
    );
  }

  async function handleMessage() {
    if (!booking) return;
    await getOrCreateChatForBooking(booking);
    router.push(
      `/chat-thread?chatId=${booking.id}&otherPartyName=${encodeURIComponent(booking.customerName)}`
    );
  }

  // Cleaning-company bookings have no availability schedule to constrain against
  // (see handleAccept's blockScheduleSlot skip below) — free-form date/time picker.
  // Every other category proposes from the same availability-constrained slot picker
  // used for new bookings, so the provider can only propose a time they're actually
  // free for.
  function openReschedulePicker() {
    if (!booking || acting) return;
    if (booking.type === 'cleaning-company') {
      setReschedulePickerStep('date');
      setReschedulePickerValue(new Date());
      setRescheduleDate(null);
      setReschedulePickerVisible(true);
      return;
    }
    getWeekAvailability(booking.providerId).then((avail) => {
      setAvailability(avail);
      setSlotPickerVisible(true);
    });
  }

  function handleReschedulePickerChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setReschedulePickerValue(selected);
  }

  function handleReschedulePickerNext() {
    setRescheduleDate(reschedulePickerValue);
    setReschedulePickerStep('time');
    setReschedulePickerValue(new Date());
  }

  function handleReschedulePickerCancel() {
    setReschedulePickerVisible(false);
    setReschedulePickerStep('date');
    setRescheduleDate(null);
  }

  async function submitReschedulePropose(proposedDate: string, proposedStartTime: string) {
    if (!booking) return;
    setRescheduling(true);
    try {
      const durationHours = await computeDurationHours(booking);
      const proposedEndTime = addDurationToTime(proposedStartTime, durationHours);
      await proposeReschedule(booking, proposedDate, proposedStartTime, proposedEndTime, t);
      Alert.alert(t('alerts.sentTitle'), t('alerts.rescheduleRequestSentToCustomer'));
    } finally {
      setRescheduling(false);
    }
  }

  async function handleReschedulePickerDone() {
    if (!booking || !rescheduleDate || rescheduling) return;
    setReschedulePickerVisible(false);
    const proposedDate = dateToDateStr(rescheduleDate);
    const proposedStartTime = dateToHHMM(reschedulePickerValue);
    await submitReschedulePropose(proposedDate, proposedStartTime);
    setRescheduleDate(null);
  }

  async function handleSlotPickerConfirm(result: SlotPickerResult) {
    setSlotPickerVisible(false);
    await submitReschedulePropose(result.dateStr, result.time);
  }

  function handleMarkCompleted() {
    if (!booking || acting) return;
    Alert.alert(
      t('booking.markCompleted'),
      t('alerts.markCompletedConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('booking.markCompleted'),
          onPress: async () => {
            setActing(true);
            await updateBookingStatus(booking.id, 'pending_completion', { customerViewed: false });
            await sendSystemMessage(booking.id, 'completion_request', { bookingId: booking.id }, t('chatThread.completionRequestText'));
            await notifyCustomer(
              booking.customerId,
              booking.id,
              'Job Completion Request',
              `${booking.providerName} marked "${booking.serviceName}" as complete. Please confirm.`,
            );
            await createNotification({
              userId: booking.customerId,
              type: 'completion_requested',
              bookingId: booking.id,
              providerName: booking.providerName,
            });
            setBooking({ ...booking, status: 'pending_completion' });
            setActing(false);
            Alert.alert(t('alerts.sentTitle'), t('alerts.completionRequestSentToCustomer'));
          },
        },
      ],
    );
  }

  function handleCall() {
    if (!customerPhone) {
      Alert.alert(t('alerts.phoneNotAvailableTitle'), t('alerts.phoneNotAvailableMessage'));
      return;
    }
    Linking.openURL(`tel:${customerPhone}`);
  }

  async function handleDirections() {
    if (!booking?.latitude || !booking?.longitude) return;
    await openDirectionsPicker(booking.latitude, booking.longitude, t);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#000000" />
          </TouchableOpacity>
        </View>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#000000" />
          </TouchableOpacity>
        </View>
        <Text style={styles.loadingText}>{t('bookingDetail.notFound')}</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const hasCoords = typeof booking.latitude === 'number' && typeof booking.longitude === 'number';
  const isPending = booking.status === 'pending';
  const isConfirmed = booking.status === 'confirmed';
  const isReschedulePending = booking.status === 'reschedule_pending';

  // __DEV__ is React Native's built-in dev-build flag — true only when Metro is
  // running the JS bundle (e.g. `npx expo run:ios --device` over a tunnel), false in
  // any TestFlight/production build. That lets you test the full completion flow on
  // your own phone without waiting for a booking's scheduled time to actually
  // arrive, while real users on a shipped build always get the real gate below.
  const canMarkComplete = __DEV__ || Date.now() >= parseLocalDateTime(booking.scheduledDate, booking.scheduledTime).getTime();

  const scheduledLabel = booking.type === 'cleaning-company'
    ? `${formatMonthDayYear(parseLocalDate(booking.scheduledDate), i18n.language)} · ${t('cleaningIntake.workingHoursRange')}`
    : formatDateWithRange(
        booking.scheduledDate,
        booking.scheduledTime,
        estimatedDuration != null ? addHoursToTime(booking.scheduledTime, estimatedDuration) : undefined,
        i18n.language,
      );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.customerName} numberOfLines={1}>{booking.customerName}</Text>
          <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.badgeText, { color: statusCfg.color }]}>
              {t(STATUS_LABEL_KEY[booking.status] ?? 'booking.pending')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Service details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('labels.service')}</Text>

          <View style={styles.detailRow}>
            <Ionicons name="construct-outline" size={16} color="#666666" style={styles.detailIcon} />
            <View style={styles.detailTextColumn}>
              <Text style={styles.detailLabel}>{t('labels.service')}</Text>
              <Text style={styles.detailValue}>{displayBookingServiceName(booking, t)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#666666" style={styles.detailIcon} />
            <View style={styles.detailTextColumn}>
              <Text style={styles.detailLabel}>{t('labels.price')}</Text>
              <Text style={styles.detailValue}>{formatPrice(booking.price, t('common.currency'))}</Text>
            </View>
          </View>

          {booking.type === 'hourly' && booking.hours != null && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color="#666666" style={styles.detailIcon} />
              <View style={styles.detailTextColumn}>
                <Text style={styles.detailLabel}>{t('labels.duration')}</Text>
                <Text style={styles.detailValue}>{booking.hours} hour{booking.hours !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666666" style={styles.detailIcon} />
            <View style={styles.detailTextColumn}>
              <Text style={styles.detailLabel}>{t('labels.scheduled')}</Text>
              <Text style={styles.detailValue}>{scheduledLabel}</Text>
            </View>
          </View>

          {booking.spaceType && (
            <>
              <View style={styles.detailRow}>
                <Ionicons name="home-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('labels.property')}</Text>
                  <Text style={styles.detailValue}>
                    {getSpaceTypeKey(booking.spaceType) ? t(getSpaceTypeKey(booking.spaceType)!) : booking.spaceType}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="resize-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.squareMetersQuestion')}</Text>
                  <Text style={styles.detailValue}>{booking.squareMeters}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="grid-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.roomCountQuestion')}</Text>
                  <Text style={styles.detailValue}>{booking.roomCount}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="water-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.bathroomCountQuestion')}</Text>
                  <Text style={styles.detailValue}>
                    {booking.bathroomCount ? getBathroomCountLabel(booking.bathroomCount, t) : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="sparkles-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.cleaningTypeQuestion')}</Text>
                  <Text style={styles.detailValue}>
                    {booking.cleaningType && getCleaningTypeKey(booking.cleaningType) ? t(getCleaningTypeKey(booking.cleaningType)!) : booking.cleaningType}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.cleanersRequestedQuestion')}</Text>
                  <Text style={styles.detailValue}>{booking.cleanersRequested}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="construct-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('labels.tools')}</Text>
                  <Text style={styles.detailValue}>
                    {booking.toolsOption && getToolsOptionShortKey(booking.toolsOption) ? t(getToolsOptionShortKey(booking.toolsOption)!) : booking.toolsOption}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Curtain/carpet companies price per square meter but never set spaceType
              (that's cleaning-intake-only), so they'd otherwise show no measurement at
              all here despite the price being based on it. */}
          {!booking.spaceType && booking.squareMeters != null && (
            <View style={styles.detailRow}>
              <Ionicons name="resize-outline" size={16} color="#666666" style={styles.detailIcon} />
              <View style={styles.detailTextColumn}>
                <Text style={styles.detailLabel}>{t('cleaningIntake.squareMetersQuestion')}</Text>
                <Text style={styles.detailValue}>{booking.squareMeters}</Text>
              </View>
            </View>
          )}

          {/* TV mounting only */}
          {booking.tvCount != null && (
            <View style={styles.detailRow}>
              <Ionicons name="tv-outline" size={16} color="#666666" style={styles.detailIcon} />
              <View style={styles.detailTextColumn}>
                <Text style={styles.detailLabel}>{t('tvIntake.tvCountQuestion')}</Text>
                <Text style={styles.detailValue}>{booking.tvCount}</Text>
              </View>
            </View>
          )}
          {booking.wallMaterial && (
            <View style={styles.detailRow}>
              <Ionicons name="grid-outline" size={16} color="#666666" style={styles.detailIcon} />
              <View style={styles.detailTextColumn}>
                <Text style={styles.detailLabel}>{t('tvIntake.wallMaterialQuestion')}</Text>
                <Text style={styles.detailValue}>
                  {getWallMaterialKey(booking.wallMaterial) ? t(getWallMaterialKey(booking.wallMaterial)!) : booking.wallMaterial}
                </Text>
              </View>
            </View>
          )}
          {booking.tvSizes && booking.tvSizes.length > 0 && (
            <View style={styles.detailRow}>
              <Ionicons name="list-outline" size={16} color="#666666" style={styles.detailIcon} />
              <View style={styles.detailTextColumn}>
                <Text style={styles.detailLabel}>{t('tvIntake.detailsTitle')}</Text>
                {booking.tvSizes.map((size) => {
                  const key = getSubServiceNameKey(size.subServiceId);
                  const label = key ? t(key) : size.subServiceId;
                  return (
                    <Text key={size.subServiceId} style={styles.detailValue}>
                      {size.quantity}× {label}
                    </Text>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('labels.location')}</Text>

          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={16} color="#666666" />
            <Text style={styles.addressText}>{booking.addressText}</Text>
          </View>

          {hasCoords ? (
            <>
              <TouchableOpacity
                style={styles.mapContainer}
                onPress={handleDirections}
                activeOpacity={0.8}
              >
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: booking.latitude!,
                    longitude: booking.longitude!,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  pointerEvents="none"
                >
                  <Marker
                    coordinate={{ latitude: booking.latitude!, longitude: booking.longitude! }}
                  />
                </MapView>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.directionsButton}
                onPress={handleDirections}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate-outline" size={16} color="#000000" />
                <Text style={styles.directionsText}>{t('bookingDetail.getDirections')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noMapNote}>
              <Ionicons name="map-outline" size={15} color="#aaaaaa" />
              <Text style={styles.noMapText}>Map unavailable — no coordinates stored for this booking.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {isReschedulePending && (
          <View style={styles.reschedulePendingNotice}>
            <Ionicons name="time-outline" size={16} color="#7c3aed" />
            <Text style={styles.reschedulePendingText}>{t('bookingDetail.reschedulePendingProviderNotice')}</Text>
          </View>
        )}

        {isConfirmed && canMarkComplete && (
          <TouchableOpacity
            style={[styles.completeButton, acting && styles.buttonDisabled]}
            onPress={handleMarkCompleted}
            disabled={acting}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
            <Text style={styles.completeText}>{acting ? t('common.updating') : t('booking.markCompleted')}</Text>
          </TouchableOpacity>
        )}

        {isConfirmed && !canMarkComplete && (
          <View style={styles.completionLockedNotice}>
            <Ionicons name="time-outline" size={16} color="#666666" />
            <Text style={styles.completionLockedText}>
              {t('bookingDetail.completionAvailableFrom', {
                time: formatTime(booking.scheduledTime, i18n.language),
              })}
            </Text>
          </View>
        )}

        {/* Also available on a still-pending booking, not just confirmed ones —
            Request Reschedule doubles as the provider's response there, skipping
            accept entirely (see proposeReschedule/acceptReschedule in
            rescheduleActions.ts for how the booking never gets treated as
            "confirmed" unless the customer actually approves a proposed time). */}
        {(isConfirmed || isPending) && (
          <TouchableOpacity
            style={[styles.rescheduleButton, (acting || rescheduling) && styles.buttonDisabled]}
            onPress={openReschedulePicker}
            disabled={acting || rescheduling}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={16} color="#7c3aed" />
            <Text style={styles.rescheduleButtonText}>
              {rescheduling ? t('common.updating') : t('booking.requestReschedule')}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.contactRow}>
          <TouchableOpacity
            style={[styles.contactButton, styles.contactButtonBorder]}
            onPress={handleMessage}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#000000" />
            <Text style={styles.contactButtonText}>{t('common.message')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleCall}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={16} color="#000000" />
            <Text style={styles.contactButtonText}>{t('common.call')}</Text>
          </TouchableOpacity>
        </View>

        {isPending && (
          <View style={styles.pendingActions}>
            <TouchableOpacity
              style={[styles.declineButton, acting && styles.buttonDisabled]}
              onPress={handleDecline}
              disabled={acting}
              activeOpacity={0.8}
            >
              <Text style={styles.declineText}>{acting ? '…' : t('common.decline')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptButton, acting && styles.buttonDisabled]}
              onPress={handleAccept}
              disabled={acting}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptText}>{acting ? '…' : t('booking.accept')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={reschedulePickerVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {reschedulePickerStep === 'date'
                ? t('bookingDetail.selectNewDate')
                : t('bookingDetail.selectNewTime')}
            </Text>

            {reschedulePickerStep === 'time' && rescheduleDate && (
              <Text style={styles.modalSubtitle}>
                {formatMonthDayYear(rescheduleDate, i18n.language)}
              </Text>
            )}

            <View style={styles.pickerContainer}>
              <DateTimePicker
                mode={reschedulePickerStep === 'date' ? 'date' : 'time'}
                display="spinner"
                value={reschedulePickerValue}
                minimumDate={reschedulePickerStep === 'date' ? new Date() : undefined}
                onChange={handleReschedulePickerChange}
                style={styles.picker}
                themeVariant="light"
                textColor="#000000"
                accentColor="#000000"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handleReschedulePickerCancel}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              {reschedulePickerStep === 'date' ? (
                <TouchableOpacity style={styles.modalDoneButton} onPress={handleReschedulePickerNext}>
                  <Text style={styles.modalDoneText}>{t('availabilityScreen.next')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.modalDoneButton} onPress={handleReschedulePickerDone}>
                  <Text style={styles.modalDoneText}>{t('availabilityScreen.done')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {booking.type !== 'cleaning-company' && (
        <SlotPickerModal
          visible={slotPickerVisible}
          onClose={() => setSlotPickerVisible(false)}
          providerId={booking.providerId}
          availability={availability}
          title={t('bookingDetail.proposeNewTimeTitle')}
          confirmLabel={t('bookingDetail.proposeTimeButton')}
          onConfirm={handleSlotPickerConfirm}
        />
      )}
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    gap: 14,
  },
  backButton: {
    padding: 2,
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  badge: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 48,
    color: '#999999',
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  detailIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  detailTextColumn: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    textAlign: 'left',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  addressText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
    lineHeight: 20,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    marginBottom: 12,
  },
  map: {
    width: '100%',
    height: 200,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
  },
  directionsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  noMapNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
  },
  noMapText: {
    fontSize: 12,
    color: '#aaaaaa',
    flex: 1,
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 10,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#000000',
  },
  completeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
  },
  contactButtonBorder: {
    borderColor: '#000000',
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#f44336',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  declineText: {
    color: '#f44336',
    fontSize: 15,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  acceptText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  rescheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7c3aed',
    backgroundColor: '#ffffff',
  },
  rescheduleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7c3aed',
  },
  reschedulePendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ede9fe',
    borderRadius: 12,
    padding: 12,
  },
  reschedulePendingText: {
    fontSize: 13,
    color: '#5b21b6',
    flex: 1,
    lineHeight: 18,
  },
  completionLockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
  },
  completionLockedText: {
    fontSize: 13,
    color: '#666666',
    flex: 1,
    lineHeight: 18,
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
