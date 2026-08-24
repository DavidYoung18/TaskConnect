import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '@/lib/firebase';
import { getCategoryDescriptionKey, getCategoryNameKey } from '@/lib/serviceNames';

const categoryImages: Record<string, ReturnType<typeof require>> = {
  'cleaning':    require('../../assets/icons/cleaning.png'),
  'plumbing':    require('../../assets/icons/construction.png'),
  'electrical':  require('../../assets/icons/electrician.png'),
  'carpet-wash': require('../../assets/icons/washing.png'),
  'tv-mounting': require('../../assets/icons/television.png'),
  'deep-clean':  require('../../assets/icons/window-cleaner.png'),
  'painting':    require('../../assets/icons/varnish.png'),
  'furniture':   require('../../assets/icons/sofa.png'),
  'ac':          require('../../assets/icons/ac.png'),
  'curtain-cleaning': require('../../assets/icons/curtains.png'),
};

interface Category {
  id: string;
  name: string;
  description: string;
}

// Temporarily hidden from customers until providers are onboarded for these categories.
const HIDDEN_CATEGORY_IDS = ['deep-clean', 'painting'];

// Fixed display order for the customer-facing grid. Anything not listed here
// (e.g. a newly added category) falls to the end, sorted by Firestore's default order.
const CATEGORY_ORDER = ['ac', 'electrical', 'plumbing', 'cleaning', 'furniture', 'carpet-wash', 'curtain-cleaning', 'tv-mounting'];

function sortByCategoryOrder<T extends { id: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.id);
    const bi = CATEGORY_ORDER.indexOf(b.id);
    return (ai === -1 ? CATEGORY_ORDER.length : ai) - (bi === -1 ? CATEGORY_ORDER.length : bi);
  });
}

const recentSearches = ['categories.plumbing', 'categories.cleaning', 'categories.electrical'];

export default function SearchScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'categories')).then((snap) => {
      setCategories(
        snap.docs
          .map((d) => ({
            id: d.id,
            name: d.data().name as string,
            description: d.data().description as string,
          }))
          .filter((c) => !HIDDEN_CATEGORY_IDS.includes(c.id))
      );
      setLoading(false);
    });
  }, []);

  function categoryName(category: Category): string {
    const key = getCategoryNameKey(category.id);
    return key ? t(key) : category.name;
  }

  function categoryDescription(category: Category): string {
    const key = getCategoryDescriptionKey(category.id);
    return key ? t(key) : category.description;
  }

  const filteredCategories = sortByCategoryOrder(query.trim() === ''
    ? categories
    : categories.filter((c) =>
        categoryName(c).toLowerCase().includes(query.toLowerCase()) ||
        categoryDescription(c).toLowerCase().includes(query.toLowerCase())
      ));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()}>
          <Ionicons name="arrow-back" size={22} color="#000000" style={{ marginBottom: 16 }} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#999999" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.searchPlaceholder') ?? undefined}
            placeholderTextColor="#999999"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#cccccc" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {query.trim() === '' && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>{t('searchScreen.recentSearches')}</Text>
            <View style={styles.recentTags}>
              {recentSearches.map((termKey, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.recentTag}
                  onPress={() => setQuery(t(termKey))}
                >
                  <Ionicons name="time-outline" size={14} color="#666666" />
                  <Text style={styles.recentTagText}>{t(termKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>
            {query.trim() === '' ? t('searchScreen.allServices') : `${t('searchScreen.resultsForPrefix')} "${query}"`}
          </Text>

          {loading ? (
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          ) : filteredCategories.length === 0 ? (
            <View style={styles.noResults}>
              <Ionicons name="search" size={48} color="#cccccc" />
              <Text style={styles.noResultsText}>{t('searchScreen.noServicesFound')}</Text>
              <Text style={styles.noResultsSubtext}>{t('searchScreen.trySearchingElse')}</Text>
            </View>
          ) : (
            filteredCategories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.resultCard}
                onPress={() =>
                  category.id === 'cleaning'
                    ? router.push('/cleaning-filters')
                    : category.id === 'tv-mounting'
                      ? router.push('/tv-filters')
                      : router.push(`/provider-list?categoryId=${category.id}`)
                }
                activeOpacity={0.7}
              >
                {categoryImages[category.id] ? (
                  <Image
                    source={categoryImages[category.id]}
                    style={styles.resultImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.resultImagePlaceholder} />
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={1}>{categoryName(category)}</Text>
                  {/* numberOfLines={1} on both — a 2-line description (e.g. ru "Ремонт,
                      установка и замена кондиционеров") was making that one card taller
                      than its neighbors, so "same size frame" wasn't actually true row
                      to row even before this round's resize. */}
                  <Text style={styles.resultDescription} numberOfLines={1}>{categoryDescription(category)}</Text>
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
  loadingText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    paddingVertical: 48,
  },
  // Background moved off pure white (was '#ffffff', same as the page behind it,
  // which is the actual thing making rows hard to tell apart) to the app's
  // established muted-surface tone instead — same '#f5f5f5' already used for the
  // search bar and profile stat tiles, not a new one-off color.
  // height is fixed, not derived from padding + icon size — that derivation is
  // exactly what kept making this card taller every time the icon grew even a
  // little. Icon size can change independently now without moving this number.
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 76,
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  resultImage: {
    width: 66,
    height: 66,
    marginRight: 14,
  },
  resultImagePlaceholder: {
    width: 66,
    height: 66,
    marginRight: 14,
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
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
