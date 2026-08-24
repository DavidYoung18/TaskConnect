import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProviderService, Review, getJobsCompleted, getProviderRatingSummary, getProviderRecentReviews } from '@/lib/providers';
import { DayAvailability, getWeekAvailability } from '@/lib/availability';
import { getSubServiceNameKey, getSpaceTypeKey, getCleaningTypeKey, getToolsOptionShortKey, getBathroomCountLabel } from '@/lib/serviceNames';
import { formatRelativeTime } from '@/lib/dateFormat';
import FullScreenImageViewer from '@/components/FullScreenImageViewer';
import SlotPickerModal, { SlotPickerResult } from '@/components/SlotPickerModal';

// ── Display helpers ────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatServicePrice(service: ProviderService, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const currency = t('common.currency');
  if (service.type === 'hourly') {
    return `${(service.hourlyRate ?? 0).toLocaleString('en-US')} ${currency}${t('common.perHour')}`;
  }
  if (service.type === 'cleaning-company') {
    return t('common.fromPricePrefix', { price: `${(service.rateWithoutTools ?? 0).toLocaleString('en-US')} ${currency}` });
  }
  return `${(service.price ?? 0).toLocaleString('en-US')} ${currency}`;
}

// ── Service icons ─────────────────────────────────────────────────────────────

type ServiceIconSpec =
  | { lib: 'ionicons'; name: React.ComponentProps<typeof Ionicons>['name'] }
  | { lib: 'mci'; name: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };

const SUB_SERVICE_ICONS: Record<string, ServiceIconSpec> = {
  'blockage-drainage-removal':     { lib: 'mci',      name: 'pipe-leak' },
  'leakage-repair':                { lib: 'ionicons', name: 'water' },
  'toilet-repair-installation':    { lib: 'mci',      name: 'toilet' },
  'tap-mixer-repair-installation': { lib: 'mci',      name: 'faucet' },
  'jet-spray-installation':        { lib: 'mci',      name: 'shower-head' },
  'geyser-installation':           { lib: 'mci',      name: 'water-boiler' },
  'ac-repair':                     { lib: 'ionicons', name: 'construct-outline' },
  'ac-installation':               { lib: 'ionicons', name: 'build-outline' },
  'ac-replacement':                { lib: 'ionicons', name: 'swap-horizontal-outline' },
  'tv-32':                         { lib: 'ionicons', name: 'tv-outline' },
  'tv-43':                         { lib: 'ionicons', name: 'tv-outline' },
  'tv-55':                         { lib: 'ionicons', name: 'tv-outline' },
  'tv-65':                         { lib: 'ionicons', name: 'tv-outline' },
  'tv-75':                         { lib: 'ionicons', name: 'tv-outline' },
  'tv-85':                         { lib: 'ionicons', name: 'tv-outline' },
  'tv-100':                        { lib: 'ionicons', name: 'tv-outline' },
};

// Smallest-to-largest — matches TV_SIZE_OPTIONS in provider-onboarding-tv.tsx.
const TV_SIZE_ORDER = ['tv-32', 'tv-43', 'tv-55', 'tv-65', 'tv-75', 'tv-85', 'tv-100'];

function ServiceRowIcon({
  subServiceId,
  type,
  selected,
}: {
  subServiceId?: string;
  type: string;
  selected: boolean;
}) {
  const color = selected ? '#000000' : '#aaaaaa';
  if (type === 'hourly') {
    return <Ionicons name="time-outline" size={22} color={color} />;
  }
  const spec = subServiceId ? SUB_SERVICE_ICONS[subServiceId] : undefined;
  if (!spec) return null;
  if (spec.lib === 'mci') {
    return <MaterialCommunityIcons name={spec.name} size={22} color={color} />;
  }
  return <Ionicons name={spec.name} size={22} color={color} />;
}

// ── Stable service key ────────────────────────────────────────────────────────

function serviceKey(s: ProviderService): string {
  return s.subServiceId ?? s.type;
}

