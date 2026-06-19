import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const upcomingBookings = [
  { id: 1, service: 'Plumbing', provider: 'Bobur Nazarov', day: 'Saturday', time: '10:00', price: '120,000', status: 'Confirmed' },
  { id: 2, service: 'Cleaning', provider: 'Aziz Karimov', day: 'Monday', time: '14:00', price: '80,000', status: 'Pending' },
];

const pastBookings = [
  { id: 3, service: 'Electrical', provider: 'Sherzod Mirzayev', day: 'Jun 10', time: '11:00', price: '150,000', status: 'Completed', rating: 5 },
  { id: 4, service: 'TV Mounting', provider: 'Akbar Tursunov', day: 'May 28', time: '16:00', price: '80,000', status: 'Completed', rating: 4 },
];

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>Past</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {activeTab === 'upcoming' ? (
          upcomingBookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <Text style={styles.serviceName}>{booking.service}</Text>
                <View style={[
                  styles.statusBadge, 
                  booking.status === 'Confirmed' ? styles.confirmedBadge : styles.pendingBadge
                ]}>
                  <Text style={[
                    styles.statusText,
                    booking.status === 'Confirmed' ? styles.confirmedText : styles.pendingText
                  ]}>{booking.status}</Text>
                </View>
              </View>
              <Text style={styles.providerName}>{booking.provider}</Text>
              <View style={styles.detailsRow}>
                <Text style={styles.detail}>📅 {booking.day}</Text>
                <Text style={styles.detail}>🕐 {booking.time}</Text>
              </View>
              <View style={styles.bookingFooter}>
                <Text style={styles.price}>{booking.price} UZS</Text>
                <TouchableOpacity 
                  style={styles.chatBtn}
                  onPress={() => router.push('/chat')}
                >
                  <Text style={styles.chatBtnText}>💬 Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          pastBookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <Text style={styles.serviceName}>{booking.service}</Text>
                <View style={styles.completedBadge}>
                  <Text style={styles.completedText}>{booking.status}</Text>
                </View>
              </View>
              <Text style={styles.providerName}>{booking.provider}</Text>
              <View style={styles.detailsRow}>
                <Text style={styles.detail}>📅 {booking.day}</Text>
                <Text style={styles.detail}>🕐 {booking.time}</Text>
              </View>
              <View style={styles.ratingRow}>
                {[...Array(5)].map((_, i) => (
                  <Text key={i} style={styles.starIcon}>
                    {i < booking.rating ? '⭐' : '☆'}
                  </Text>
                ))}
              </View>
              <View style={styles.bookingFooter}>
                <Text style={styles.price}>{booking.price} UZS</Text>
                <TouchableOpacity style={styles.rebookBtn}>
                  <Text style={styles.rebookBtnText}>Book Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/home')}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🔍</Text>
          <Text style={styles.navLabel}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navLabelActive}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
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
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  tabActive: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  tabText: {
    color: '#a0a0b0',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  list: {
    paddingHorizontal: 24,
  },
  bookingCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confirmedBadge: {
    backgroundColor: '#1a4a2a',
  },
  pendingBadge: {
    backgroundColor: '#4a3a1a',
  },
  completedBadge: {
    backgroundColor: '#2a2a4a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  confirmedText: {
    color: '#4caf50',
  },
  pendingText: {
    color: '#ffa726',
  },
  completedText: {
    color: '#a0a0b0',
    fontSize: 11,
    fontWeight: '600',
  },
  providerName: {
    color: '#a0a0b0',
    fontSize: 14,
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  detail: {
    color: '#c0c0d0',
    fontSize: 13,
  },
  ratingRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  starIcon: {
    fontSize: 14,
    marginRight: 2,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    paddingTop: 12,
  },
  price: {
    color: '#6c63ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatBtn: {
    backgroundColor: '#2a2560',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chatBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  rebookBtn: {
    backgroundColor: '#6c63ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rebookBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 22,
  },
  navLabel: {
    fontSize: 11,
    color: '#a0a0b0',
    marginTop: 4,
  },
  navLabelActive: {
    fontSize: 11,
    color: '#6c63ff',
    marginTop: 4,
    fontWeight: 'bold',
  },
});