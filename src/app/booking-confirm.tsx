import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function BookingConfirmScreen() {
  const { providerId, service, day, time } = useLocalSearchParams();
  
  const jobPrice = 120000;
  const depositPercent = 0.2;
  const depositAmount = jobPrice * depositPercent;
  const remainingAmount = jobPrice - depositAmount;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Ionicons name="arrow-back" size={22} color="#000000" />
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirm Booking</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionLabel}>Booking Summary</Text>
          
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Service</Text>
            <Text style={styles.rowValue}>{service}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Provider</Text>
            <Text style={styles.rowValue}>Bobur Nazarov</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Day</Text>
            <Text style={styles.rowValue}>{day}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Time</Text>
            <Text style={styles.rowValue}>{time}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Job Price</Text>
            <Text style={styles.rowValue}>{jobPrice.toLocaleString()} UZS</Text>
          </View>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.sectionLabel}>Payment Breakdown</Text>
          
          <View style={styles.depositBox}>
            <Text style={styles.depositLabel}>Pay Now (Deposit - 20%)</Text>
            <Text style={styles.depositAmount}>{depositAmount.toLocaleString()} UZS</Text>
          </View>

          <View style={styles.remainingBox}>
            <Text style={styles.remainingLabel}>Pay Provider in Cash (80%)</Text>
            <Text style={styles.remainingAmount}>{remainingAmount.toLocaleString()} UZS</Text>
          </View>

          <View style={styles.noteRow}>
            <Ionicons name="information-circle" size={16} color="#666666" />
            <Text style={styles.note}>
              You pay a small deposit now to confirm your booking. The remaining amount is paid in cash directly to the service provider after the job is completed.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Payment Method</Text>
          <TouchableOpacity style={[styles.paymentMethod, styles.paymentMethodSelected]}>
            <Ionicons name="card" size={24} color="#000000" />
            <Text style={styles.paymentMethodText}>UzCard</Text>
            <Ionicons name="checkmark-circle" size={20} color="#000000" />
          </TouchableOpacity>
          <View style={styles.comingSoonRow}>
            <Text style={styles.comingSoonText}>Click, Payme, Paynet coming soon</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.payButton}
          onPress={() => router.push({ pathname: '/payment', params: { amount: depositAmount.toString(), service, day, time } })}
        >
          <Text style={styles.payButtonText}>Pay Deposit - {depositAmount.toLocaleString()} UZS</Text>
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
  summaryCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  paymentCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  depositBox: {
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  depositLabel: {
    color: '#cccccc',
    fontSize: 13,
    marginBottom: 4,
  },
  depositAmount: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  remainingBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  remainingLabel: {
    color: '#666666',
    fontSize: 13,
    marginBottom: 4,
  },
  remainingAmount: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noteRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  note: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    gap: 12,
  },
  paymentMethodSelected: {
    borderColor: '#000000',
    backgroundColor: '#f5f5f5',
  },
  paymentMethodText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  comingSoonRow: {
    paddingTop: 10,
  },
  comingSoonText: {
    color: '#999999',
    fontSize: 12,
    fontStyle: 'italic',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  payButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});