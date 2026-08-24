import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Booking, subscribeToBooking, updateBookingStatus } from '@/lib/bookings';
import { getOrCreateChatForBooking, sendSystemMessage } from '@/lib/chats';
import { sendPushNotification } from '@/lib/notifications';
import { acceptReschedule, declineReschedule } from '@/lib/rescheduleActions';
import { hasReviewForBooking } from '@/lib/reviews';
import { getSpaceTypeKey, getCleaningTypeKey, getToolsOptionShortKey, getBathroomCountLabel, getWallMaterialKey, getSubServiceNameKey, displayBookingServiceName } from '@/lib/serviceNames';
import { formatMonthDayYear, formatTime, parseLocalDate } from '@/lib/dateFormat';
import FullScreenImageViewer from '@/components/FullScreenImageViewer';

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending:            { color: '#b45309', bg: '#fef3c7' },
  confirmed:          { color: '#065f46', bg: '#d1fae5' },
  completed:          { color: '#374151', bg: '#f3f4f6' },
  declined:           { color: '#991b1b', bg: '#fee2e2' },
  pending_completion: { color: '#1e40af', bg: '#dbeafe' },
  reschedule_pending: { color: '#7c3aed', bg: '#ede9fe' },
};

const STATUS_LABEL_KEY: Record<string, string> = {
  pending:            'booking.pending',
  confirmed:          'booking.confirmed',
  completed:          'booking.completed',
  declined:           'booking.declined',
  pending_completion: 'booking.awaitingConfirmation',
  reschedule_pending: 'booking.rescheduleRequested',
};

function formatDate(date: string, time: string, language: string): string {
  return `${formatMonthDayYear(parseLocalDate(date), language)} · ${formatTime(time, language)}`;
}

function formatPrice(price: number, currency: string): string {
  return price.toLocaleString('en-US') + ' ' + currency;
}

