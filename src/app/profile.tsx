import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  average,
  collection,
  count,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '@/lib/firebase';
import { useAuthUser } from '@/lib/useAuthUser';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import LanguageSelector from '@/components/LanguageSelector';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

const menuItems = [
  { id: 0, icon: 'person-outline', labelKey: 'profileMenu.accountDetails' },
  { id: 1, icon: 'receipt-outline', labelKey: 'profileMenu.myBookings' },
  { id: 2, icon: 'location-outline', labelKey: 'addressesScreen.title' },
  { id: 3, icon: 'globe-outline', labelKey: 'profileMenu.language' },
  { id: 4, icon: 'notifications-outline', labelKey: 'profileMenu.notifications' },
  { id: 5, icon: 'help-circle-outline', labelKey: 'profileMenu.helpSupport' },
  { id: 6, icon: 'document-text-outline', labelKey: 'profileMenu.termsPrivacy' },
] as const;

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingsCount, setBookingsCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [ratingGiven, setRatingGiven] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthUser();

  // Refetches every time this screen regains focus (not just on mount) — so returning
  // from account-details.tsx after editing the phone number shows the updated value
  // immediately instead of the stale one fetched on first mount.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadData(user.uid);
    }, [user]),
  );

  async function loadData(uid: string) {
    const [userSnap, bookingsSnap, completedSnap, ratingSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getCountFromServer(query(collection(db, 'bookings'), where('customerId', '==', uid))),
      getCountFromServer(
        query(collection(db, 'bookings'), where('customerId', '==', uid), where('status', '==', 'completed')),
      ),
      // Reviews this customer has left for providers — best-effort, matches
      // getProviderRatingSummary's pattern in providers.ts.
      getAggregateFromServer(query(collection(db, 'reviews'), where('customerId', '==', uid)), {
        averageRating: average('rating'),
        reviewCount: count(),
      }).catch(() => null),
    ]);

    if (userSnap.exists()) {
      const data = userSnap.data();
      setName(data.name ?? '');
      setEmail(data.email ?? '');
      setPhone(data.phone ?? '');
    }
    setBookingsCount(bookingsSnap.data().count);
    setCompletedCount(completedSnap.data().count);
    setRatingGiven(ratingSnap?.data().averageRating ?? 0);
    setLoading(false);
  }

  async function handleLanguageSelected(code: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid), { language: code });
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('profileMenu.title')}</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name ? initials(name) : ''}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.phone}>{phone}</Text>
        </View>

        <View style={styles.statsRow}>
          <Card muted style={styles.statCard}>
            <Text style={styles.statValue}>{loading ? '—' : bookingsCount}</Text>
            <Text style={styles.statLabel}>{t('profileMenu.statBookings')}</Text>
          </Card>
          <Card muted style={styles.statCard}>
            <Text style={styles.statValue}>{loading ? '—' : completedCount}</Text>
            <Text style={styles.statLabel}>{t('profileMenu.statCompleted')}</Text>
          </Card>
          <Card muted style={styles.statCard}>
            <Text style={styles.statValue}>{loading ? '—' : ratingGiven.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{t('profileMenu.statRatingGiven')}</Text>
          </Card>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                if (item.id === 0) router.push('/account-details');
                if (item.id === 4) router.push('/notifications');
                if (item.id === 1) router.push('/bookings');
                if (item.id === 2) router.push('/addresses');
                if (item.id === 3) setShowLanguageSelector(true);
                if (item.id === 5) router.push('/support');
                if (item.id === 6) router.push('/terms-privacy');
              }}
            >
              <Card style={styles.menuItem}>
                <Ionicons name={item.icon as any} size={20} color="#000000" style={styles.menuIcon} />
                <Text style={styles.menuLabel}>{t(item.labelKey)}</Text>
                <Ionicons name="chevron-forward" size={20} color="#999999" />
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title={t('profileMenu.signOut')}
          variant="outlineDanger"
          style={styles.logoutButton}
          onPress={async () => {
            await signOut(auth);
            router.dismissAll();
            router.replace('/login');
          }}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      <CustomerBottomNav activeTab="profile" />

      <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
        onSelect={handleLanguageSelected}
      />
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
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
  },
  email: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  phone: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  // Card (muted) supplies background/border/radius/padding — only the layout
  // needed alongside its siblings lives here.
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  statLabel: {
    fontSize: 11,
    color: '#666666',
    marginTop: 4,
  },
  menuSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    color: '#000000',
    fontSize: 15,
  },
  logoutButton: {
    marginHorizontal: 24,
  },
});