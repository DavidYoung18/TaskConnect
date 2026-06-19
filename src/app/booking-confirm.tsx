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
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
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

          <Text style={styles.note}>
            💡 You pay a small deposit now to confirm your booking. The remaining amount is paid in cash directly to the service provider after the job is completed.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Payment Method</Text>
          <TouchableOpacity style={[styles.paymentMethod, styles.paymentMethodSelected]}>
            <Text style={styles.paymentIcon}>💳</Text>
            <Text style={styles.paymentMethodText}>UzCard</Text>
            <Text style={styles.checkmark}>✓</Text>
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
  summaryCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  paymentCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rowLabel: {
    color: '#a0a0b0',
    fontSize: 14,
  },
  rowValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  depositBox: {
    backgroundColor: '#2a2560',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  depositLabel: {
    color: '#a0a0ff',
    fontSize: 13,
    marginBottom: 4,
  },
  depositAmount: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  remainingBox: {
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  remainingLabel: {
    color: '#a0c0d0',
    fontSize: 13,
    marginBottom: 4,
  },
  remainingAmount: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  note: {
    color: '#a0a0b0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  paymentMethodSelected: {
    borderColor: '#6c63ff',
    backgroundColor: '#2a2560',
  },
  paymentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentMethodText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  checkmark: {
    color: '#6c63ff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  comingSoonRow: {
    paddingTop: 10,
  },
  comingSoonText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
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
  payButton: {
    backgroundColor: '#6c63ff',
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