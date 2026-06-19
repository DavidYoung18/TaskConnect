import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const allServices = [
  { id: 1, name: 'Cleaning', icon: '🧹', description: 'Home & office cleaning' },
  { id: 2, name: 'Plumbing', icon: '🔧', description: 'Pipes, faucets & more' },
  { id: 3, name: 'Electrical', icon: '⚡', description: 'Wiring & installations' },
  { id: 4, name: 'Carpet Wash', icon: '🪣', description: 'Deep carpet cleaning' },
  { id: 5, name: 'TV Mounting', icon: '📺', description: 'TV & shelf mounting' },
  { id: 6, name: 'Deep Clean', icon: '✨', description: 'Full deep cleaning' },
  { id: 7, name: 'Painting', icon: '🎨', description: 'Wall & room painting' },
  { id: 8, name: 'Furniture', icon: '🛋️', description: 'Assembly & repair' },
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
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a service..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
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
                  <Text style={styles.recentTagText}>🕐 {term}</Text>
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
              <Text style={styles.noResultsIcon}>🔍</Text>
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
                <Text style={styles.resultIcon}>{service.icon}</Text>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{service.name}</Text>
                  <Text style={styles.resultDescription}>{service.description}</Text>
                </View>
                <Text style={styles.resultArrow}>›</Text>
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
  searchInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  recentSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  recentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recentTag: {
    backgroundColor: '#16213e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  recentTagText: {
    color: '#c0c0d0',
    fontSize: 13,
  },
  resultsSection: {
    paddingHorizontal: 24,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  resultIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  resultDescription: {
    fontSize: 12,
    color: '#a0a0b0',
    marginTop: 2,
  },
  resultArrow: {
    color: '#a0a0b0',
    fontSize: 22,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noResultsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  noResultsSubtext: {
    color: '#a0a0b0',
    fontSize: 13,
    marginTop: 4,
  },
});