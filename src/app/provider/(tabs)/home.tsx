import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { db } from '@/lib/firebase';
import { Booking, subscribeToProviderBookings } from '@/lib/bookings';
import { displayBookingServiceName } from '@/lib/serviceNames';
import { formatMonthDay, formatTime, parseLocalDate } from '@/lib/dateFormat';
import { useAuthUser } from '@/lib/useAuthUser';
import ProviderBottomNav from '@/components/ProviderBottomNav';

type Tab = 'active' | 'history';

const STATUS_ACTIVE: string[]  = ['pending', 'confirmed', 'pending_completion', 'reschedule_pending'];
const STATUS_HISTORY: string[] = ['completed', 'declined'];

const STATUS_LABEL_KEY: Record<string, string> = {
  pending:            'booking.pending',
  confirmed:          'booking.confirmed',
  completed:          'booking.completed',
  declined:           'booking.declined',
  pending_completion: 'booking.awaitingConfirmation',
  reschedule_pending: 'booking.rescheduleRequested',
};

function formatDate(date: string, time: string, language: string): string {
  return `${formatMonthDay(parseLocalDate(date), language)}, ${formatTime(time, language)}`;
}

function formatPrice(price: number, currency: string): string {
  return price.toLocaleString('en-US') + ' ' + currency;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending:            { color: '#b45309', bg: '#fef3c7' },
  confirmed:          { color: '#065f46', bg: '#d1fae5' },
  completed:          { color: '#374151', bg: '#f3f4f6' },
  declined:           { color: '#991b1b', bg: '#fee2e2' },
  pending_completion: { color: '#1e40af', bg: '#dbeafe' },
  reschedule_pending: { color: '#7c3aed', bg: '#ede9fe' },
};

export default function ProviderHomeTab() {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [tab, setTab] = useState<Tab>('active');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthUser();

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) setName(snap.data().name ?? '');
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const statuses = tab === 'active' ? STATUS_ACTIVE : STATUS_HISTORY;
    const unsubscribe = subscribeToProviderBookings(user.uid, statuses, (results) => {
      setBookings(results);
      setLoading(false);
    });
    return unsubscribe;
  }, [tab, user]);

  const emptyText = tab === 'active' ? t('providerHome.noActiveBookings') : t('providerHome.noHistoryYet');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{t('providerHome.greeting', { name: name || '…' })}</Text>
      </View>

      <View style={styles.segmentedWrapper}>
        <View style={styles.segmented}>
          {(['active', 'history'] as Tab[]).map((segTab) => (
            <TouchableOpacity
              key={segTab}
              style={[styles.segment, tab === segTab && styles.segmentActive]}
              onPress={() => setTab(segTab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, tab === segTab && styles.segmentTextActive]}>
                {segTab === 'active' ? t('providerHome.active') : t('providerHome.history')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {loading && <Text style={styles.emptyText}>{t('common.loading')}</Text>}

        {!loading && bookings.length === 0 && (
          <Text style={styles.emptyText}>{emptyText}</Text>
        )}

        {!loading && bookings.map((booking) => {
          const statusCfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
          return (
            <TouchableOpacity
              key={booking.id}
              style={styles.card}
              onPress={() => router.push(`/provider/booking-detail?bookingId=${booking.id}`)}
              activeOpacity={0.85}
            >
              {/* Title on its own full-width line (wraps up to 2 lines, never truncated),
                  badge on its own compact line below — same fix as the customer's
                  bookings.tsx list, for the same reason: sharing one row squeezed the
                  title down to whatever the (sometimes long, especially localized) status
                  badge left over. */}
              <View style={styles.cardHeader}>
                <Text style={styles.serviceName} numberOfLines={2}>{displayBookingServiceName(booking, t)}</Text>
                <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                  <Text style={[styles.badgeText, { color: statusCfg.color }]}>
                    {t(STATUS_LABEL_KEY[booking.status] ?? 'booking.pending')}
                  </Text>
                </View>
              </View>

              <Text style={styles.dateText}>
                {formatDate(booking.scheduledDate, booking.scheduledTime, i18n.language)}
              </Text>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('labels.customer')}</Text>
                <Text style={styles.detailValue}>{booking.customerName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('labels.price')}</Text>
                <Text style={styles.detailValue}>{formatPrice(booking.price, t('common.currency'))}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('labels.address')}</Text>
                <Text style={[styles.detailValue, styles.addressText]} numberOfLines={2}>
                  {booking.addressText}
                </Text>
              </View>

            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      <ProviderBottomNav activeTab="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  segmentedWrapper: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 100,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 100,
  },
  segmentActive: {
    backgroundColor: '#000000',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: '#999999',
    width: 64,
  },
  detailValue: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  addressText: {
    color: '#444444',
  },
});
