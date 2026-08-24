import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Address, getAddresses } from '@/lib/addresses';
import { sendPushNotification } from '@/lib/notifications';
import { getSubServiceNameKey, getSpaceTypeKey, getCleaningTypeKey, getToolsOptionShortKey, getBathroomCountLabel, getWallMaterialKey } from '@/lib/serviceNames';
import { formatMonthDayYear, formatWeekdayMonthDay, formatTime, parseLocalDate } from '@/lib/dateFormat';
import { useAuthUser } from '@/lib/useAuthUser';
import FullScreenImageViewer from '@/components/FullScreenImageViewer';

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = totalMinutes % 60;
  return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
}

export default function BookingReviewScreen() {
  const { t, i18n } = useTranslation();
  const {
    providerId, providerName, categoryId, serviceId, serviceName, date, time, totalPrice, hours,
    spaceType, squareMeters, roomCount, bathroomCount, cleaningType, cleanersRequested, toolsOption,
    addressId: routedAddressId, tvCount, wallMaterial, tvSizeBreakdown,
  } = useLocalSearchParams<{
    providerId: string;
    providerName: string;
    categoryId: string;
    serviceId?: string;
    serviceName?: string;
    date: string;
    time: string;
    totalPrice: string;
    hours?: string;
    spaceType?: string;
    squareMeters?: string;
    roomCount?: string;
    bathroomCount?: string;
    cleaningType?: string;
    cleanersRequested?: string;
    toolsOption?: string;
    addressId?: string;
    tvCount?: string;
    wallMaterial?: string;
    tvSizeBreakdown?: string;
  }>();

  const isCleaning = categoryId === 'cleaning';
  const isCurtainCleaning = categoryId === 'curtain-cleaning';
  const isCarpetWash = categoryId === 'carpet-wash';
  const isTvMounting = categoryId === 'tv-mounting';

  // "sizeId:quantity:price" triples, comma-separated — see provider-profile-view.tsx's
  // handleSlotPickerConfirm for why price travels with each entry instead of being
  // looked up again here.
  const tvSizes = tvSizeBreakdown
    ? decodeURIComponent(tvSizeBreakdown)
        .split(',')
        .filter(Boolean)
        .map((entry) => {
          const [subServiceId, quantity, entryPrice] = entry.split(':');
          return { subServiceId, quantity: Number(quantity), price: Number(entryPrice) };
        })
    : [];

  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState<Address | null>(null);
  const [providerPhotoURL, setProviderPhotoURL] = useState<string | null>(null);
  const [showProviderPhotoViewer, setShowProviderPhotoViewer] = useState(false);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const price = totalPrice ? Number(totalPrice) : null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuthUser();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  // Same providerServices lookup used elsewhere (e.g. booking-detail.tsx) — fetches how
  // long this specific fixed-price service is expected to take, so we can show an end time.
  useEffect(() => {
    if (isCleaning || !serviceId || !providerId) {
      setEstimatedDuration(null);
      return;
    }
    const q = query(
      collection(db, 'users', providerId, 'providerServices'),
      where('subServiceId', '==', serviceId),
    );
    getDocs(q).then((snap) => {
      const svc = snap.docs[0]?.data() as { estimatedDuration?: number } | undefined;
      setEstimatedDuration(svc?.estimatedDuration ?? null);
    });
  }, [providerId, serviceId, isCleaning]);

  async function loadData() {
    if (!user) return;
    const uid = user.uid;

    const [userSnap, addresses, providerSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getAddresses(uid),
      providerId ? getDoc(doc(db, 'users', providerId)) : Promise.resolve(null),
    ]);

    if (userSnap.exists()) setCustomerName((userSnap.data().name as string) ?? '');
    setProviderPhotoURL(providerSnap?.exists() ? ((providerSnap.data().photoURL as string) ?? null) : null);

    // Cleaning bookings carry the address the customer explicitly chose in the intake
    // flow — honor that instead of silently falling back to the default address.
    const routedAddr = routedAddressId ? addresses.find((a) => a.id === routedAddressId) : undefined;
    const defaultAddr = routedAddr ?? addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
    setAddress(defaultAddr);

    setLoading(false);
  }

  async function handleConfirm() {
    if (!user) return;
    const uid = user.uid;

    if (!address) {
      Alert.alert(t('alerts.noAddressTitle'), t('alerts.noAddressMessage'));
      return;
    }

    setSaving(true);
    try {
      const isHourly = !!hours;
      const cleaningServiceName = t('bookingDetail.cleaningServiceLabel');
      const curtainServiceName = t('bookingDetail.curtainServiceLabel');
      const carpetServiceName = t('bookingDetail.carpetServiceLabel');
      const tvServiceName = t('tvIntake.bookingServiceName', {
        count: tvSizes.reduce((sum, s) => sum + s.quantity, 0),
      });

      const bookingRef = await addDoc(collection(db, 'bookings'), {
        customerId: uid,
        customerName,
        providerId,
        providerName: decodeURIComponent(providerName),
        categoryId,
        ...(isCleaning
          ? {
              serviceName: cleaningServiceName,
              spaceType,
              squareMeters: squareMeters ? Number(squareMeters) : undefined,
              roomCount,
              bathroomCount,
              cleaningType,
              cleanersRequested: cleanersRequested ? Number(cleanersRequested) : undefined,
              toolsOption,
            }
          : isCurtainCleaning
            ? { serviceName: curtainServiceName, squareMeters: squareMeters ? Number(squareMeters) : undefined }
            : isCarpetWash
              ? { serviceName: carpetServiceName, squareMeters: squareMeters ? Number(squareMeters) : undefined }
              : isTvMounting
                ? {
                    serviceName: tvServiceName,
                    tvSizes,
                    tvCount: tvCount ? Number(tvCount) : undefined,
                    wallMaterial,
                  }
                : { subServiceId: serviceId, serviceName: decodeURIComponent(serviceName ?? '') }),
        price: price ?? 0,
        type: isCleaning ? 'cleaning-company' : isCurtainCleaning ? 'curtain-company' : isCarpetWash ? 'carpet-company' : isHourly ? 'hourly' : 'fixed',
        ...(isHourly && { hours: Number(hours) }),
        addressId: address.id,
        addressText: address.fullAddress,
        latitude: address.latitude,
        longitude: address.longitude,
        scheduledDate: date,
        scheduledTime: isCleaning ? '09:00' : time,
        status: 'pending',
        createdAt: new Date().toISOString(),
        // Badges the Bookings tab immediately, as a "go check on this" nudge — not
        // because the customer doesn't already know they just requested it, but so
        // it's easy to come back to rather than forgetting a pending request exists.
        customerViewed: false,
      });

      try {
        const providerSnap = await getDoc(doc(db, 'users', providerId));
        const providerPushToken = providerSnap.data()?.pushToken;
        if (providerPushToken) {
          const bookedServiceName = isCleaning
            ? cleaningServiceName
            : isCurtainCleaning
              ? curtainServiceName
              : isCarpetWash
                ? carpetServiceName
                : isTvMounting
                  ? tvServiceName
                  : decodeURIComponent(serviceName ?? '');
          await sendPushNotification(
            providerPushToken,
            'New Booking Request',
            `${customerName} requested ${bookedServiceName}.`,
            { type: 'booking', bookingId: bookingRef.id, role: 'provider' },
          );
        }
      } catch {
        // Notification failures shouldn't block the booking confirmation
      }

      Alert.alert(
        t('bookingReviewScreen.bookingSentTitle'),
        t('bookingReviewScreen.bookingSentMessage'),
        [{ text: t('common.ok'), onPress: () => router.replace('/bookings') }],
      );
    } catch {
      Alert.alert(t('alerts.errorTitle'), t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  const decodedProvider = providerName ? decodeURIComponent(providerName) : '';
  const decodedService = serviceName ? decodeURIComponent(serviceName) : '';
  const serviceNameKey = serviceId ? getSubServiceNameKey(serviceId) : undefined;
  const displayServiceName = serviceNameKey ? t(serviceNameKey) : decodedService;

  const scheduledLabel = isCleaning
    ? (date ? `${formatWeekdayMonthDay(parseLocalDate(date), i18n.language)} · ${t('cleaningIntake.workingHoursRange')}` : '')
    : !date
      ? ''
      : time
        ? `${formatMonthDayYear(parseLocalDate(date), i18n.language)} · ${formatTime(time, i18n.language)}${
            estimatedDuration != null ? ` – ${formatTime(addHoursToTime(time, estimatedDuration), i18n.language)}` : ''
          }`
        : '';

  const spaceTypeKey = spaceType ? getSpaceTypeKey(spaceType) : undefined;
  const spaceTypeLabel = spaceTypeKey ? t(spaceTypeKey) : (spaceType ?? '');
  const cleaningTypeKey = cleaningType ? getCleaningTypeKey(cleaningType) : undefined;
  const cleaningTypeLabel = cleaningTypeKey ? t(cleaningTypeKey) : (cleaningType ?? '');
  const toolsOptionKey = toolsOption ? getToolsOptionShortKey(toolsOption) : undefined;
  const toolsLabel = toolsOptionKey ? t(toolsOptionKey) : (toolsOption ?? '');
  const bathroomLabel = bathroomCount ? getBathroomCountLabel(bathroomCount, t) : '';

  // Total is always rate × cleanersRequested by construction (see provider-profile-view.tsx),
  // so the per-cleaner rate can be derived back out for the breakdown line rather than
  // threading it through as its own route param.
  const cleanersNum = cleanersRequested ? Number(cleanersRequested) : 0;
  const perCleanerRate = price !== null && cleanersNum > 0 ? price / cleanersNum : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('bookingReviewScreen.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        ) : (
          <>
            {/* Provider */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('labels.provider')}</Text>
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.providerRow}
                  onPress={() => providerPhotoURL && setShowProviderPhotoViewer(true)}
                  activeOpacity={providerPhotoURL ? 0.8 : 1}
                  disabled={!providerPhotoURL}
                >
                  <View style={styles.providerAvatar}>
                    {providerPhotoURL ? (
                      <Image source={{ uri: providerPhotoURL }} style={styles.providerAvatarImage} contentFit="cover" />
                    ) : (
                      <Text style={styles.providerAvatarInitials}>{initials(decodedProvider)}</Text>
                    )}
                  </View>
                  <Text style={styles.cardValue}>{decodedProvider}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Service */}
            {isCleaning ? (
              <>
                {/* Property details — the 6 informational intake fields, grouped as one block */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('bookingReviewScreen.propertyDetails')}</Text>
                  <View style={styles.card}>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardRowLabel}>{t('labels.property')}</Text>
                      <Text style={styles.priceText}>{spaceTypeLabel}</Text>
                    </View>
                    <View style={[styles.cardRow, styles.cardRowSpaced]}>
                      <Text style={styles.cardRowLabel}>{t('cleaningIntake.squareMetersQuestion')}</Text>
                      <Text style={styles.priceText}>{squareMeters}</Text>
                    </View>
                    <View style={[styles.cardRow, styles.cardRowSpaced]}>
                      <Text style={styles.cardRowLabel}>{t('cleaningIntake.roomCountQuestion')}</Text>
                      <Text style={styles.priceText}>{roomCount}</Text>
                    </View>
                    <View style={[styles.cardRow, styles.cardRowSpaced]}>
                      <Text style={styles.cardRowLabel}>{t('cleaningIntake.bathroomCountQuestion')}</Text>
                      <Text style={styles.priceText}>{bathroomLabel}</Text>
                    </View>
                    <View style={[styles.cardRow, styles.cardRowSpaced]}>
                      <Text style={styles.cardRowLabel}>{t('cleaningIntake.cleaningTypeQuestion')}</Text>
                      <Text style={styles.priceText}>{cleaningTypeLabel}</Text>
                    </View>
                    <View style={[styles.cardRow, styles.cardRowSpaced]}>
                      <Text style={styles.cardRowLabel}>{t('cleaningIntake.cleanersRequestedQuestion')}</Text>
                      <Text style={styles.priceText}>{cleanersRequested}</Text>
                    </View>
                  </View>
                </View>

                {/* Tools — kept as its own section, separate from the informational block */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('labels.tools')}</Text>
                  <View style={styles.card}>
                    <Text style={styles.cardValue}>{toolsLabel}</Text>
                  </View>
                </View>

                {/* Price — breakdown line makes the math visible instead of a bare total */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('labels.price')}</Text>
                  <View style={styles.card}>
                    {price !== null && cleanersNum > 0 && (
                      <Text style={styles.priceBreakdownText}>
                        {t('bookingReviewScreen.priceBreakdownLine', {
                          count: cleanersNum,
                          rate: perCleanerRate.toLocaleString('en-US'),
                          total: price.toLocaleString('en-US'),
                        })}
                      </Text>
                    )}
                    <View style={[styles.cardRow, styles.totalRow]}>
                      <Text style={styles.cardRowLabel}>{t('provider.totalPrefix')}</Text>
                      {price !== null && (
                        <Text style={styles.priceText}>{price.toLocaleString('en-US')} {t('common.currency')}</Text>
                      )}
                    </View>
                  </View>
                </View>
              </>
            ) : isCurtainCleaning ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('labels.price')}</Text>
                <View style={styles.card}>
                  {price !== null && squareMeters && (
                    <Text style={styles.priceBreakdownText}>
                      {t('bookingReviewScreen.curtainPriceBreakdownLine', {
                        sqm: squareMeters,
                        rate: (Number(squareMeters) > 0 ? price / Number(squareMeters) : 0).toLocaleString('en-US'),
                        total: price.toLocaleString('en-US'),
                      })}
                    </Text>
                  )}
                  <View style={[styles.cardRow, styles.totalRow]}>
                    <Text style={styles.cardRowLabel}>{t('provider.totalPrefix')}</Text>
                    {price !== null && (
                      <Text style={styles.priceText}>{price.toLocaleString('en-US')} {t('common.currency')}</Text>
                    )}
                  </View>
                </View>
              </View>
            ) : isCarpetWash ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('labels.price')}</Text>
                <View style={styles.card}>
                  {price !== null && squareMeters && (
                    <Text style={styles.priceBreakdownText}>
                      {t('bookingReviewScreen.curtainPriceBreakdownLine', {
                        sqm: squareMeters,
                        rate: (Number(squareMeters) > 0 ? price / Number(squareMeters) : 0).toLocaleString('en-US'),
                        total: price.toLocaleString('en-US'),
                      })}
                    </Text>
                  )}
                  <View style={[styles.cardRow, styles.totalRow]}>
                    <Text style={styles.cardRowLabel}>{t('provider.totalPrefix')}</Text>
                    {price !== null && (
                      <Text style={styles.priceText}>{price.toLocaleString('en-US')} {t('common.currency')}</Text>
                    )}
                  </View>
                </View>
              </View>
            ) : isTvMounting ? (
              // Single consolidated card — total price first, then every intake
              // detail below with short labels (not the full intake question
              // sentences, which were wide enough to push values past the card
              // edge instead of wrapping cleanly).
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('tvIntake.detailsTitle')}</Text>
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardRowLabel}>{t('provider.totalPrefix')}</Text>
                    {price !== null && (
                      <Text style={styles.priceText}>{price.toLocaleString('en-US')} {t('common.currency')}</Text>
                    )}
                  </View>
                  {tvCount && (
                    <View style={[styles.cardRow, styles.cardRowSpaced]}>
                      <Text style={styles.cardRowLabel}>{t('tvIntake.tvCountShortLabel')}</Text>
                      <Text style={styles.cardValue}>{tvCount}</Text>
                    </View>
                  )}
                  {wallMaterial && (
                    <View style={[styles.cardRow, styles.cardRowSpaced]}>
                      <Text style={styles.cardRowLabel}>{t('tvIntake.wallMaterialShortLabel')}</Text>
                      <Text style={styles.cardValue}>
                        {getWallMaterialKey(wallMaterial) ? t(getWallMaterialKey(wallMaterial)!) : wallMaterial}
                      </Text>
                    </View>
                  )}
                  {tvSizes.map((size) => {
                    const key = getSubServiceNameKey(size.subServiceId);
                    const label = key ? t(key) : size.subServiceId;
                    return (
                      <View key={size.subServiceId} style={[styles.cardRow, styles.cardRowSpaced]}>
                        <Text style={styles.cardRowLabel}>{size.quantity}× {label}</Text>
                        <Text style={styles.cardValue}>
                          {(size.quantity * size.price).toLocaleString('en-US')} {t('common.currency')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('labels.service')}</Text>
                <View style={styles.card}>
                  <Text style={styles.cardValue}>{displayServiceName}</Text>
                  {price !== null && (
                    <Text style={styles.servicePriceValue}>
                      {price.toLocaleString('en-US')} {t('common.currency')}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Date & time — chosen earlier in the intake/slot-picker flow, read-only here */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('bookingReviewScreen.dateTime')}</Text>
              <View style={styles.card}>
                <Text style={styles.cardValue}>{scheduledLabel}</Text>
              </View>
            </View>

            {/* Address */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('labels.address')}</Text>
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push('/addresses')}
                activeOpacity={0.7}
              >
                <View style={styles.cardRow}>
                  <Text style={[styles.cardValue, { flex: 1 }]}>
                    {address ? address.fullAddress : t('bookingReviewScreen.noAddressSaved')}
                  </Text>
                  <Image
                    source={require('../../assets/icons/house.png')}
                    style={styles.houseIcon}
                    contentFit="contain"
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Payment info notice */}
            <View style={styles.paymentNotice}>
              <Ionicons name="cash-outline" size={18} color="#1e40af" style={styles.paymentNoticeIcon} />
              <Text style={styles.paymentNoticeText}>
                {t('bookingReviewScreen.paymentNotice')}
              </Text>
            </View>

            <View style={{ height: 120 }} />
          </>
        )}
      </ScrollView>

      {!loading && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmButton, saving && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmButtonText}>
              {saving ? t('common.sending') : t('booking.confirmBooking')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FullScreenImageViewer
        visible={showProviderPhotoViewer}
        uri={providerPhotoURL}
        onClose={() => setShowProviderPhotoViewer(false)}
      />
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
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  backButton: {
    padding: 2,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  loadingText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardRowLabel: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
    lineHeight: 22,
    flexShrink: 0,
  },
  cardRowSpaced: {
    marginTop: 10,
  },
  houseIcon: {
    width: 28,
    height: 28,
  },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  paymentNoticeIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  paymentNoticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#1e3a8a',
  },
  cardValue: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
    lineHeight: 22,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  providerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  providerAvatarInitials: {
    fontSize: 15,
    fontWeight: '700',
    color: '#444444',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    textAlign: 'right',
  },
  priceBreakdownText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  totalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  servicePriceValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginTop: 6,
  },
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
  confirmButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