export default function BookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [providerPhotoURL, setProviderPhotoURL] = useState<string | null>(null);
  const [providerPhone, setProviderPhone] = useState<string | null>(null);
  const [showProviderPhotoViewer, setShowProviderPhotoViewer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [hasReview, setHasReview] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    const unsubscribe = subscribeToBooking(bookingId, (b) => {
      setBooking(b);
      setLoading(false);
    });
    return unsubscribe;
  }, [bookingId]);

  // One-off lookup — providerId doesn't change for a given booking, so this doesn't
  // need to re-run on every snapshot update. photoURL is shown for any provider
  // category (see providers.ts/provider-profile-view.tsx, fixed earlier this session
  // to stop nulling it out for non-cleaning providers), not just cleaning companies.
  useEffect(() => {
    if (!booking?.providerId) return;
    getDoc(doc(db, 'users', booking.providerId)).then((snap) => {
      setProviderPhotoURL(snap.exists() ? ((snap.data().photoURL as string) ?? null) : null);
      setProviderPhone(snap.exists() ? ((snap.data().phone as string) ?? null) : null);
    });
  }, [booking?.providerId]);

  // Covers both the normal flow (customer confirms completion, reviews right away)
  // and cases where that one-time prompt was skipped or the booking was closed by
  // an admin — either way, a completed booking with no review yet should still show
  // the "Leave a Review" entry point below.
  useEffect(() => {
    if (booking?.status !== 'completed') return;
    hasReviewForBooking(booking.id).then(setHasReview);
  }, [booking?.id, booking?.status]);

  function handleLeaveReview() {
    if (!booking) return;
    router.push(
      `/review?bookingId=${booking.id}&providerId=${booking.providerId}&providerName=${encodeURIComponent(booking.providerName)}`
    );
  }

  async function handleMessage() {
    if (!booking) return;
    // Mirrors provider/booking-detail.tsx's handleMessage — a customer can message
    // about a still-pending (not yet accepted) booking, but the chats/{bookingId} doc
    // (and its messages subcollection rules, which require the parent doc to exist —
    // see firestore.rules) is only ever created here or on the provider's accept/
    // message actions. Skipping this call was the actual bug: navigating straight to
    // chat-thread before either side had created the chat doc left nothing for
    // messages/{messageId}'s isChatParticipant() to find, so subscribeToMessages
    // failed with "Missing or insufficient permissions".
    await getOrCreateChatForBooking(booking);
    router.push(
      `/chat-thread?chatId=${booking.id}&otherPartyName=${encodeURIComponent(booking.providerName)}`
    );
  }

  function handleCall() {
    if (!providerPhone) {
      Alert.alert(t('alerts.phoneNotAvailableTitle'), t('alerts.providerPhoneNotAvailableMessage'));
      return;
    }
    Linking.openURL(`tel:${providerPhone}`);
  }

  async function handleConfirmCompletion() {
    if (!booking || acting) return;
    setActing(true);
    await updateBookingStatus(booking.id, 'completed');
    await sendSystemMessage(booking.id, 'completion_confirmed', { bookingId: booking.id }, t('chatThread.jobMarkedComplete'));
    setActing(false);

    // Gives Firestore time to propagate the status change before the bookings screen
    // remounts and starts listening.
    setTimeout(() => {
      Alert.alert(
        t('chatThread.jobConfirmedTitle'),
        t('chatThread.jobConfirmedMessage'),
        [
          {
            text: t('common.ok'),
            onPress: () =>
              router.replace(
                `/review?bookingId=${booking.id}&providerId=${booking.providerId}&providerName=${encodeURIComponent(booking.providerName)}`
              ),
          },
        ],
      );
    }, 500);
  }

  async function handleDeclineCompletion() {
    if (!booking || acting) return;
    setActing(true);
    await updateBookingStatus(booking.id, 'confirmed');
    await sendSystemMessage(booking.id, 'completion_declined', { bookingId: booking.id }, t('chatThread.completionDeclinedText'));

    try {
      const providerSnap = await getDoc(doc(db, 'users', booking.providerId));
      const token = providerSnap.data()?.pushToken;
      if (token) {
        await sendPushNotification(
          token,
          'Job Not Yet Complete',
          `${booking.customerName} indicated the job isn't done yet. Please follow up.`,
          { type: 'booking', bookingId: booking.id, role: 'provider' },
        );
      }
    } catch {
      // Notification failures shouldn't block the decline flow
    }

    setActing(false);
    Alert.alert(t('chatThread.declinedAlertTitle'), t('chatThread.declinedAlertMessage'));
  }

  function handleCancel() {
    if (!booking || acting) return;
    Alert.alert(
      t('booking.cancelBooking'),
      t('alerts.cancelBookingConfirm'),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('alerts.yesCancel'),
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            await updateBookingStatus(booking.id, 'declined');
            setActing(false);
            router.back();
          },
        },
      ],
    );
  }

  async function handleAcceptReschedule() {
    if (!booking || acting || !booking.proposedDate || !booking.proposedStartTime) return;
    setActing(true);
    const result = await acceptReschedule(booking, t);
    setActing(false);
    if (!result.ok) {
      Alert.alert(t('alerts.rescheduleSlotUnavailableTitle'), t('alerts.rescheduleSlotUnavailableMessage'));
    }
  }

  function handleDeclineReschedule() {
    if (!booking || acting) return;
    Alert.alert(
      t('alerts.declineRescheduleTitle'),
      t('alerts.declineRescheduleConfirm'),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('common.decline'),
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            await declineReschedule(booking, t);
            setActing(false);
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('bookingDetail.title')}</Text>
        </View>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('bookingDetail.title')}</Text>
        </View>
        <Text style={styles.loadingText}>{t('bookingDetail.notFound')}</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const isPending = booking.status === 'pending';
  const isPendingCompletion = booking.status === 'pending_completion';
  const isReschedulePending = booking.status === 'reschedule_pending';
  const isCleaning = booking.type === 'cleaning-company';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('bookingDetail.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{t('labels.summary')}</Text>
            <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.badgeText, { color: statusCfg.color }]}>
                {t(STATUS_LABEL_KEY[booking.status] ?? 'booking.pending')}
              </Text>
            </View>
          </View>

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
                <Text style={styles.providerAvatarInitials}>{initials(booking.providerName)}</Text>
              )}
            </View>
            <Text style={styles.providerName}>{booking.providerName}</Text>
          </TouchableOpacity>

          {isCleaning ? (
            <>
              <View style={styles.detailRow}>
                <Ionicons name="home-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('labels.property')}</Text>
                  <Text style={styles.detailValue}>
                    {booking.spaceType ? (getSpaceTypeKey(booking.spaceType) ? t(getSpaceTypeKey(booking.spaceType)!) : booking.spaceType) : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="resize-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.squareMetersQuestion')}</Text>
                  <Text style={styles.detailValue}>{booking.squareMeters}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="grid-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.roomCountQuestion')}</Text>
                  <Text style={styles.detailValue}>{booking.roomCount}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="water-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.bathroomCountQuestion')}</Text>
                  <Text style={styles.detailValue}>
                    {booking.bathroomCount ? getBathroomCountLabel(booking.bathroomCount, t) : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="sparkles-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.cleaningTypeQuestion')}</Text>
                  <Text style={styles.detailValue}>
                    {booking.cleaningType ? (getCleaningTypeKey(booking.cleaningType) ? t(getCleaningTypeKey(booking.cleaningType)!) : booking.cleaningType) : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('cleaningIntake.cleanersRequestedQuestion')}</Text>
                  <Text style={styles.detailValue}>{booking.cleanersRequested}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="construct-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('labels.tools')}</Text>
                  <Text style={styles.detailValue}>
                    {booking.toolsOption ? (getToolsOptionShortKey(booking.toolsOption) ? t(getToolsOptionShortKey(booking.toolsOption)!) : booking.toolsOption) : ''}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.detailRow}>
                <Ionicons name="construct-outline" size={16} color="#666666" style={styles.detailIcon} />
                <View style={styles.detailTextColumn}>
                  <Text style={styles.detailLabel}>{t('labels.service')}</Text>
                  <Text style={styles.detailValue}>{displayBookingServiceName(booking, t)}</Text>
                </View>
              </View>

              {booking.type === 'hourly' && booking.hours != null && (
                <View style={styles.detailRow}>
                  <Ionicons name="hourglass-outline" size={16} color="#666666" style={styles.detailIcon} />
                  <View style={styles.detailTextColumn}>
                    <Text style={styles.detailLabel}>{t('labels.duration')}</Text>
                    <Text style={styles.detailValue}>
                      {booking.hours} hour{booking.hours !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              )}

              {/* Curtain/carpet companies price per square meter — shown here since
                  they never set spaceType (that's cleaning-intake-only). */}
              {booking.squareMeters != null && (
                <View style={styles.detailRow}>
                  <Ionicons name="resize-outline" size={16} color="#666666" style={styles.detailIcon} />
                  <View style={styles.detailTextColumn}>
                    <Text style={styles.detailLabel}>{t('cleaningIntake.squareMetersQuestion')}</Text>
                    <Text style={styles.detailValue}>{booking.squareMeters}</Text>
                  </View>
                </View>
              )}

              {/* TV mounting only */}
              {booking.tvCount != null && (
                <View style={styles.detailRow}>
                  <Ionicons name="tv-outline" size={16} color="#666666" style={styles.detailIcon} />
                  <View style={styles.detailTextColumn}>
                    <Text style={styles.detailLabel}>{t('tvIntake.tvCountQuestion')}</Text>
                    <Text style={styles.detailValue}>{booking.tvCount}</Text>
                  </View>
                </View>
              )}
              {booking.wallMaterial && (
                <View style={styles.detailRow}>
                  <Ionicons name="grid-outline" size={16} color="#666666" style={styles.detailIcon} />
                  <View style={styles.detailTextColumn}>
                    <Text style={styles.detailLabel}>{t('tvIntake.wallMaterialQuestion')}</Text>
                    <Text style={styles.detailValue}>
                      {getWallMaterialKey(booking.wallMaterial) ? t(getWallMaterialKey(booking.wallMaterial)!) : booking.wallMaterial}
                    </Text>
                  </View>
                </View>
              )}
              {booking.tvSizes && booking.tvSizes.length > 0 && (
                <View style={styles.detailRow}>
                  <Ionicons name="list-outline" size={16} color="#666666" style={styles.detailIcon} />
                  <View style={styles.detailTextColumn}>
                    <Text style={styles.detailLabel}>{t('tvIntake.detailsTitle')}</Text>
                    {booking.tvSizes.map((size) => {
                      const key = getSubServiceNameKey(size.subServiceId);
                      const label = key ? t(key) : size.subServiceId;
                      return (
                        <Text key={size.subServiceId} style={styles.detailValue}>
                          {size.quantity}× {label}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#666666" style={styles.detailIcon} />
            <View style={styles.detailTextColumn}>
              <Text style={styles.detailLabel}>{t('labels.price')}</Text>
              <Text style={styles.detailValue}>{formatPrice(booking.price, t('common.currency'))}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666666" style={styles.detailIcon} />
            <View style={styles.detailTextColumn}>
              <Text style={styles.detailLabel}>{t('labels.scheduled')}</Text>
              <Text style={styles.detailValue}>{formatDate(booking.scheduledDate, booking.scheduledTime, i18n.language)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#666666" style={styles.detailIcon} />
            <View style={styles.detailTextColumn}>
              <Text style={styles.detailLabel}>{t('labels.address')}</Text>
              <Text style={styles.detailValue}>{booking.addressText}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {isReschedulePending && booking.proposedDate && booking.proposedStartTime && (
          <View style={styles.rescheduleCard}>
            <Text style={styles.rescheduleText}>
              {t('bookingDetail.rescheduleCustomerNotice', { providerName: booking.providerName })}
            </Text>

            <View style={styles.rescheduleTimeRow}>
              <Text style={styles.rescheduleTimeLabel}>{t('bookingDetail.rescheduleOriginalLabel')}</Text>
              <Text style={styles.rescheduleTimeValueStrike}>
                {formatDate(booking.scheduledDate, booking.scheduledTime, i18n.language)}
              </Text>
            </View>
            <View style={styles.rescheduleTimeRow}>
              <Text style={styles.rescheduleTimeLabel}>{t('bookingDetail.rescheduleProposedLabel')}</Text>
              <Text style={styles.rescheduleTimeValue}>
                {formatDate(booking.proposedDate, booking.proposedStartTime, i18n.language)}
              </Text>
            </View>

            <View style={styles.completionButtonsRow}>
              <TouchableOpacity
                style={[styles.completionDeclineButton, acting && styles.buttonDisabled]}
                onPress={handleDeclineReschedule}
                disabled={acting}
                activeOpacity={0.8}
              >
                <Text style={styles.completionDeclineText}>{t('common.decline')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.completionConfirmButton, acting && styles.buttonDisabled]}
                onPress={handleAcceptReschedule}
                disabled={acting}
                activeOpacity={0.8}
              >
                <Text style={styles.completionConfirmText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isPendingCompletion && (
          <View style={styles.completionCard}>
            <Text style={styles.completionText}>
              {t('bookingDetail.completionNotice')}
            </Text>
            <View style={styles.completionButtonsRow}>
              <TouchableOpacity
                style={[styles.completionDeclineButton, acting && styles.buttonDisabled]}
                onPress={handleDeclineCompletion}
                disabled={acting}
                activeOpacity={0.8}
              >
                <Text style={styles.completionDeclineText}>{t('common.decline')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.completionConfirmButton, acting && styles.buttonDisabled]}
                onPress={handleConfirmCompletion}
                disabled={acting}
                activeOpacity={0.8}
              >
                <Text style={styles.completionConfirmText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {booking.status === 'completed' && !hasReview && (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={handleLeaveReview}
            activeOpacity={0.85}
          >
            <Ionicons name="star" size={16} color="#ffffff" />
            <Text style={styles.reviewButtonText}>{t('bookingDetail.leaveReview')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.contactRow}>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={handleMessage}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#ffffff" />
            <Text style={styles.messageText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {t('common.message')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCall}
            activeOpacity={0.85}
          >
            <Ionicons name="call-outline" size={16} color="#000000" />
            <Text style={styles.callButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {t('common.call')}
            </Text>
          </TouchableOpacity>
        </View>

        {isPending && (
          <TouchableOpacity
            style={[styles.cancelButton, acting && styles.buttonDisabled]}
            onPress={handleCancel}
            disabled={acting}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>{acting ? t('common.updating') : t('booking.cancelRequest')}</Text>
          </TouchableOpacity>
        )}
      </View>

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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    gap: 14,
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
  loadingText: {
    textAlign: 'center',
    marginTop: 48,
    color: '#999999',
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badge: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  detailIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  detailTextColumn: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    textAlign: 'left',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#444444',
  },
  providerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 10,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#f44336',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#f44336',
    fontSize: 15,
    fontWeight: '600',
  },
  completionCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  rescheduleCard: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  rescheduleText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5b21b6',
  },
  rescheduleTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rescheduleTimeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c3aed',
  },
  rescheduleTimeValueStrike: {
    fontSize: 13,
    color: '#8b8b8b',
    textDecorationLine: 'line-through',
  },
  rescheduleTimeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4c1d95',
  },
  completionText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#1e3a8a',
  },
  completionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  completionDeclineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dc2626',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  completionDeclineText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
  completionConfirmButton: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  completionConfirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 14,
  },
  callButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#b45309',
    borderRadius: 12,
    paddingVertical: 14,
  },
  reviewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
