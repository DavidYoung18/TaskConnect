import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const notifications = [
  { id: 1, icon: 'checkmark-circle', title: 'Booking Confirmed', message: 'Bobur Nazarov confirmed your plumbing booking for Saturday.', time: '2 hours ago', unread: true },
  { id: 2, icon: 'chatbubble', title: 'New Message', message: 'Bobur Nazarov sent you a message.', time: '3 hours ago', unread: true },
  { id: 3, icon: 'card', title: 'Payment Received', message: 'Your deposit of 24,000 UZS was successfully processed.', time: '5 hours ago', unread: false },
  { id: 4, icon: 'star', title: 'Rate Your Service', message: 'How was your experience with Sherzod Mirzayev? Leave a review.', time: '1 day ago', unread: false },
  { id: 5, icon: 'notifications', title: 'Upcoming Booking', message: 'Reminder: Your cleaning service is scheduled for Monday at 14:00.', time: '2 days ago', unread: false },
  { id: 6, icon: 'sparkles', title: 'Welcome to TaskConnect!', message: 'Thanks for joining. Explore services available in Tashkent.', time: '5 days ago', unread: false },
];

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {notifications.map((notification) => (
          <TouchableOpacity 
            key={notification.id} 
            style={[styles.notificationCard, notification.unread && styles.unreadCard]}
          >
            <View style={[styles.iconCircle, notification.unread && styles.iconCircleUnread]}>
              <Ionicons name={notification.icon as any} size={20} color={notification.unread ? '#ffffff' : '#000000'} />
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                {notification.unread && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.message}>{notification.message}</Text>
              <Text style={styles.time}>{notification.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingBottom: 20,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backButton: {
    color: '#000000',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  list: {
    paddingHorizontal: 24,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  unreadCard: {
    borderColor: '#000000',
    backgroundColor: '#f9f9f9',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconCircleUnread: {
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000000',
  },
  message: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 6,
  },
  time: {
    fontSize: 11,
    color: '#999999',
  },
});