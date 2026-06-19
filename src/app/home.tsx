import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const services = [
  { id: 1, name: 'Cleaning', image: require('../../assets/icons/cleaning.png'), description: 'Home & office cleaning' },
  { id: 2, name: 'Plumbing', image: require('../../assets/icons/construction.png'), description: 'Pipes, faucets & more' },
  { id: 3, name: 'Electrical', image: require('../../assets/icons/electrician.png'), description: 'Wiring & installations' },
  { id: 4, name: 'Carpet Wash', image: require('../../assets/icons/washing.png'), description: 'Deep carpet cleaning' },
  { id: 5, name: 'TV Mounting', image: require('../../assets/icons/television.png'), description: 'TV & shelf mounting' },
  { id: 6, name: 'Deep Clean', image: require('../../assets/icons/window-cleaner.png'), description: 'Full deep cleaning' },
  { id: 7, name: 'Painting', image: require('../../assets/icons/varnish.png'), description: 'Wall & room painting' },
  { id: 8, name: 'Furniture', image: require('../../assets/icons/sofa.png'), description: 'Assembly & repair' },
];

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="#000000" />
            <Text style={styles.location}>Tashkent, Uzbekistan</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
          <Text style={styles.profileText}>D</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.searchContainer} onPress={() => router.push('/search')}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={18} color="#999999" />
          <Text style={styles.searchPlaceholder}>Search for a service...</Text>
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
              <Image source={service.image} style={styles.serviceIconImage} resizeMode="contain" />
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceDescription}>{service.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Popular Services</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularContainer}>
          {services.slice(0, 4).map((service) => (
            <TouchableOpacity 
              key={service.id} 
              style={styles.popularCard}
              onPress={() => router.push({ pathname: '/providers', params: { service: service.name } })}
            >
              <Image source={service.image} style={styles.popularIconImage} resizeMode="contain" />
              <Text style={styles.popularName}>{service.name}</Text>
              <Text style={styles.popularPrice}>From 50,000 UZS</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={22} color="#000000" />
          <Text style={styles.navLabelActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/search')}>
          <Ionicons name="search-outline" size={22} color="#999999" />
          <Text style={styles.navLabel}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/bookings')}>
          <Ionicons name="receipt-outline" size={22} color="#999999" />
          <Text style={styles.navLabel}>Bookings</Text>
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
    color: '#000000',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  location: {
    fontSize: 14,
    color: '#666666',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000000',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  searchPlaceholder: {
    color: '#999999',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    marginHorizontal: 4,
    alignItems: 'center',
  },
  serviceIconImage: {
    width: 64,
    height: 64,
    marginBottom: 10,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
  },
  popularContainer: {
    paddingLeft: 24,
    marginBottom: 100,
  },
  popularCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 150,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    alignItems: 'center',
  },
  popularIconImage: {
    width: 48,
    height: 48,
    marginBottom: 10,
  },
  popularName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  popularPrice: {
    fontSize: 12,
    color: '#666666',
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