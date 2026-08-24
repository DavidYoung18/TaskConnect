import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '@/lib/firebase';
import { getCategoryNameKey } from '@/lib/serviceNames';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import GlassSurface from '@/components/GlassSurface';
import Card from '@/components/ui/Card';

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

// Real lifestyle photos for the "Popular Services" feed below the icon grid — David's
// own photo set (assets/images/services), one per category, deliberately separate
// from categoryImages above (those are small icon glyphs; these are full photos).
const popularServiceImages: Record<string, ReturnType<typeof require>> = {
  'ac':               require('../../assets/images/services/ac.jpg'),
  'electrical':       require('../../assets/images/services/electrical.jpg'),
  'plumbing':         require('../../assets/images/services/plumbing.jpg'),
  'cleaning':         require('../../assets/images/services/cleaning.jpg'),
  'furniture':        require('../../assets/images/services/furniture.jpg'),
  'carpet-wash':      require('../../assets/images/services/carpet.jpg'),
  'curtain-cleaning': require('../../assets/images/services/curtain.jpg'),
  'tv-mounting':      require('../../assets/images/services/tv-mounting.jpg'),
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

export default function HomeScreen() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);

  function categoryName(category: Category): string {
    const key = getCategoryNameKey(category.id);
    return key ? t(key) : category.name;
  }

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
    });
  }, []);

  const orderedCategories = sortByCategoryOrder(categories);

  function navigateToCategory(categoryId: string) {
    if (categoryId === 'cleaning') router.push('/cleaning-filters');
    else if (categoryId === 'tv-mounting') router.push('/tv-filters');
    else router.push(`/provider-list?categoryId=${categoryId}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('home.greeting')}</Text>
          <TouchableOpacity style={styles.locationRow} onPress={() => router.push('/addresses')}>
            <Ionicons name="location" size={14} color="#000000" />
            <Text style={styles.location}>{t('home.defaultLocation')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
          <Text style={styles.profileText}>D</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.searchContainer} onPress={() => router.push('/search')}>
        <Card muted style={styles.searchInput}>
          <Ionicons name="search" size={18} color="#999999" />
          <Text style={styles.searchPlaceholder}>{t('home.searchPlaceholder')}</Text>
        </Card>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t('home.ourServices')}</Text>
        <View style={styles.servicesGrid}>
          {orderedCategories.map((category) => {
            const name = categoryName(category);
            // Each word gets its OWN <Text numberOfLines={1} adjustsFontSizeToFit> instead
            // of one multi-line Text with numberOfLines={wordCount}. That single-Text
            // approach had a real bug: when a word alone doesn't fit the tile's width even
            // at 100% scale (e.g. ru "Генеральная", ~83px, vs. ~78px available), RN's
            // native layout can satisfy the "fits within numberOfLines lines" check by
            // falling back to a character-level break of that word across the 2 available
            // lines — and once that (word-broken) layout already satisfies the fit check,
            // adjustsFontSizeToFit never has a reason to shrink, so the word stays broken
            // at 100% scale. This never showed up on single-word names because with
            // numberOfLines={1} there's no second line to "fit" a broken word onto, so
            // shrinking is the ONLY way to satisfy the check — it engages reliably. Giving
            // every word its own numberOfLines={1} Text forces that same reliable path for
            // every word, always. Trade-off: multi-word names now always stack one word per
            // line, even ones that would fit combined on one line (e.g. "Carpet Wash") —
            // an explicitly allowed outcome per spec ("may wrap one word per line").
            const words = name.trim().split(/\s+/);
            return (
            <TouchableOpacity
              key={category.id}
              style={styles.serviceCard}
              onPress={() => navigateToCategory(category.id)}
            >
              <View style={styles.iconFrame}>
                <Image
                  source={categoryImages[category.id]}
                  style={styles.serviceIconImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.serviceNameContainer}>
                {words.map((word, index) => (
                  <Text
                    key={index}
                    style={styles.serviceName}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                  >
                    {word}
                  </Text>
                ))}
              </View>
              <Text style={styles.serviceDescription}>{category.description}</Text>
            </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{t('home.popularServices')}</Text>
        <View style={styles.popularFeed}>
          {orderedCategories
            .filter((category) => popularServiceImages[category.id])
            .map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.popularFeedCard}
                onPress={() => navigateToCategory(category.id)}
                activeOpacity={0.9}
              >
                <View style={styles.popularFeedImageWrap}>
                  <Image
                    source={popularServiceImages[category.id]}
                    style={styles.popularFeedImage}
                    contentFit="cover"
                  />
                  {/* Darkens just the top band so the name stays readable regardless of
                      what's actually behind it in that particular photo — a fixed
                      per-photo "darken this corner" edit can't account for every image,
                      a scrim that's always there can. Clipped to the wrap's own rounded
                      top corners by the wrap's overflow:'hidden', no separate radius
                      needed here. */}
                  <LinearGradient
                    colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
                    style={styles.popularFeedTopScrim}
                    pointerEvents="none"
                  />
                  <Text style={styles.popularFeedName} numberOfLines={1}>
                    {categoryName(category)}
                  </Text>
                  {/* Purely visual — the whole card above is already one tap target,
                      so this doesn't need its own onPress/touchable wrapper. */}
                  <GlassSurface
                    style={styles.bookNowPill}
                    isInteractive={false}
                    tintColor="#ffffff"
                    colorScheme="light"
                  >
                    {/* tintColor washes over real Liquid Glass's refraction but doesn't
                        replace it — a strongly saturated photo behind the pill (e.g.
                        bright yellow rubber gloves on the Уборка card) still bled
                        through as a visible tint even with tintColor="#ffffff" set.
                        This extra ~60%-opaque white layer sits between the glass and
                        the text, muting that bleed-through consistently on every card
                        while still leaving enough translucency to read as glass rather
                        than a flat sticker. */}
                    <View style={styles.bookNowBacking} />
                    <Text style={styles.bookNowText}>{t('home.bookNow')}</Text>
                  </GlassSurface>
                </View>
              </TouchableOpacity>
            ))}
        </View>
      </ScrollView>

      <CustomerBottomNav activeTab="home" />
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
  // Card (muted) supplies background/border/radius — layout + the slightly
  // tighter padding (14 vs Card's default 16) live here as overrides.
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
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
  // justifyContent added — 4 columns at 23% width + 3×6 gap don't quite add up to
  // 100% of the row (by design, so there's slack rather than risking overflow), and
  // with the default flex-start alignment that leftover slack was all collecting on
  // the right edge only — first icon flush left, last icon not flush right. This
  // distributes it evenly across the gaps instead, so both edges end up flush.
  servicesGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  paddingHorizontal: 12,
  gap: 6,
  marginBottom: 24,
},
serviceCard: {
  width: '23%',
  paddingHorizontal: 2,
  alignItems: 'center',
},
iconFrame: {
  // Width sized against the narrowest supported device (iPhone SE, 375pt wide): with
  // this grid's paddingHorizontal:12 + gap:6 + serviceCard's own paddingHorizontal:2,
  // each of the 4 columns has ~77pt to work with — 76 is as large as this frame can
  // go without wrapping to a 5th row on that device.
  width: 76,
  height: 70,
  borderRadius: 8,
  backgroundColor: '#f5f5f5',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 8,
},
serviceIconImage: {
  width: 70,
  height: 70,
},
serviceNameContainer: {
  width: '100%',
  alignItems: 'center',
},
serviceName: {
  width: '100%',
  fontFamily: 'Nunito_600SemiBold',
  fontSize: 13,
  color: '#000000',
  textAlign: 'center',
  lineHeight: 16,
},
serviceDescription: {
  display: 'none',
},
  // Vertical feed, one full-width photo per category — scrolls with the rest of the
  // page (no nested horizontal ScrollView anymore), Instagram-feed style per request.
  popularFeed: {
    paddingHorizontal: 24,
    gap: 20,
    marginBottom: 100,
  },
  popularFeedCard: {
    width: '100%',
  },
  // The image's own size/shape moved here so the scrim, name, and Book Now pill can
  // all be absolutely positioned against this same box, on top of the image,
  // without affecting the image's own layout.
  popularFeedImageWrap: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  popularFeedImage: {
    width: '100%',
    height: '100%',
  },
  popularFeedTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
  },
  bookNowPill: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 100,
    overflow: 'hidden',
  },
  bookNowBacking: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  bookNowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  // Sits over the gradient scrim now, not below the photo — white text needs the
  // scrim behind it (above) to stay readable no matter what's in the photo there.
  popularFeedName: {
    position: 'absolute',
    top: 14,
    right: 14,
    left: 14,
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'right',
  },
});