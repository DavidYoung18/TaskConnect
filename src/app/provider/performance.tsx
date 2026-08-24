import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Booking } from '@/lib/bookings';
import { displayBookingServiceName } from '@/lib/serviceNames';
import { formatTime, formatWeekdayMonthDay, parseLocalDate } from '@/lib/dateFormat';
import { useAuthUser } from '@/lib/useAuthUser';

const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US')} ${currency}`;
}

function formatJobDateTime(dateStr: string, timeStr: string, language: string): string {
  return `${formatWeekdayMonthDay(parseLocalDate(dateStr), language)} · ${formatTime(timeStr, language)}`;
}

interface MonthSummary {
  key: string;
  label: string;
  jobCount: number;
  earned: number;
}

type TabKey = 'earnings' | 'monthly';

export default function PerformanceScreen() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('earnings');
  const { user } = useAuthUser();

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    setLoading(true);
    const q = query(
      collection(db, 'bookings'),
      where('providerId', '==', user.uid),
      where('status', '==', 'completed'),
    );
    getDocs(q).then((snap) => {
      const results = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }));
      results.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
      setBookings(results);
      setLoading(false);
    });
  }, [user]);

  const now = new Date();
  const currentMonthKey = monthKey(now.getFullYear(), now.getMonth());

  const thisMonthBookings = bookings.filter((b) => b.scheduledDate.slice(0, 7) === currentMonthKey);
  const thisMonthCount = thisMonthBookings.length;
  const thisMonthEarnings = thisMonthBookings.reduce((sum, b) => sum + (b.price ?? 0), 0);
  const totalEarnings = bookings.reduce((sum, b) => sum + (b.price ?? 0), 0);

  const monthlyBreakdown: MonthSummary[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d.getFullYear(), d.getMonth());
    const monthBookings = bookings.filter((b) => b.scheduledDate.slice(0, 7) === key);
    const earned = monthBookings.reduce((sum, b) => sum + (b.price ?? 0), 0);
    if (earned === 0) continue;
    monthlyBreakdown.push({
      key,
      label: `${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`,
      jobCount: monthBookings.length,
      earned,
    });
  }

  function renderJobRow({ item }: { item: Booking }) {
    return (
      <View style={styles.jobRow}>
        <View style={styles.jobLeft}>
          <Text style={styles.jobService} numberOfLines={1}>{displayBookingServiceName(item, t)}</Text>
          <Text style={styles.jobDate}>{formatJobDateTime(item.scheduledDate, item.scheduledTime, i18n.language)}</Text>
        </View>
        <Text style={styles.jobPrice}>{formatMoney(item.price, t('common.currency'))}</Text>
      </View>
    );
  }

  function renderMonthRow({ item }: { item: MonthSummary }) {
    return (
      <View style={styles.monthRow}>
        <View style={styles.monthLeft}>
          <Text style={styles.monthLabel}>{item.label}</Text>
        </View>
        <View style={styles.monthRight}>
          <Text style={styles.monthJobs}>
            {item.jobCount} {item.jobCount === 1 ? t('performanceScreen.job') : t('performanceScreen.jobs')}
          </Text>
          <Text style={styles.monthEarned}>{formatMoney(item.earned, t('common.currency'))}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('provider.performance')}</Text>
        </View>
        <ActivityIndicator size="large" color="#000000" style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Performance</Text>
      </View>

      {/* Lifetime total — always visible above tabs */}
      <View style={styles.totalCard}>
        <Text style={styles.totalValue}>{formatMoney(totalEarnings, t('common.currency'))}</Text>
        <Text style={styles.totalLabel}>{t('performanceScreen.totalEarned')}</Text>
        <Text style={styles.totalSubtitle}>{t('performanceScreen.allTime')}</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'earnings' && styles.tabButtonActive]}
          onPress={() => setActiveTab('earnings')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'earnings' && styles.tabTextActive]}>{t('provider.earnings')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'monthly' && styles.tabButtonActive]}
          onPress={() => setActiveTab('monthly')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'monthly' && styles.tabTextActive]}>{t('provider.monthly')}</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'earnings' ? (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderJobRow}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View style={styles.thisMonthCard}>
              <View>
                <Text style={styles.thisMonthLabel}>{t('performanceScreen.thisMonth')}</Text>
                <Text style={styles.thisMonthJobs}>
                  {thisMonthCount} {thisMonthCount === 1 ? t('performanceScreen.job') : t('performanceScreen.jobs')}
                </Text>
              </View>
              <Text style={styles.thisMonthValue}>{formatMoney(thisMonthEarnings, t('common.currency'))}</Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('performanceScreen.noEarningsYet')}</Text>
          }
        />
      ) : (
        <FlatList
          data={monthlyBreakdown}
          keyExtractor={(item) => item.key}
          renderItem={renderMonthRow}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('performanceScreen.noEarningsAtAll')}</Text>}
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
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    gap: 14,
  },
  backButton: {
    padding: 2,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  totalCard: {
    backgroundColor: '#000000',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 8,
  },
  totalSubtitle: {
    fontSize: 12,
    color: '#aaaaaa',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#e8e8e8',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  tabTextActive: {
    color: '#000000',
  },
  list: {
    flex: 1,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  thisMonthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  thisMonthLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.4,
  },
  thisMonthJobs: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
  },
  thisMonthValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  jobLeft: {
    flex: 1,
  },
  jobService: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  jobDate: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  jobPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    flexShrink: 0,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  monthLeft: {
    flex: 1,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  monthRight: {
    alignItems: 'flex-end',
  },
  monthJobs: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 2,
  },
  monthEarned: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 40,
  },
});
