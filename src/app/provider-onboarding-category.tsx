import { collection, getDocs } from 'firebase/firestore';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/lib/firebase';
import { getCategoryNameKey } from '@/lib/serviceNames';

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
  hasHourlyOption: boolean;
  subServices: { id: string; name: string }[];
}

// Temporarily hidden until providers are onboarded for these categories — matches
// the same hide-list on the customer side (home.tsx, search.tsx).
const HIDDEN_CATEGORY_IDS = ['deep-clean', 'painting'];

export default function ProviderOnboardingCategoryScreen() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'categories')).then((snap) => {
      setCategories(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
          .filter((c) => !HIDDEN_CATEGORY_IDS.includes(c.id))
      );
      setLoading(false);
    });
  }, []);

  function categoryName(category: Category): string {
    const key = getCategoryNameKey(category.id);
    return key ? t(key) : category.name;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() && router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>What service do you provide?</Text>
        <Text style={styles.subtitle}>Select your category</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {loading && <Text style={styles.emptyText}>Loading categories...</Text>}
        {!loading && categories.length === 0 && (
          <Text style={styles.emptyText}>No categories available.</Text>
        )}
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.card}
            onPress={() =>
              category.id === 'cleaning'
                ? router.push(`/provider-onboarding-cleaning?categoryId=${category.id}`)
                : category.id === 'ac'
                  ? router.push(`/provider-onboarding-ac?categoryId=${category.id}`)
                  : category.id === 'curtain-cleaning'
                    ? router.push(`/provider-onboarding-curtain?categoryId=${category.id}`)
                    : category.id === 'carpet-wash'
                      ? router.push(`/provider-onboarding-carpet?categoryId=${category.id}`)
                      : category.id === 'tv-mounting'
                        ? router.push(`/provider-onboarding-tv?categoryId=${category.id}`)
                        : router.push(`/provider-onboarding-services?categoryId=${category.id}`)
            }
            activeOpacity={0.7}
          >
            <Image
              source={categoryImages[category.id]}
              style={styles.categoryIcon}
              resizeMode="contain"
            />
            <View style={styles.cardText}>
              <Text style={styles.categoryName}>{categoryName(category)}</Text>
              {category.id !== 'cleaning' && (
                <Text style={styles.categoryMeta}>
                  {category.subServices?.length ?? 0} services available
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
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
    paddingBottom: 24,
  },
  backButton: {
    padding: 2,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
  },
  list: {
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#999999',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  categoryIcon: {
    width: 44,
    height: 44,
  },
  cardText: {
    flex: 1,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  categoryMeta: {
    fontSize: 13,
    color: '#666666',
  },
});
