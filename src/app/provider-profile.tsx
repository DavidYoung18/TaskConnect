import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const timeSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const jobTypes = [
  { id: 1, name: 'Faucet Installation', price: '80,000' },
  { id: 2, name: 'Pipe Repair', price: '120,000' },
  { id: 3, name: 'Toilet Repair', price: '100,000' },
  { id: 4, name: 'Shower Fix', price: '150,000' },
];

export default function ProviderProfileScreen() {
  const { providerId, service } = useLocalSearchParams();
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>B</Text>
          </View>
          <Text style={styles.name}>Bobur Nazarov</Text>
          <Text style={styles.serviceType}>{service} Specialist</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.star}>⭐</Text>
            <Text style={styles.rating}>4.9</Text>
            <Text style={styles.reviews}>(203 reviews)</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>8</Text>
            <Text style={styles.statLabel}>Years Exp.</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>340+</Text>
            <Text style={styles.statLabel}>Jobs Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>98%</Text>
            <Text style={styles.statLabel}>On Time</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Job Type</Text>
          {jobTypes.map((job) => (
            <TouchableOpacity 
              key={job.id} 
              style={[styles.jobCard, selectedJob === job.id && styles.jobCardSelected]}
              onPress={() => setSelectedJob(job.id)}
            >
              <Text style={styles.jobName}>{job.name}</Text>
              <Text style={styles.jobPrice}>{job.price} UZS</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {days.map((day, index) => (
              <TouchableOpacity 
                key={day} 
                style={[styles.dayButton, selectedDay === index && styles.dayButtonSelected]}
                onPress={() => setSelectedDay(index)}
              >
                <Text style={[styles.dayText, selectedDay === index && styles.dayTextSelected]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          <View style={styles.timeGrid}>
            {timeSlots.map((time) => (
              <TouchableOpacity 
                key={time} 
                style={[styles.timeSlot, selectedTime === time && styles.timeSlotSelected]}
                onPress={() => setSelectedTime(time)}
              >
                <Text style={[styles.timeText, selectedTime === time && styles.timeTextSelected]}>{time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={[styles.bookButton, (!selectedJob || !selectedTime) && styles.bookButtonDisabled]}
          disabled={!selectedJob || !selectedTime}
          onPress={() => router.push({ pathname: '/booking-confirm', params: { providerId, service, day: days[selectedDay], time: selectedTime } })}
        >
          <Text style={styles.bookButtonText}>Continue to Book</Text>
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
    paddingBottom: 10,
  },
  backButton: {
    color: '#6c63ff',
    fontSize: 16,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#6c63ff',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  serviceType: {
    fontSize: 14,
    color: '#a0a0b0',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  star: {
    fontSize: 14,
  },
  rating: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  reviews: {
    color: '#a0a0b0',
    fontSize: 14,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6c63ff',
  },
  statLabel: {
    fontSize: 11,
    color: '#a0a0b0',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  jobCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  jobCardSelected: {
    borderColor: '#6c63ff',
    backgroundColor: '#2a2560',
  },
  jobName: {
    color: '#ffffff',
    fontSize: 15,
  },
  jobPrice: {
    color: '#6c63ff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dayButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#16213e',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  dayButtonSelected: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  dayText: {
    color: '#a0a0b0',
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#ffffff',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    width: '22%',
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  timeText: {
    color: '#a0a0b0',
    fontSize: 13,
    fontWeight: '600',
  },
  timeTextSelected: {
    color: '#ffffff',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#16213e',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  bookButton: {
    backgroundColor: '#6c63ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#3a3a5a',
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});