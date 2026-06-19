import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
const services = [
  { id: 1, name: 'Cleaning', icon: '🧹', description: 'Home & office cleaning' },
  { id: 2, name: 'Plumbing', icon: '🔧', description: 'Pipes, faucets & more' },
  { id: 3, name: 'Electrical', icon: '⚡', description: 'Wiring & installations' },
  { id: 4, name: 'Carpet Wash', icon: '🪣', description: 'Deep carpet cleaning' },
  { id: 5, name: 'TV Mounting', icon: '📺', description: 'TV & shelf mounting' },
  { id: 6, name: 'Deep Clean', icon: '✨', description: 'Full deep cleaning' },
  { id: 7, name: 'Painting', icon: '🎨', description: 'Wall & room painting' },
  { id: 8, name: 'Furniture', icon: '🛋️', description: 'Assembly & repair' },
];

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning 👋</Text>
          <Text style={styles.location}>📍 Tashkent, Uzbekistan</Text>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
  <Text style={styles.profileText}>D</Text>
</TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.searchContainer} onPress={() => router.push('/search')}>
  <View style={styles.searchInput}>
    <Text style={styles.searchPlaceholder}>🔍  Search for a service...</Text>
  </View>
</TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Our Services</Text>
        <View style={styles.servicesGrid}>
          {services.map((service) => (
  <TouchableOpacity 
    key={service.id} 
    style={styles.serviceCard}
    onPress={() => router.push({ pathname: '/providers', params: { service: service.name } })}
  >
              <Text style={styles.serviceIcon}>{service.icon}</Text>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceDescription}>{service.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Popular Services</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularContainer}>
          {services.slice(0, 4).map((service) => (
            <TouchableOpacity key={service.id} style={styles.popularCard}>
              <Text style={styles.popularIcon}>{service.icon}</Text>
              <Text style={styles.popularName}>{service.name}</Text>
              <Text style={styles.popularPrice}>From 50,000 UZS</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabelActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/search')}>
  <Text style={styles.navIcon}>🔍</Text>
  <Text style={styles.navLabel}>Search</Text>
</TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/bookings')}>
  <Text style={styles.navIcon}>📋</Text>
  <Text style={styles.navLabel}>Bookings</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  location: {
    fontSize: 14,
    color: '#a0a0b0',
    marginTop: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6c63ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  searchPlaceholder: {
  color: '#666',
  fontSize: 16,
},
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    paddingHorizontal: 24,
    marginBottom: 16,
    marginTop: 8,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  serviceCard: {
    width: '45%',
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    marginHorizontal: 4,
  },
  serviceIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#a0a0b0',
  },
  popularContainer: {
    paddingLeft: 24,
    marginBottom: 100,
  },
  popularCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 150,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  popularIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  popularName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  popularPrice: {
    fontSize: 12,
    color: '#6c63ff',
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