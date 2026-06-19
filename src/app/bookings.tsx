import { Ionicons } from '@expo/vector-icons';
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
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={14} color="#666666" />
                  <Text style={styles.detail}>{booking.day}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={14} color="#666666" />
                  <Text style={styles.detail}>{booking.time}</Text>
                </View>
              </View>
              <View style={styles.bookingFooter}>
                <Text style={styles.price}>{booking.price} UZS</Text>
                <TouchableOpacity 
                  style={styles.chatBtn}
                  onPress={() => router.push('/chat')}
                >
                  <Ionicons name="chatbubble-outline" size={14} color="#ffffff" />
                  <Text style={styles.chatBtnText}>Chat</Text>
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
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={14} color="#666666" />
                  <Text style={styles.detail}>{booking.day}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={14} color="#666666" />
                  <Text style={styles.detail}>{booking.time}</Text>
                </View>
              </View>
              <View style={styles.ratingRow}>
                {[...Array(5)].map((_, i) => (
                  <Ionicons 
                    key={i} 
                    name={i < booking.rating ? 'star' : 'star-outline'} 
                    size={14} 
                    color="#000000" 
                    style={{ marginRight: 2 }}
                  />
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
          <Ionicons name="home-outline" size={22} color="#999999" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/search')}>
          <Ionicons name="search-outline" size={22} color="#999999" />
          <Text style={styles.navLabel}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="receipt" size={22} color="#000000" />
          <Text style={styles.navLabelActive}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <Ionicons name="person-outline" size={22} color="#999999" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
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
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
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
    color: '#000000',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confirmedBadge: {
    backgroundColor: '#e8f5e9',
  },
  pendingBadge: {
    backgroundColor: '#fff3e0',
  },
  completedBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  confirmedText: {
    color: '#2e7d32',
  },
  pendingText: {
    color: '#e65100',
  },
  completedText: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '600',
  },
  providerName: {
    color: '#666666',
    fontSize: 14,
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detail: {
    color: '#666666',
    fontSize: 13,
  },
  ratingRow: {
    flexDirection: 'row',
    marginBottom: 10,
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
  chatBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  rebookBtn: {
    backgroundColor: '#000000',
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
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 11,
    color: '#999999',
    marginTop: 4,
  },
  navLabelActive: {
    fontSize: 11,
    color: '#000000',
    marginTop: 4,
    fontWeight: 'bold',
  },
});