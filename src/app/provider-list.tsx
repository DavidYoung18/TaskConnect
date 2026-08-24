import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCategoryNameKey } from '@/lib/serviceNames';
import { CleaningFilters, ProviderListing, getProvidersForCategory } from '@/lib/providers';

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ProviderListScreen() {
  const { t } = useTranslation();
  const {
    categoryId, spaceType, squareMeters, roomCount, bathroomCount, cleaningType,
    cleanersRequested, addressId, date, tvCount, wallMaterial,
  } = useLocalSearchParams<{
    categoryId: string;
    spaceType?: string;
    squareMeters?: string;
    roomCount?: string;
    bathroomCount?: string;
    cleaningType?: string;
    cleanersRequested?: string;
    addressId?: string;
    date?: string;
    tvCount?: string;
    wallMaterial?: string;
  }>();

  const [rawCategoryName, setRawCategoryName] = useState('');
  const [providers, setProviders] = useState<ProviderListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryId) return;
    loadData();
  }, [categoryId]);

  async function loadData() {
    const filters: CleaningFilters = {
      cleanersRequested: cleanersRequested ? Number(cleanersRequested) : undefined,
      date,
    };
    const [categorySnap, providerList] = await Promise.all([
      getDoc(doc(db, 'categories', categoryId)),
      getProvidersForCategory(categoryId, filters),
    ]);

    setRawCategoryName(categorySnap.exists() ? (categorySnap.data().name as string) : categoryId);
    setProviders(providerList);
    setLoading(false);
  }

  const categoryNameKey = getCategoryNameKey(categoryId);
  const categoryName = categoryNameKey ? t(categoryNameKey) : rawCategoryName;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{categoryName || '…'}</Text>
          {!loading && (
            <Text style={styles.subtitle}>
              {providers.length === 0
                ? t('provider.noProvidersYet')
                : t('provider.providersAvailable', { count: providers.length })}
            </Text>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading && <Text style={styles.emptyText}>{t('common.loading')}</Text>}

        {!loading && providers.length === 0 && (
          <Text style={styles.emptyText}>{t('provider.noProvidersForCategory')}</Text>
        )}

        {providers.map((provider, index) => (
          <TouchableOpacity
            key={provider.uid}
            style={[styles.row, index < providers.length - 1 && styles.rowBorder]}
            onPress={() => {
              const params = [`providerId=${provider.uid}`, `categoryId=${categoryId}`];
              if (spaceType) params.push(`spaceType=${spaceType}`);
              if (squareMeters) params.push(`squareMeters=${squareMeters}`);
              if (roomCount) params.push(`roomCount=${roomCount}`);
              if (bathroomCount) params.push(`bathroomCount=${bathroomCount}`);
              if (cleaningType) params.push(`cleaningType=${cleaningType}`);
              if (cleanersRequested) params.push(`cleanersRequested=${cleanersRequested}`);
              if (addressId) params.push(`addressId=${addressId}`);
              if (date) params.push(`date=${date}`);
              if (tvCount) params.push(`tvCount=${tvCount}`);
              if (wallMaterial) params.push(`wallMaterial=${wallMaterial}`);
              router.push(`/provider-profile-view?${params.join('&')}`);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              {provider.photoURL ? (
                <Image source={{ uri: provider.photoURL }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>{initials(provider.name)}</Text>
              )}
            </View>

            <View style={styles.info}>
              <Text style={styles.name}>{provider.name}</Text>
              {provider.reviewCount === 0 ? (
                <Text style={styles.noReviews} numberOfLines={1}>{t('provider.noReviewsYet')}</Text>
              ) : (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={12} color="#F5A623" style={styles.ratingIcon} />
                  <Text style={styles.ratingValue}>{provider.averageRating.toFixed(1)}</Text>
                  <Text style={styles.ratingCount} numberOfLines={1}>
                    {t('provider.reviewsCount', { count: provider.reviewCount })}
                  </Text>
                </View>
              )}
              <Text style={styles.jobs} numberOfLines={1}>
                {provider.jobsCompleted === 0
                  ? t('provider.newProvider')
                  : t('provider.jobsCompleted', { count: provider.jobsCompleted })}
              </Text>
            </View>

            <View style={styles.rateBlock}>
              {provider.cleaningRate != null ? (
                <View style={styles.rateTextBlock}>
                  <Text style={styles.rate}>
                    {provider.cleaningRate.toLocaleString('en-US')} {t('common.currency')}
                  </Text>
                  <Text style={styles.rateSub}>{t('cleaningIntake.perCleanerSuffix')}</Text>
                  {provider.staffCount != null && (
                    <Text style={styles.rateSub}>
                      {t('provider.staffCountBadge', { count: provider.staffCount })}
                    </Text>
                  )}
                </View>
              ) : provider.curtainRatePerSqm != null ? (
                <Text style={styles.rate}>
                  {provider.curtainRatePerSqm.toLocaleString('en-US')} {t('common.currency')}/m²
                </Text>
              ) : provider.carpetRatePerSqm != null ? (
                <Text style={styles.rate}>
                  {provider.carpetRatePerSqm.toLocaleString('en-US')} {t('common.currency')}/m²
                </Text>
              ) : provider.hourlyRate != null ? (
                <Text style={styles.rate}>
                  {provider.hourlyRate.toLocaleString('en-US')} {t('common.currency')}{t('common.perHour')}
                </Text>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color="#cccccc" style={styles.chevron} />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    gap: 14,
  },
  backButton: {
    padding: 2,
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  subtitle: {
    fontSize: 13,
    color: '#999999',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 3,
  },
  ratingIcon: {
    flexShrink: 0,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    flexShrink: 0,
  },
  ratingCount: {
    fontSize: 13,
    color: '#999999',
    flexShrink: 1,
  },
  noReviews: {
    fontSize: 13,
    color: '#bbbbbb',
  },
  rateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  rateTextBlock: {
    alignItems: 'flex-end',
    gap: 1,
  },
  rateSub: {
    fontSize: 11,
    color: '#999999',
    textAlign: 'right',
  },
  rate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'right',
  },
  jobs: {
    fontSize: 12,
    color: '#999999',
  },
  chevron: {
    marginLeft: 2,
  },
});