function serviceName(s: ProviderService, t: (key: string) => string): string {
  const key = s.subServiceId ? getSubServiceNameKey(s.subServiceId) : undefined;
  return key ? t(key) : s.name;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProviderProfileViewScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    providerId, categoryId, spaceType, squareMeters, roomCount, bathroomCount,
    cleaningType, cleanersRequested, addressId, date, tvCount, wallMaterial,
  } = useLocalSearchParams<{
    providerId: string;
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

  const isCleaning = categoryId === 'cleaning';
  const isCurtainCleaning = categoryId === 'curtain-cleaning';
  // Carpet cleaning is a company like cleaning/curtain-cleaning, priced per square
  // meter exactly like curtain cleaning — multiple teams can serve different customers
  // at the same time, so a booked slot should never block other customers from booking
  // that same time (see checkConflicts on the shared SlotPickerModal below).
  const isCarpetWash = categoryId === 'carpet-wash';
  // TV mounting can involve more than one TV (tvCount, chosen during intake) — the
  // customer assigns a size to each TV via a quantity stepper per size, rather than
  // the single-select "pick one service" flow every other per-job category uses.
  const isTvMounting = categoryId === 'tv-mounting';

  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  // Captured here now, not during intake — every company sets both rate tiers at
  // onboarding, so this was never a filter, just which price to display/charge.
  // Defaults to the cheaper tier.
  const [toolsOption, setToolsOption] = useState<'customer-provides' | 'company-provides'>('customer-provides');
  const [services, setServices] = useState<ProviderService[]>([]);
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({});
  const [loading, setLoading] = useState(true);

  // Service selection
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // TV mounting — sizeId (serviceKey) → how many TVs of that size, so a customer
  // booking 3 TVs can assign a different size to each (or the same size 3 times via
  // the stepper) instead of being limited to picking a single overall service.
  const [tvSizeCounts, setTvSizeCounts] = useState<Record<string, number>>({});

  // Schedule modal
  const [showBooking, setShowBooking] = useState(false);

  // Curtain cleaning — customer enters how many square meters of curtain need
  // cleaning; the company's rate is per square meter, so total is derived here.
  const [curtainSquareMeters, setCurtainSquareMeters] = useState('');

  // Carpet cleaning — same per-square-meter model as curtain cleaning above.
  const [carpetSquareMeters, setCarpetSquareMeters] = useState('');

  useEffect(() => {
    if (!providerId || !categoryId) return;
    loadData();
  }, [providerId, categoryId]);

  // The default RN "scroll focused input above keyboard" behavior leaves no buffer —
  // the field's edge ends up flush against the keyboard. Once the keyboard has finished
  // animating in, nudge further so there's clear space above it (clamped harmlessly to
  // the end of the content by ScrollView if it overshoots).
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  async function loadData() {
    try {
      const [userSnap, servicesSnap, jobs, avail] = await Promise.all([
        getDoc(doc(db, 'users', providerId)),
        getDocs(
          query(
            collection(db, 'users', providerId, 'providerServices'),
            where('categoryId', '==', categoryId),
          ),
        ),
        getJobsCompleted(providerId),
        getWeekAvailability(providerId),
      ]);

      const fetchedServices = servicesSnap.docs.map((d) => d.data() as ProviderService);
      const cleaningPkg = fetchedServices.find((s) => s.type === 'cleaning-company');
      const curtainPkg = fetchedServices.find((s) => s.type === 'curtain-company');
      const carpetPkg = fetchedServices.find((s) => s.type === 'carpet-company');
      const userData = userSnap.exists() ? userSnap.data() : undefined;
      // Company-style providers (cleaning, curtain, carpet) display their company name
      // to customers, never the account owner's personal name — every other category
      // still uses the personal name since there's no separate business-name concept.
      // Photo upload isn't cleaning-specific though (see provider/account-details.tsx),
      // so photoURL is shown for any provider that has one, regardless of category.
      const displayName = (cleaningPkg || curtainPkg || carpetPkg ? userData?.companyName : undefined) || userData?.name || '';
      setName(displayName);
      setPhotoURL((userData?.photoURL as string) ?? null);
      // Personal bio — individual providers only (plumbers, electricians, etc.); companies
      // (cleaning, curtain cleaning) show their own company "about" from providerServices
      // instead, rendered separately below.
      setAbout((userData?.about as string) ?? '');
      setServices(fetchedServices);
      setJobsCompleted(jobs);
      setAvailability(avail);

      // Rating summary and reviews are best-effort — they require composite indexes
      // that may not exist yet (check console for index creation links if missing)
      const [ratingSummary, recentReviews] = await Promise.all([
        getProviderRatingSummary(providerId).catch(() => ({ averageRating: 0, reviewCount: 0 })),
        getProviderRecentReviews(providerId).catch(() => [] as Review[]),
      ]);
      setAverageRating(ratingSummary.averageRating);
      setReviewCount(ratingSummary.reviewCount);
      setReviews(recentReviews);
    } finally {
      setLoading(false);
    }
  }

  const selectedService = selectedServiceId
    ? (services.find((s) => serviceKey(s) === selectedServiceId) ?? null)
    : null;

  const cleaningService = isCleaning
    ? (services.find((s) => s.type === 'cleaning-company') ?? null)
    : null;
  const curtainService = isCurtainCleaning
    ? (services.find((s) => s.type === 'curtain-company') ?? null)
    : null;
  const curtainSqmNum = parseFloat(curtainSquareMeters.trim());
  const curtainSqmValid = !isNaN(curtainSqmNum) && curtainSqmNum > 0;
  const curtainTotalPrice = curtainService && curtainSqmValid
    ? (curtainService.ratePerSqm ?? 0) * curtainSqmNum
    : 0;
  const carpetService = isCarpetWash
    ? (services.find((s) => s.type === 'carpet-company') ?? null)
    : null;
  const carpetSqmNum = parseFloat(carpetSquareMeters.trim());
  const carpetSqmValid = !isNaN(carpetSqmNum) && carpetSqmNum > 0;
  const carpetTotalPrice = carpetService && carpetSqmValid
    ? (carpetService.ratePerSqm ?? 0) * carpetSqmNum
    : 0;
  // TV mounting — how many TVs the customer said they have (during intake) vs. how
  // many they've assigned a size to so far via the stepper below.
  const requestedTvCount = tvCount ? Math.max(1, Number(tvCount)) : 1;
  const totalTvSized = Object.values(tvSizeCounts).reduce((sum, n) => sum + n, 0);
  const tvSelectionComplete = isTvMounting && totalTvSized === requestedTvCount;
  const tvTotalPrice = services.reduce(
    (sum, s) => sum + (tvSizeCounts[serviceKey(s)] ?? 0) * (s.price ?? 0),
    0,
  );
  // Firestore returns each provider's size docs in whatever order they happen to be
  // stored, not smallest-to-largest — sort explicitly against the fixed size list
  // instead (same ids TV_SIZE_OPTIONS uses in provider-onboarding-tv.tsx).
  const sortedTvServices = isTvMounting
    ? [...services].sort(
        (a, b) => TV_SIZE_ORDER.indexOf(a.subServiceId ?? '') - TV_SIZE_ORDER.indexOf(b.subServiceId ?? ''),
      )
    : services;
  const cleanersNum = cleanersRequested ? Number(cleanersRequested) : 0;
  const perCleanerRate = cleaningService
    ? (toolsOption === 'company-provides' ? cleaningService.rateWithTools : cleaningService.rateWithoutTools) ?? 0
    : 0;
  const cleaningTotalPrice = perCleanerRate * cleanersNum;
  const spaceTypeKey = spaceType ? getSpaceTypeKey(spaceType) : undefined;
  const spaceTypeLabel = spaceTypeKey ? t(spaceTypeKey) : (spaceType ?? '');
  const cleaningTypeKey = cleaningType ? getCleaningTypeKey(cleaningType) : undefined;
  const cleaningTypeLabel = cleaningTypeKey ? t(cleaningTypeKey) : (cleaningType ?? '');
  const toolsOptionKey = getToolsOptionShortKey(toolsOption);
  const toolsLabel = toolsOptionKey ? t(toolsOptionKey) : toolsOption;
  const bathroomLabel = bathroomCount ? getBathroomCountLabel(bathroomCount, t) : '';
  const bookDisabled = isCleaning
    ? !cleaningService
    : isCurtainCleaning
      ? !curtainService || !curtainSqmValid
      : isCarpetWash
        ? !carpetService || !carpetSqmValid
        : isTvMounting
          ? !tvSelectionComplete
          : !selectedServiceId;

  function incrementTvSize(key: string) {
    if (totalTvSized >= requestedTvCount) return;
    setTvSizeCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }

  function decrementTvSize(key: string) {
    setTvSizeCounts((prev) => {
      const current = prev[key] ?? 0;
      if (current <= 0) return prev;
      return { ...prev, [key]: current - 1 };
    });
  }

  function openBooking() {
    if (isCleaning) {
      if (!cleaningService) return;
      const params = [
        `providerId=${providerId}`,
        `providerName=${encodeURIComponent(name)}`,
        `categoryId=${categoryId}`,
        `totalPrice=${cleaningTotalPrice}`,
        `spaceType=${spaceType ?? ''}`,
        `squareMeters=${squareMeters ?? ''}`,
        `roomCount=${roomCount ?? ''}`,
        `bathroomCount=${bathroomCount ?? ''}`,
        `cleaningType=${cleaningType ?? ''}`,
        `cleanersRequested=${cleanersRequested ?? ''}`,
        `toolsOption=${toolsOption}`,
        `addressId=${addressId ?? ''}`,
        `date=${date ?? ''}`,
      ];
      router.push(`/booking-review?${params.join('&')}`);
      return;
    }
    if (isCurtainCleaning) {
      if (!curtainService || !curtainSqmValid) return;
      setShowBooking(true);
      return;
    }
    if (isCarpetWash) {
      if (!carpetService || !carpetSqmValid) return;
      setShowBooking(true);
      return;
    }
    if (isTvMounting) {
      if (!tvSelectionComplete) return;
      setShowBooking(true);
      return;
    }
    if (!selectedServiceId) return;
    setShowBooking(true);
  }

  function handleSlotPickerConfirm(result: SlotPickerResult) {
    if (isCurtainCleaning) {
      if (!curtainService || !curtainSqmValid) return;
      const params = [
        `providerId=${providerId}`,
        `providerName=${encodeURIComponent(name)}`,
        `categoryId=${categoryId}`,
        `totalPrice=${curtainTotalPrice}`,
        `squareMeters=${curtainSqmNum}`,
        `date=${result.dateStr}`,
        `time=${result.time}`,
      ];
      setShowBooking(false);
      router.push(`/booking-review?${params.join('&')}`);
      return;
    }

    if (isCarpetWash) {
      if (!carpetService || !carpetSqmValid) return;
      const params = [
        `providerId=${providerId}`,
        `providerName=${encodeURIComponent(name)}`,
        `categoryId=${categoryId}`,
        `totalPrice=${carpetTotalPrice}`,
        `squareMeters=${carpetSqmNum}`,
        `date=${result.dateStr}`,
        `time=${result.time}`,
      ];
      setShowBooking(false);
      router.push(`/booking-review?${params.join('&')}`);
      return;
    }

    if (isTvMounting) {
      if (!tvSelectionComplete) return;
      // Encoded as sizeId:quantity:price triples (price included so booking-review
      // doesn't need an extra Firestore round-trip to reconstruct the breakdown) —
      // simple and URL-safe since none of these values can contain ':' or ','.
      const breakdown = services
        .filter((s) => (tvSizeCounts[serviceKey(s)] ?? 0) > 0)
        .map((s) => `${s.subServiceId}:${tvSizeCounts[serviceKey(s)]}:${s.price ?? 0}`)
        .join(',');
      const params = [
        `providerId=${providerId}`,
        `providerName=${encodeURIComponent(name)}`,
        `categoryId=${categoryId}`,
        `totalPrice=${tvTotalPrice}`,
        `date=${result.dateStr}`,
        `time=${result.time}`,
        `tvSizeBreakdown=${encodeURIComponent(breakdown)}`,
      ];
      if (tvCount) params.push(`tvCount=${tvCount}`);
      if (wallMaterial) params.push(`wallMaterial=${wallMaterial}`);
      setShowBooking(false);
      router.push(`/booking-review?${params.join('&')}`);
      return;
    }

    if (!selectedService) return;

    const isHourly = selectedService.type === 'hourly';
    const hours = result.hours ?? selectedService.minHours ?? 1;
    const totalPrice = isHourly
      ? (selectedService.hourlyRate ?? 0) * hours
      : (selectedService.price ?? 0);

    const params = [
      `providerId=${providerId}`,
      `providerName=${encodeURIComponent(name)}`,
      `categoryId=${categoryId}`,
      `serviceId=${selectedService.subServiceId ?? 'pkg'}`,
      `serviceName=${encodeURIComponent(selectedService.name)}`,
      `date=${result.dateStr}`,
      `time=${result.time}`,
    ];
    params.push(`totalPrice=${totalPrice}`);
    if (isHourly) {
      params.push(`hours=${hours}`);
    }

    setShowBooking(false);
    router.push(`/booking-review?${params.join('&')}`);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Floating back button — overlaid on the scrolling content instead of a
          dedicated header band, so the profile content can start near the top. */}
      <TouchableOpacity
        onPress={() => router.canGoBack() && router.back()}
        style={[styles.floatingBackButton, { top: insets.top + 8 }]}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="#000000" />
      </TouchableOpacity>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
      >
        {loading ? (
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        ) : (
          <>
            {/* Provider identity */}
            <View style={styles.profileSection}>
              <TouchableOpacity
                style={styles.avatar}
                onPress={() => setShowPhotoViewer(true)}
                activeOpacity={0.8}
                disabled={!photoURL}
              >
                {photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarText}>{initials(name)}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.providerName}>{name}</Text>
              <Text style={styles.jobsText}>
                {jobsCompleted === 0
                  ? t('provider.newProvider')
                  : t('provider.jobsCompleted', { count: jobsCompleted })}
              </Text>
              <View style={styles.ratingRow}>
                {reviewCount === 0 ? (
                  <Text style={styles.noReviewsYet}>{t('provider.noReviewsYet')}</Text>
                ) : (
                  <>
                    <Ionicons name="star" size={14} color="#F5A623" />
                    <Text style={styles.ratingValue}>{averageRating.toFixed(1)}</Text>
                    <Text style={styles.ratingCount}>
                      {t('provider.reviewsCount', { count: reviewCount })}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* About — individual providers only; companies show their own company
                "about" inside the cleaning/curtain sections below instead. */}
            {!isCleaning && !isCurtainCleaning && !isCarpetWash && !!about && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('provider.aboutTitle')}</Text>
                <View style={styles.serviceList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.aboutText}>{about}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Services */}
            {isCleaning ? (
              cleaningService && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('provider.companyDetailsTitle')}</Text>
                    <View style={styles.serviceList}>
                      {!!cleaningService.about && (
                        <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                          <Text style={styles.summaryValue}>{cleaningService.about}</Text>
                        </View>
                      )}
                      <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                        <Text style={styles.summaryLabel}>{t('provider.staffCountLabel')}</Text>
                        <Text style={styles.summaryValue}>
                          {t('provider.staffCountBadge', { count: cleaningService.staffCount ?? 0 })}
                        </Text>
                      </View>
                      <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                        <Text style={styles.summaryLabel}>{t('providerOnboarding.rateWithoutToolsLabel')}</Text>
                        <Text style={styles.summaryValue}>
                          {(cleaningService.rateWithoutTools ?? 0).toLocaleString('en-US')} {t('common.currency')} {t('cleaningIntake.perCleanerSuffix')}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('providerOnboarding.rateWithToolsLabel')}</Text>
                        <Text style={styles.summaryValue}>
                          {(cleaningService.rateWithTools ?? 0).toLocaleString('en-US')} {t('common.currency')} {t('cleaningIntake.perCleanerSuffix')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('bookingReviewScreen.propertyDetails')}</Text>
                    <View style={styles.serviceList}>
                      <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                        <Text style={styles.summaryLabel}>{t('labels.property')}</Text>
                        <Text style={styles.summaryValue}>{spaceTypeLabel}</Text>
                      </View>
                      <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                        <Text style={styles.summaryLabel}>{t('cleaningIntake.squareMetersQuestion')}</Text>
                        <Text style={styles.summaryValue}>{squareMeters}</Text>
                      </View>
                      <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                        <Text style={styles.summaryLabel}>{t('cleaningIntake.roomCountQuestion')}</Text>
                        <Text style={styles.summaryValue}>{roomCount}</Text>
                      </View>
                      <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                        <Text style={styles.summaryLabel}>{t('cleaningIntake.bathroomCountQuestion')}</Text>
                        <Text style={styles.summaryValue}>{bathroomLabel}</Text>
                      </View>
                      <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                        <Text style={styles.summaryLabel}>{t('cleaningIntake.cleaningTypeQuestion')}</Text>
                        <Text style={styles.summaryValue}>{cleaningTypeLabel}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('cleaningIntake.cleanersRequestedQuestion')}</Text>
                        <Text style={styles.summaryValue}>{cleanersRequested}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('cleaningIntake.toolsQuestion')}</Text>
                    <View style={styles.serviceList}>
                      <TouchableOpacity
                        style={[styles.summaryRow, styles.serviceRowBorder]}
                        onPress={() => setToolsOption('customer-provides')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.toolsOptionInfo}>
                          <Text style={styles.summaryLabel}>{t('cleaningIntake.customerProvidesToolsShort')}</Text>
                          <Text style={styles.toolsOptionPrice}>
                            {(cleaningService.rateWithoutTools ?? 0).toLocaleString('en-US')} {t('common.currency')} {t('cleaningIntake.perCleanerSuffix')}
                          </Text>
                        </View>
                        {toolsOption === 'customer-provides' && (
                          <Ionicons name="checkmark-circle" size={20} color="#000000" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.summaryRow}
                        onPress={() => setToolsOption('company-provides')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.toolsOptionInfo}>
                          <Text style={styles.summaryLabel}>{t('cleaningIntake.companyProvidesToolsShort')}</Text>
                          <Text style={styles.toolsOptionPrice}>
                            {(cleaningService.rateWithTools ?? 0).toLocaleString('en-US')} {t('common.currency')} {t('cleaningIntake.perCleanerSuffix')}
                          </Text>
                        </View>
                        {toolsOption === 'company-provides' && (
                          <Ionicons name="checkmark-circle" size={20} color="#000000" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('labels.price')}</Text>
                    <View style={styles.serviceList}>
                      {cleanersNum > 0 && (
                        <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                          <Text style={styles.priceBreakdownText}>
                            {t('bookingReviewScreen.priceBreakdownLine', {
                              count: cleanersNum,
                              rate: perCleanerRate.toLocaleString('en-US'),
                              total: cleaningTotalPrice.toLocaleString('en-US'),
                            })}
                          </Text>
                        </View>
                      )}
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('provider.totalPrefix')}</Text>
                        <Text style={styles.summaryValue}>
                          {cleaningTotalPrice.toLocaleString('en-US')} {t('common.currency')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )
            ) : isCurtainCleaning ? (
              curtainService && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('provider.companyDetailsTitle')}</Text>
                    <View style={styles.serviceList}>
                      {!!curtainService.about && (
                        <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                          <Text style={styles.summaryValue}>{curtainService.about}</Text>
                        </View>
                      )}
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('providerOnboarding.curtainRateLabel')}</Text>
                        <Text style={styles.summaryValue}>
                          {(curtainService.ratePerSqm ?? 0).toLocaleString('en-US')} {t('common.currency')}/m²
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('cleaningIntake.squareMetersQuestion')}</Text>
                    <View style={styles.serviceList}>
                      <View style={styles.summaryRow}>
                        <TextInput
                          style={styles.curtainSqmInput}
                          value={curtainSquareMeters}
                          onChangeText={setCurtainSquareMeters}
                          keyboardType="numeric"
                          placeholder={t('common.egValue', { value: 10 })}
                          placeholderTextColor="#999999"
                        />
                      </View>
                    </View>
                  </View>

                  {curtainSqmValid && (
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>{t('labels.price')}</Text>
                      <View style={styles.serviceList}>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>{t('provider.totalPrefix')}</Text>
                          <Text style={styles.summaryValue}>
                            {curtainTotalPrice.toLocaleString('en-US')} {t('common.currency')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )
            ) : isCarpetWash ? (
              carpetService && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('provider.companyDetailsTitle')}</Text>
                    <View style={styles.serviceList}>
                      {!!carpetService.about && (
                        <View style={[styles.summaryRow, styles.serviceRowBorder]}>
                          <Text style={styles.summaryValue}>{carpetService.about}</Text>
                        </View>
                      )}
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('providerOnboarding.carpetRateLabel')}</Text>
                        <Text style={styles.summaryValue}>
                          {(carpetService.ratePerSqm ?? 0).toLocaleString('en-US')} {t('common.currency')}/m²
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('cleaningIntake.squareMetersQuestion')}</Text>
                    <View style={styles.serviceList}>
                      <View style={styles.summaryRow}>
                        <TextInput
                          style={styles.curtainSqmInput}
                          value={carpetSquareMeters}
                          onChangeText={setCarpetSquareMeters}
                          keyboardType="numeric"
                          placeholder={t('common.egValue', { value: 10 })}
                          placeholderTextColor="#999999"
                        />
                      </View>
                    </View>
                  </View>

                  {carpetSqmValid && (
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>{t('labels.price')}</Text>
                      <View style={styles.serviceList}>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>{t('provider.totalPrefix')}</Text>
                          <Text style={styles.summaryValue}>
                            {carpetTotalPrice.toLocaleString('en-US')} {t('common.currency')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )
            ) : isTvMounting ? (
              services.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('tvIntake.chooseSizeTitle')}</Text>
                  <Text style={styles.tvHint}>{t('tvIntake.diagonalHint')}</Text>
                  <Text style={styles.tvProgress}>
                    {t('tvIntake.tvsSizedProgress', { selected: totalTvSized, total: requestedTvCount })}
                  </Text>
                  {sortedTvServices.map((service, index) => {
                    const key = serviceKey(service);
                    const count = tvSizeCounts[key] ?? 0;
                    const atLimit = totalTvSized >= requestedTvCount;
                    return (
                      <View
                        key={`${key}-${index}`}
                        style={[styles.tvSizeCard, count > 0 && styles.tvSizeCardSelected]}
                      >
                        <View style={styles.tvSizeNameGroup}>
                          <ServiceRowIcon
                            subServiceId={service.subServiceId}
                            type={service.type}
                            selected={count > 0}
                          />
                          <Text style={styles.tvSizeName}>{serviceName(service, t)}</Text>
                        </View>
                        <Text style={styles.tvSizePrice} numberOfLines={1}>
                          {formatServicePrice(service, t)}
                        </Text>
                        <View style={styles.stepper}>
                          <TouchableOpacity
                            onPress={() => decrementTvSize(key)}
                            disabled={count === 0}
                            style={styles.stepperButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="remove" size={16} color={count === 0 ? '#cccccc' : '#000000'} />
                          </TouchableOpacity>
                          <Text style={styles.stepperCount}>{count}</Text>
                          <TouchableOpacity
                            onPress={() => incrementTvSize(key)}
                            disabled={atLimit}
                            style={styles.stepperButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="add" size={16} color={atLimit ? '#cccccc' : '#000000'} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            ) : (
              services.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('provider.selectServiceTitle')}</Text>
                  <View style={styles.serviceList}>
                    {services.map((service, index) => {
                      const key = serviceKey(service);
                      const isSelected = selectedServiceId === key;
                      return (
                        <TouchableOpacity
                          key={`${key}-${index}`}
                          style={[
                            styles.serviceRow,
                            index < services.length - 1 && styles.serviceRowBorder,
                            isSelected && styles.serviceRowSelected,
                          ]}
                          onPress={() => setSelectedServiceId(key)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={isSelected ? '#000000' : '#cccccc'}
                          />
                          <ServiceRowIcon
                            subServiceId={service.subServiceId}
                            type={service.type}
                            selected={isSelected}
                          />
                          <View style={styles.serviceNameCol}>
                            <Text style={[styles.serviceName, isSelected && styles.serviceNameSelected]}>
                              {serviceName(service, t)}
                            </Text>
                            {service.type === 'fixed' && service.estimatedDuration != null && (
                              <Text style={styles.serviceDuration}>~{service.estimatedDuration}hr</Text>
                            )}
                          </View>
                          <Text style={[styles.servicePrice, isSelected && styles.servicePriceSelected]}>
                            {formatServicePrice(service, t)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )
            )}

            {/* Reviews */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('provider.reviewsTitle')}</Text>
              {reviews.length === 0 ? (
                <Text style={styles.reviewsEmptyText}>{t('provider.noReviewsYet')}</Text>
              ) : (
                reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewCardHeader}>
                      <Text style={styles.reviewerName}>{review.customerName}</Text>
                      <Text style={styles.reviewDate}>{formatRelativeTime(new Date(review.createdAt), i18n.language, t)}</Text>
                    </View>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Ionicons
                          key={n}
                          name={n <= review.rating ? 'star' : 'star-outline'}
                          size={14}
                          color={n <= review.rating ? '#F5A623' : '#CCCCCC'}
                        />
                      ))}
                    </View>
                    {review.reviewText ? (
                      <Text style={styles.reviewText}>{review.reviewText}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>

            <View style={{ height: 120 }} />
          </>
        )}
      </ScrollView>

      {/* Book Now footer */}
      {!loading && (
        <View style={styles.footer}>
          {!isCleaning && !isCurtainCleaning && !isCarpetWash && !isTvMounting && !selectedServiceId && (
            <Text style={styles.bookHint}>{t('provider.selectServiceToContinue')}</Text>
          )}
          <TouchableOpacity
            style={[styles.bookButton, bookDisabled && styles.bookButtonDisabled]}
            onPress={openBooking}
            disabled={bookDisabled}
            activeOpacity={0.85}
          >
            <Text style={styles.bookButtonText}>{t('booking.bookNow')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scheduling modal */}
      <SlotPickerModal
        visible={showBooking}
        onClose={() => setShowBooking(false)}
        providerId={providerId}
        availability={availability}
        title={name ? `${name} — ${t('provider.scheduleTitle')}` : t('provider.scheduleTitle')}
        confirmLabel={t('provider.selectAndContinue')}
        isHourly={selectedService?.type === 'hourly'}
        minHours={selectedService?.minHours ?? 1}
        maxHours={selectedService?.maxHours ?? 8}
        hourlyRate={selectedService?.hourlyRate ?? 0}
        checkConflicts={!isCurtainCleaning && !isCarpetWash}
        onConfirm={handleSlotPickerConfirm}
      />

      <FullScreenImageViewer
        visible={showPhotoViewer}
        uri={photoURL}
        onClose={() => setShowPhotoViewer(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  floatingBackButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  loadingText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  // Profile section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  providerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  jobsText: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  ratingCount: {
    fontSize: 13,
    color: '#999999',
  },
  noReviewsYet: {
    fontSize: 13,
    color: '#bbbbbb',
  },
  // Services section
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  serviceList: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    overflow: 'hidden',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  serviceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  serviceRowSelected: {
    backgroundColor: '#f8f8f8',
    borderLeftWidth: 3,
    borderLeftColor: '#000000',
  },
  serviceNameCol: {
    flex: 1,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
  },
  serviceNameSelected: {
    fontWeight: '700',
  },
  serviceDuration: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444444',
    flexShrink: 0,
  },
  servicePriceSelected: {
    color: '#000000',
  },
  tvHint: {
    fontSize: 12,
    color: '#999999',
    marginTop: -6,
    marginBottom: 10,
    lineHeight: 17,
  },
  tvProgress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  // Each size is one single-line card: icon+name on the left, price and the
  // stepper sharing the rest via space-between — short labels (just "32"", not
  // "32\" diagonal") mean this comfortably fits on one line without wrapping.
  tvSizeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 10,
  },
  tvSizeCardSelected: {
    borderColor: '#000000',
    backgroundColor: '#f8f8f8',
  },
  tvSizeNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  tvSizeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  tvSizePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444444',
    flexShrink: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    minWidth: 16,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666666',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'right',
    flexShrink: 1,
  },
  priceBreakdownText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  aboutText: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
    flexShrink: 1,
  },
  curtainSqmInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    paddingVertical: 2,
  },
  toolsOptionInfo: {
    gap: 2,
  },
  toolsOptionPrice: {
    fontSize: 12,
    color: '#999999',
  },
  // Reviews section
  reviewsEmptyText: {
    fontSize: 14,
    color: '#bbbbbb',
    textAlign: 'center',
    paddingVertical: 16,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 14,
    marginBottom: 10,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
    gap: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  reviewDate: {
    fontSize: 12,
    color: '#aaaaaa',
    flexShrink: 0,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 6,
  },
  reviewText: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  bookHint: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 8,
  },
  bookButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
