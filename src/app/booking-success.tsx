import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function BookingSuccessScreen() {
  const { service, day, time } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={48} color="#ffffff" />
        </View>

        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>Your deposit has been received</Text>

        <View style={styles.detailsCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Service</Text>
            <Text style={styles.rowValue}>{service}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Day</Text>
            <Text style={styles.rowValue}>{day}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Time</Text>
            <Text style={styles.rowValue}>{time}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          You can now chat with your service provider to confirm details and discuss the job.
        </Text>

        <TouchableOpacity 
          style={styles.chatButton}
          onPress={() => router.push('/chat')}
        >
          <Ionicons name="chatbubble" size={18} color="#ffffff" />
          <Text style={styles.chatButtonText}>Open Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => router.push('/home')}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  checkCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 30,
  },
  detailsCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowLabel: {
    color: '#666666',
    fontSize: 14,
  },
  rowValue: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  note: {
    color: '#666666',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  chatButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  chatButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  homeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#000000',
    fontSize: 16,
  },
});