import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Booking, markBookingsSeenByCustomer } from '@/lib/bookings';
import { getOrCreateChatForBooking } from '@/lib/chats';
import { displayBookingServiceName } from '@/lib/serviceNames';
import { useAuthUser } from '@/lib/useAuthUser';
import { subscribeWithRetry } from '@/lib/firestoreSubscribe';
import { formatTime, formatWeekdayMonthDay, parseLocalDate } from '@/lib/dateFormat';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatScheduled(date: string, time: string, language: string): string {
  const jsDate = parseLocalDate(date);
  return `${formatWeekdayMonthDay(jsDate, language)} · ${formatTime(time, language)}`;
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const STATUS_LABEL_KEY: Record<string, string> = {
  pending:            'booking.pending',
  confirmed:          'booking.confirmed',
  completed:          'booking.completed',
  declined:           'booking.declined',
  pending_completion: 'booking.awaitingConfirmation',
  reschedule_pending: 'booking.rescheduleRequested',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [providerPhotos, setProviderPhotos] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuthUser();
  const fetchedProviderIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    setLoading(true);
    // Single query; filter by status group client-side (avoids composite index)
    const unsubscribe = subscribeWithRetry<Booking[]>(
      (onNext, onError) =>
        onSnapshot(
          query(collection(db, 'bookings'), where('customerId', '==', user.uid)),
          (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }))),
          onError,
        ),
      (bookings) => {
        setAllBookings(bookings);
        setLoading(false);
      },
      { onError: (error) => console.error('bookings.tsx onSnapshot failed:', error) },
    );

    return unsubscribe;
  }, [user]);

  // Clears the Bookings-tab badge every time this screen comes into focus, not just
  // on first mount — best-effort, a failed write here just leaves the badge showing
  // a stale count rather than breaking anything the user sees.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      markBookingsSeenByCustomer(user.uid).catch((error) =>
        console.error('markBookingsSeenByCustomer failed:', error),
      );
    }, [user]),
  );

  // One-off lookup per provider — reuses the same photoURL field/fallback convention
  // as booking-detail.tsx (fixed earlier this session to display for every provider
  // category, not just cleaning companies), just fetched once per unique providerId
  // across the whole list instead of once per booking.
  useEffect(() => {
    const newIds = [...new Set(allBookings.map((b) => b.providerId))].filter(
      (id) => !fetchedProviderIds.current.has(id),
    );
    if (newIds.length === 0) return;
    newIds.forEach((id) => fetchedProviderIds.current.add(id));
    Promise.all(
      newIds.map(async (id) => {
        const snap = await getDoc(doc(db, 'users', id));
        return [id, snap.exists() ? ((snap.data().photoURL as string | null) ?? null) : null] as const;
      }),
    ).then((entries) => {
      setProviderPhotos((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [allBookings]);

  const upcomingStatuses = new Set(['pending', 'confirmed', 'pending_completion', 'reschedule_pending']);
  const pastStatuses     = new Set(['completed', 'declined']);

  const upcomingBookings = allBookings
    .filter((b) => upcomingStatuses.has(b.status))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const pastBookings = allBookings
    .filter((b) => pastStatuses.has(b.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const displayed = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  function openBookingDetail(booking: Booking) {
    router.push(`/booking-detail?bookingId=${booking.id}`);
  }

  async function openChat(booking: Booking) {
    // Same fix as booking-detail.tsx's handleMessage — this "Chat" button is a
    // SEPARATE entry point into chat-thread that the earlier fix missed. It's
    // reachable directly from the bookings list (no need to drill into
    // booking-detail first), including for a still-pending booking that neither
    // side has ever messaged on — chats/{bookingId} doesn't exist yet in that case,
    // and messages/{messageId}'s isChatParticipant() rule requires the parent chat
    // doc to exist, so subscribeToMessages/sendMessage both fail with
    // "Missing or insufficient permissions" without this.
    await getOrCreateChatForBooking(booking);
    router.push(
      `/chat-thread?chatId=${booking.id}&otherPartyName=${encodeURIComponent(booking.providerName)}`,
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('bookingsScreen.title')}</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            {t('bookingsScreen.upcoming')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            {t('bookingsScreen.past')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {loading ? (
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        ) : displayed.length === 0 ? (
          <Text style={styles.emptyText}>
            {activeTab === 'upcoming' ? t('bookingsScreen.noUpcoming') : t('bookingsScreen.noPast')}
          </Text>
        ) : (
          displayed.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              onPress={() => openBookingDetail(booking)}
              activeOpacity={0.85}
            >
              <Card style={styles.bookingCard}>
              {/* Title gets its own full-width line — never truncated, allowed to wrap to
                  2 lines — with the status badge on its own compact line below. Previously
                  these shared one row (title flex:1 + numberOfLines={1}), which squeezed
                  the title down to fit whatever the badge needed; long status words (e.g.
                  ru "Ожидает подтверждения", uz "Qayta rejalashtirish so'ralgan") left too
                  little room and cut the title off. */}
              <View style={styles.bookingHeader}>
                <Text style={styles.serviceName} numberOfLines={2}>
                  {displayBookingServiceName(booking, t)}
                </Text>
                <View style={[styles.statusBadge, statusBadgeStyle(booking.status)]}>
                  <Text style={[styles.statusText, statusTextStyle(booking.status)]}>
                    {t(STATUS_LABEL_KEY[booking.status] ?? 'booking.pending')}
                  </Text>
                </View>
              </View>

              {/* Small preview avatar — the full-size photo still lives on the detail
                  screen (booking-detail.tsx) after tapping in; this is just an
                  identity cue on the list card itself, next to the provider's name. */}
              <View style={styles.providerRow}>
                <View style={styles.providerAvatar}>
                  {providerPhotos[booking.providerId] ? (
                    <Image
                      source={{ uri: providerPhotos[booking.providerId]! }}
                      style={styles.providerAvatarImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={styles.providerAvatarInitials}>{initials(booking.providerName)}</Text>
                  )}
                </View>
                <Text style={styles.providerName}>{booking.providerName}</Text>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={14} color="#666666" />
                  <Text style={styles.detail}>
                    {formatScheduled(booking.scheduledDate, booking.scheduledTime, i18n.language)}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingFooter}>
                <Text style={styles.price}>
                  {(booking.price ?? 0).toLocaleString('en-US')} {t('common.currency')}
                </Text>
                <Button
                  title={t('common.chat')}
                  size="small"
                  icon={<Ionicons name="chatbubble-outline" size={14} color="#ffffff" />}
                  onPress={() => openChat(booking)}
                />
              </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <CustomerBottomNav activeTab="bookings" />
    </View>
  );
}

// ── Status badge helpers ──────────────────────────────────────────────────────

function statusBadgeStyle(status: string) {
  switch (status) {
    case 'confirmed':          return styles.confirmedBadge;
    case 'pending':             return styles.pendingBadge;
    case 'declined':            return styles.declinedBadge;
    case 'pending_completion':  return styles.pendingCompletionBadge;
    case 'reschedule_pending':  return styles.reschedulePendingBadge;
    default:                    return styles.completedBadge;
  }
}

function statusTextStyle(status: string) {
  switch (status) {
    case 'confirmed':          return styles.confirmedText;
    case 'pending':             return styles.pendingText;
    case 'declined':            return styles.declinedText;
    case 'pending_completion':  return styles.pendingCompletionText;
    case 'reschedule_pending':  return styles.reschedulePendingText;
    default:                    return styles.completedText;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  tabActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  tabText: {
    color: '#666666',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  list: {
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  // Card supplies background/border/radius/padding now — only the list-specific
  // gap between cards lives here.
  bookingCard: {
    marginBottom: 14,
  },
  bookingHeader: {
    marginBottom: 6,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confirmedBadge:         { backgroundColor: '#e8f5e9' },
  pendingBadge:           { backgroundColor: '#fff3e0' },
  completedBadge:         { backgroundColor: '#f5f5f5' },
  declinedBadge:          { backgroundColor: '#fdecea' },
  pendingCompletionBadge: { backgroundColor: '#dbeafe' },
  reschedulePendingBadge: { backgroundColor: '#ede9fe' },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  confirmedText:         { color: '#2e7d32' },
  pendingText:            { color: '#e65100' },
  completedText:          { color: '#666666' },
  declinedText:           { color: '#c62828' },
  pendingCompletionText:  { color: '#1e40af' },
  reschedulePendingText:  { color: '#7c3aed' },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  providerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  providerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  providerAvatarInitials: {
    fontSize: 10,
    fontWeight: '700',
    color: '#444444',
  },
  providerName: {
    color: '#666666',
    fontSize: 14,
  },
  detailsRow: {
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detail: {
    color: '#666666',
    fontSize: 13,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    paddingTop: 12,
  },
  price: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
