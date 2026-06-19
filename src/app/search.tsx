import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const allServices = [
  { id: 1, name: 'Cleaning', image: require('../../assets/icons/cleaning.png'), description: 'Home & office cleaning' },
  { id: 2, name: 'Plumbing', image: require('../../assets/icons/construction.png'), description: 'Pipes, faucets & more' },
  { id: 3, name: 'Electrical', image: require('../../assets/icons/electrician.png'), description: 'Wiring & installations' },
  { id: 4, name: 'Carpet Wash', image: require('../../assets/icons/washing.png'), description: 'Deep carpet cleaning' },
  { id: 5, name: 'TV Mounting', image: require('../../assets/icons/television.png'), description: 'TV & shelf mounting' },
  { id: 6, name: 'Deep Clean', image: require('../../assets/icons/window-cleaner.png'), description: 'Full deep cleaning' },
  { id: 7, name: 'Painting', image: require('../../assets/icons/varnish.png'), description: 'Wall & room painting' },
  { id: 8, name: 'Furniture', image: require('../../assets/icons/sofa.png'), description: 'Assembly & repair' },
];

const recentSearches = ['Plumbing', 'Cleaning', 'Electrical'];

export default function SearchScreen() {
  const [query, setQuery] = useState('');

  const filteredServices = query.trim() === '' 
    ? allServices 
    : allServices.filter((service) => 
        service.name.toLowerCase().includes(query.toLowerCase()) ||
        service.description.toLowerCase().includes(query.toLowerCase())
      );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#000000" style={{ marginBottom: 16 }} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#999999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a service..."
            placeholderTextColor="#999999"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {query.trim() === '' && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            <View style={styles.recentTags}>
              {recentSearches.map((term, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.recentTag}
                  onPress={() => setQuery(term)}
                >
                  <Ionicons name="time-outline" size={14} color="#666666" />
                  <Text style={styles.recentTagText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>
            {query.trim() === '' ? 'All Services' : `Results for "${query}"`}
          </Text>
          
          {filteredServices.length === 0 ? (
            <View style={styles.noResults}>
              <Ionicons name="search" size={48} color="#cccccc" />
              <Text style={styles.noResultsText}>No services found</Text>
              <Text style={styles.noResultsSubtext}>Try searching for something else</Text>
            </View>
          ) : (
            filteredServices.map((service) => (
              <TouchableOpacity 
                key={service.id} 
                style={styles.resultCard}
                onPress={() => router.push({ pathname: '/providers', params: { service: service.name } })}
              >
                <Image source={service.image} style={styles.resultImage} resizeMode="contain" />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{service.name}</Text>
                  <Text style={styles.resultDescription}>{service.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999999" />
              </TouchableOpacity>
            ))
          )}
        </View>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  searchInput: {
    flex: 1,
    color: '#000000',
    fontSize: 16,
  },
  recentSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  recentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  recentTagText: {
    color: '#444444',
    fontSize: 13,
  },
  resultsSection: {
    paddingHorizontal: 24,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  resultImage: {
    width: 44,
    height: 44,
    marginRight: 14,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  resultDescription: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  noResultsSubtext: {
    color: '#999999',
    fontSize: 13,
    marginTop: 4,
  },
});