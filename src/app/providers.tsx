import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const providersData: Record<string, any[]> = {
  Cleaning: [
    { id: 1, name: 'Aziz Karimov', rating: 4.9, reviews: 127, price: '80,000', experience: '5 years', bio: 'Professional cleaner specializing in deep cleaning and sanitization.', available: true },
    { id: 2, name: 'Malika Yusupova', rating: 4.8, reviews: 98, price: '70,000', experience: '3 years', bio: 'Experienced in home and office cleaning with eco-friendly products.', available: true },
    { id: 3, name: 'Sardor Toshmatov', rating: 4.7, reviews: 64, price: '65,000', experience: '2 years', bio: 'Reliable and thorough cleaning professional.', available: false },
  ],
  Plumbing: [
    { id: 1, name: 'Bobur Nazarov', rating: 4.9, reviews: 203, price: '120,000', experience: '8 years', bio: 'Expert plumber handling all types of pipe repairs and installations.', available: true },
    { id: 2, name: 'Jasur Rakhimov', rating: 4.8, reviews: 156, price: '100,000', experience: '6 years', bio: 'Specialist in bathroom and kitchen plumbing repairs.', available: true },
    { id: 3, name: 'Timur Aliyev', rating: 4.6, reviews: 89, price: '90,000', experience: '4 years', bio: 'Affordable and reliable plumbing services.', available: true },
  ],
  Electrical: [
    { id: 1, name: 'Sherzod Mirzayev', rating: 4.9, reviews: 178, price: '150,000', experience: '10 years', bio: 'Certified electrician for all wiring and installation needs.', available: true },
    { id: 2, name: 'Nodir Ergashev', rating: 4.7, reviews: 112, price: '130,000', experience: '7 years', bio: 'Specialist in electrical panel upgrades and smart home installations.', available: true },
  ],
  'Carpet Wash': [
    { id: 1, name: 'Dilnoza Hamidova', rating: 4.8, reviews: 145, price: '60,000', experience: '4 years', bio: 'Professional carpet and rug cleaning specialist.', available: true },
    { id: 2, name: 'Kamol Umarov', rating: 4.7, reviews: 98, price: '55,000', experience: '3 years', bio: 'Deep carpet cleaning with professional equipment.', available: true },
  ],
  'TV Mounting': [
    { id: 1, name: 'Akbar Tursunov', rating: 4.9, reviews: 87, price: '80,000', experience: '5 years', bio: 'Expert in TV mounting and home theater setups.', available: true },
    { id: 2, name: 'Firdavs Sobirov', rating: 4.8, reviews: 65, price: '70,000', experience: '3 years', bio: 'Clean and precise TV and shelf mounting service.', available: true },
  ],
  'Deep Clean': [
    { id: 1, name: 'Nargiza Qodirova', rating: 4.9, reviews: 167, price: '150,000', experience: '6 years', bio: 'Full deep cleaning specialist for homes and offices.', available: true },
  ],
  Painting: [
    { id: 1, name: 'Ulugbek Ismoilov', rating: 4.8, reviews: 134, price: '200,000', experience: '9 years', bio: 'Professional painter for interior and exterior walls.', available: true },
    { id: 2, name: 'Behruz Yuldashev', rating: 4.7, reviews: '78', price: '180,000', experience: '5 years', bio: 'Quality painting services at affordable prices.', available: true },
  ],
  Furniture: [
    { id: 1, name: 'Sanjar Xasanov', rating: 4.8, reviews: 92, price: '100,000', experience: '6 years', bio: 'Expert in furniture assembly and repair.', available: true },
  ],
};

export default function ProvidersScreen() {
  const { service } = useLocalSearchParams();
  const serviceName = service as string || 'Cleaning';
  const providers = providersData[serviceName] || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{serviceName}</Text>
        <Text style={styles.subtitle}>{providers.length} providers available</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {providers.map((provider) => (
          <TouchableOpacity 
            key={provider.id} 
            style={styles.providerCard}
            onPress={() => router.push({ pathname: '/provider-profile', params: { providerId: provider.id, service: serviceName } })}
          >
            <View style={styles.providerHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{provider.name.charAt(0)}</Text>
              </View>
              <View style={styles.providerInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  {provider.available ? (
                    <View style={styles.availableBadge}>
                      <Text style={styles.availableText}>Available</Text>
                    </View>
                  ) : (
                    <View style={styles.busyBadge}>
                      <Text style={styles.busyText}>Busy</Text>
                    </View>
                  )}
                </View>
                <View style={styles.ratingRow}>
                  <Text style={styles.star}>⭐</Text>
                  <Text style={styles.rating}>{provider.rating}</Text>
                  <Text style={styles.reviews}>({provider.reviews} reviews)</Text>
                </View>
                <Text style={styles.experience}>{provider.experience} experience</Text>
              </View>
            </View>
            <Text style={styles.bio}>{provider.bio}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Starting from</Text>
              <Text style={styles.price}>{provider.price} UZS</Text>
            </View>
          </TouchableOpacity>
        ))}
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
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  backButton: {
    color: '#6c63ff',
    fontSize: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a0b0',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  providerCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  providerHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6c63ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  providerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  availableBadge: {
    backgroundColor: '#1a4a2a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  availableText: {
    color: '#4caf50',
    fontSize: 11,
    fontWeight: '600',
  },
  busyBadge: {
    backgroundColor: '#4a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  busyText: {
    color: '#f44336',
    fontSize: 11,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  star: {
    fontSize: 12,
  },
  rating: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  reviews: {
    color: '#a0a0b0',
    fontSize: 12,
    marginLeft: 4,
  },
  experience: {
    color: '#a0a0b0',
    fontSize: 12,
    marginTop: 2,
  },
  bio: {
    color: '#c0c0d0',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    paddingTop: 12,
  },
  priceLabel: {
    color: '#a0a0b0',
    fontSize: 13,
  },
  price: {
    color: '#6c63ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});