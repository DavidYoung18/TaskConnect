import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const notifications = [
  { id: 1, icon: '✅', title: 'Booking Confirmed', message: 'Bobur Nazarov confirmed your plumbing booking for Saturday.', time: '2 hours ago', unread: true },
  { id: 2, icon: '💬', title: 'New Message', message: 'Bobur Nazarov sent you a message.', time: '3 hours ago', unread: true },
  { id: 3, icon: '💳', title: 'Payment Received', message: 'Your deposit of 24,000 UZS was successfully processed.', time: '5 hours ago', unread: false },
  { id: 4, icon: '⭐', title: 'Rate Your Service', message: 'How was your experience with Sherzod Mirzayev? Leave a review.', time: '1 day ago', unread: false },
  { id: 5, icon: '🔔', title: 'Upcoming Booking', message: 'Reminder: Your cleaning service is scheduled for Monday at 14:00.', time: '2 days ago', unread: false },
  { id: 6, icon: '🎉', title: 'Welcome to TaskConnect!', message: 'Thanks for joining. Explore services available in Tashkent.', time: '5 days ago', unread: false },
];

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {notifications.map((notification) => (
          <TouchableOpacity 
            key={notification.id} 
            style={[styles.notificationCard, notification.unread && styles.unreadCard]}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>{notification.icon}</Text>
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
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    color: '#6c63ff',
    fontSize: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  list: {
    paddingHorizontal: 24,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  unreadCard: {
    borderColor: '#6c63ff',
    backgroundColor: '#1e1e42',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a2560',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
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
    color: '#ffffff',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6c63ff',
  },
  message: {
    fontSize: 13,
    color: '#c0c0d0',
    lineHeight: 18,
    marginBottom: 6,
  },
  time: {
    fontSize: 11,
    color: '#666',
  },
});