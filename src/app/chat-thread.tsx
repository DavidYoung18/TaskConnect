import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Message, markChatAsRead, sendMessage, sendSystemMessage, subscribeToMessages } from '@/lib/chats';
import { Booking, subscribeToBooking, updateBookingStatus } from '@/lib/bookings';
import { sendPushNotification } from '@/lib/notifications';
import { acceptReschedule, declineReschedule } from '@/lib/rescheduleActions';
import { useAuthUser } from '@/lib/useAuthUser';
import { formatMonthDayYear, formatTime as formatTimeLocale, parseLocalDate } from '@/lib/dateFormat';
import FullScreenImageViewer from '@/components/FullScreenImageViewer';

const RESCHEDULE_RESOLUTION_TYPES = new Set(['reschedule_accepted', 'reschedule_declined', 'reschedule_unavailable']);

function formatTime(ts: any, language: string): string {
  if (!ts) return '';
  const date: Date = ts.toDate ? ts.toDate() : new Date(ts);
  const hhmm = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  return formatTimeLocale(hhmm, language);
}

// Same "date · time" combo as booking-detail.tsx's formatDate — kept in sync
// deliberately so the reschedule card here and there read identically.
function formatRescheduleDate(date: string, time: string, language: string): string {
  return `${formatMonthDayYear(parseLocalDate(date), language)} · ${formatTimeLocale(time, language)}`;
}

export default function ChatThreadScreen() {
  const { t, i18n } = useTranslation();
  const { chatId, otherPartyName: encodedName } = useLocalSearchParams<{
    chatId: string;
    otherPartyName: string;
  }>();
  const otherPartyName = decodeURIComponent(encodedName ?? '');
  const { user } = useAuthUser();
  const uid = user?.uid ?? '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [otherPartyPhotoURL, setOtherPartyPhotoURL] = useState<string | null>(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);

  // FlatList renders inverted (see below) so the newest message is always what's on
  // screen by default, with no imperative scrollToEnd() needed — reverse the
  // ascending-by-sentAt data from subscribeToMessages into newest-first, matching
  // what an inverted list expects as its item 0.
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  useEffect(() => {
    if (!chatId || !user) return;
    const unsubscribe = subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
    });
    return unsubscribe;
  }, [chatId, user]);

  // Marks read on mount AND whenever the message list changes — not just once at
  // mount. Without this, a message that arrives while the user is already sitting
  // in this thread (rendered live via subscribeToMessages above) would never clear
  // the unread indicator for it until they left and re-opened the chat.
  useEffect(() => {
    if (!chatId || !user) return;
    markChatAsRead(chatId, user.uid);
  }, [chatId, user, messages]);

  // Live booking subscription, started as soon as the screen mounts — in parallel
  // with the messages subscription above, both via the same onSnapshot mechanism.
  // This used to be a one-shot getBooking() (a bare getDoc, no retry) fired on mount
  // and then re-fired only once messages happened to contain a system message —
  // that second condition meant it started strictly AFTER the messages listener had
  // already delivered something, stacking two sequential round trips instead of
  // running in parallel, which is what actually produced the visible ~1s gap between
  // a reschedule/completion message's text (renders straight from the message
  // payload) and its Accept/Decline buttons (gated on booking.status). Worse, a bare
  // getDoc has no protection against the permission-denied race documented at length
  // in firestoreSubscribe.ts (auth token not yet propagated to Firestore's connection
  // right after a fast navigation) — if that first getBooking() call happened to lose
  // that race, its rejection was unhandled and booking silently stayed null until the
  // second effect's retry-by-luck. subscribeToBooking uses subscribeWithRetry (same
  // as subscribeToMessages below and both booking-detail screens), so it both starts
  // at the same time as the messages listener AND recovers from that race on its own.
  useEffect(() => {
    if (!chatId) return;
    return subscribeToBooking(chatId, setBooking);
  }, [chatId]);

  // This screen is shared by both sides of a booking — whichever party ISN'T the
  // current user is "the other party" whose photo belongs in the header, same as
  // WhatsApp/Telegram show the person you're talking to, not yourself.
  useEffect(() => {
    if (!booking || !uid) return;
    const otherPartyId = uid === booking.customerId ? booking.providerId : booking.customerId;
    if (!otherPartyId) return;
    getDoc(doc(db, 'users', otherPartyId)).then((snap) => {
      setOtherPartyPhotoURL(snap.exists() ? ((snap.data().photoURL as string) ?? null) : null);
    });
  }, [booking, uid]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !chatId || !uid || sending) return;
    setSending(true);
    setText('');
    try {
      await sendMessage(chatId, uid, trimmed);
    } catch (error) {
      // Previously unhandled — a rejected sendMessage() (e.g. permission-denied
      // because chats/{chatId} doesn't exist yet, see getOrCreateChatForBooking call
      // sites) left the input already cleared with nothing to show for it: no error,
      // no message in the list, and — since the old code never reached the line
      // below on a throw — sending stuck at true forever, permanently disabling the
      // send button. Restoring the typed text avoids losing it, and the alert makes
      // a real failure visible instead of looking like the app silently ate it.
      console.error('sendMessage failed:', error);
      setText(trimmed);
      Alert.alert(t('alerts.errorTitle'), t('common.error'));
    } finally {
      setSending(false);
    }
  }

  async function handleConfirmCompletion(bookingId: string) {
    if (!booking || acting) return;
    setActing(true);
    await updateBookingStatus(bookingId, 'completed');
    await sendSystemMessage(chatId, 'completion_confirmed', { bookingId }, t('chatThread.jobMarkedComplete'));
    setBooking({ ...booking, status: 'completed' });

    try {
      const providerSnap = await getDoc(doc(db, 'users', booking.providerId));
      const token = providerSnap.data()?.pushToken;
      if (token) {
        await sendPushNotification(
          token,
          'Job Confirmed Complete',
          `${booking.customerName} confirmed "${booking.serviceName}" is complete.`,
          { type: 'booking', bookingId, role: 'provider' },
        );
      }
    } catch {
      // Notification failures shouldn't block the completion flow
    }

    setActing(false);
    Alert.alert(
      t('chatThread.jobConfirmedTitle'),
      t('chatThread.jobConfirmedMessage'),
      [
        {
          text: t('chatThread.leaveReview'),
          onPress: () =>
            router.push(
              `/review?bookingId=${bookingId}&providerId=${booking.providerId}&providerName=${encodeURIComponent(booking.providerName)}`
            ),
        },
        { text: t('chatThread.later'), style: 'cancel' },
      ],
    );
  }

  async function handleDeclineCompletion(bookingId: string) {
    if (!booking || acting) return;
    setActing(true);
    await updateBookingStatus(bookingId, 'confirmed');
    await sendSystemMessage(chatId, 'completion_declined', { bookingId }, t('chatThread.completionDeclinedText'));
    setBooking({ ...booking, status: 'confirmed' });
    setActing(false);
    Alert.alert(
      t('chatThread.declinedAlertTitle'),
      t('chatThread.declinedAlertMessage'),
    );
  }

  async function handleAcceptReschedule() {
    if (!booking || acting || !booking.proposedDate || !booking.proposedStartTime) return;
    setActing(true);
    const result = await acceptReschedule(booking, t);
    // No manual re-fetch needed — the live subscribeToBooking subscription above
    // picks up whatever acceptReschedule actually wrote (confirmed at the new time on
    // success, or reverted to its original status/schedule on failure) as soon as
    // Firestore delivers the updated snapshot, same as every other write in this file.
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
            setBooking({ ...booking, status: 'declined' });
            setActing(false);
          },
        },
      ],
    );
  }

  function renderSystemMessage(item: Message) {
    const { type, payload } = item;
    const bookingId: string = payload?.bookingId ?? chatId;
    const isCustomer = uid === booking?.customerId;

    if (type === 'completion_request') {
      const status = booking?.status;
      // Determine what to show for action area
      let actionContent: JSX.Element | null = null;
      if (isCustomer) {
        if (status === 'pending_completion') {
          actionContent = (
            <View style={styles.systemActions}>
              <TouchableOpacity
                style={[styles.systemBtn, styles.systemBtnDecline, acting && styles.systemBtnDisabled]}
                onPress={() => handleDeclineCompletion(bookingId)}
                disabled={acting}
                activeOpacity={0.8}
              >
                <Text style={styles.systemBtnDeclineText}>{acting ? '…' : t('common.decline')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.systemBtn, styles.systemBtnConfirm, acting && styles.systemBtnDisabled]}
                onPress={() => handleConfirmCompletion(bookingId)}
                disabled={acting}
                activeOpacity={0.8}
              >
                <Text style={styles.systemBtnConfirmText}>{acting ? '…' : t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          );
        } else if (status === 'completed') {
          actionContent = <Text style={styles.systemOutcome}>✓ {t('chatThread.youConfirmedCompletion')}</Text>;
        } else if (status === 'confirmed') {
          actionContent = <Text style={styles.systemOutcome}>✗ {t('chatThread.youDeclinedCompletion')}</Text>;
        }
        // If booking not loaded yet, show nothing while fetching
      }

      return (
        <View style={styles.systemCard}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#1e40af" style={{ marginBottom: 6 }} />
          <Text style={styles.systemCardText}>
            {t('chatThread.completionRequestText')}
          </Text>
          {actionContent}
        </View>
      );
    }

    if (type === 'completion_confirmed') {
      return (
        <View style={[styles.systemCard, styles.systemCardGreen]}>
          <Text style={[styles.systemCardText, styles.systemCardTextGreen]}>
            ✓ {t('chatThread.jobMarkedComplete')}
          </Text>
        </View>
      );
    }

    if (type === 'completion_declined') {
      return (
        <View style={[styles.systemCard, styles.systemCardRed]}>
          <Text style={[styles.systemCardText, styles.systemCardTextRed]}>
            ✗ {t('chatThread.completionDeclinedText')}
          </Text>
        </View>
      );
    }

    // Only the customer decides on a reschedule request (the provider is the one who
    // proposed it), same gating as completion_request above.
    //
    // Resolution is looked up from the messages list, NOT derived from booking.status
    // directly — unlike completion_request, a reschedule can resolve into 'confirmed'
    // two different ways: accepted (moved to the new time) or bounced back because the
    // proposed slot got taken by someone else in the meantime (acceptReschedule's
    // race-check, reschedule_unavailable). Both leave status === 'confirmed', so
    // matching on status alone can't tell them apart. Every resolution already gets
    // its own trailing system message (reschedule_accepted/declined/unavailable) —
    // finding the first one that comes after this request in the same chat gives an
    // unambiguous answer, and as a side benefit correctly handles a booking that's
    // been rescheduled more than once (each request bubble shows ITS OWN outcome).
    if (type === 'reschedule_requested') {
      const resolution = messages
        .slice(messages.findIndex((m) => m.id === item.id) + 1)
        .find((m) => m.senderId === 'system' && RESCHEDULE_RESOLUTION_TYPES.has(m.type ?? ''));

      let actionContent: JSX.Element | null = null;
      if (resolution) {
        if (resolution.type === 'reschedule_accepted') {
          actionContent = <Text style={styles.systemOutcome}>✓ {t('chatThread.rescheduleAcceptedText')}</Text>;
        } else if (resolution.type === 'reschedule_declined') {
          actionContent = <Text style={styles.systemOutcome}>✗ {t('chatThread.rescheduleDeclinedText')}</Text>;
        } else if (resolution.type === 'reschedule_unavailable') {
          actionContent = <Text style={styles.systemOutcome}>✗ {t('chatThread.rescheduleUnavailableText')}</Text>;
        }
      } else if (isCustomer && booking?.status === 'reschedule_pending') {
        actionContent = (
          <View style={styles.systemActions}>
            <TouchableOpacity
              style={[styles.systemBtn, styles.systemBtnDecline, acting && styles.systemBtnDisabled]}
              onPress={handleDeclineReschedule}
              disabled={acting}
              activeOpacity={0.8}
            >
              <Text style={styles.systemBtnDeclineText}>{acting ? '…' : t('common.decline')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.systemBtn, styles.systemBtnConfirm, acting && styles.systemBtnDisabled]}
              onPress={handleAcceptReschedule}
              disabled={acting}
              activeOpacity={0.8}
            >
              <Text style={styles.systemBtnConfirmText}>{acting ? '…' : t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
        );
      }
      // If not resolved yet, not the customer, and not reschedule_pending (booking not
      // loaded, or a stale request bubble from before some other flow moved the status
      // on): show nothing extra.

      // originalDate/originalTime/proposedDate/proposedTime are only present on
      // messages sent after this field was added to the payload (see proposeReschedule
      // in rescheduleActions.ts) — older messages fall back to showing no times rather
      // than throwing on missing data.
      const original: string | undefined = payload?.originalDate;
      const originalTime: string | undefined = payload?.originalTime;
      const proposed: string | undefined = payload?.proposedDate;
      const proposedTime: string | undefined = payload?.proposedTime;

      return (
        <View style={[styles.systemCard, styles.systemCardPurple]}>
          <Ionicons name="calendar-outline" size={20} color="#7c3aed" style={{ marginBottom: 6 }} />
          <Text style={[styles.systemCardText, styles.systemCardTextPurple]}>
            {t('chatThread.rescheduleRequestedText')}
          </Text>

          {original && originalTime && proposed && proposedTime && (
            <View style={styles.rescheduleTimesBlock}>
              <View style={styles.rescheduleTimeRow}>
                <Text style={styles.rescheduleTimeLabel}>{t('bookingDetail.rescheduleOriginalLabel')}</Text>
                <Text style={styles.rescheduleTimeValueStrike}>
                  {formatRescheduleDate(original, originalTime, i18n.language)}
                </Text>
              </View>
              <View style={styles.rescheduleTimeRow}>
                <Text style={styles.rescheduleTimeLabel}>{t('bookingDetail.rescheduleProposedLabel')}</Text>
                <Text style={styles.rescheduleTimeValue}>
                  {formatRescheduleDate(proposed, proposedTime, i18n.language)}
                </Text>
              </View>
            </View>
          )}

          {actionContent}
        </View>
      );
    }

    if (type === 'reschedule_accepted') {
      return (
        <View style={[styles.systemCard, styles.systemCardGreen]}>
          <Text style={[styles.systemCardText, styles.systemCardTextGreen]}>
            ✓ {t('chatThread.rescheduleAcceptedText')}
          </Text>
        </View>
      );
    }

    if (type === 'reschedule_declined') {
      return (
        <View style={[styles.systemCard, styles.systemCardRed]}>
          <Text style={[styles.systemCardText, styles.systemCardTextRed]}>
            ✗ {t('chatThread.rescheduleDeclinedText')}
          </Text>
        </View>
      );
    }

    if (type === 'reschedule_unavailable') {
      return (
        <View style={[styles.systemCard, styles.systemCardRed]}>
          <Text style={[styles.systemCardText, styles.systemCardTextRed]}>
            ✗ {t('chatThread.rescheduleUnavailableText')}
          </Text>
        </View>
      );
    }

    // Unknown system message type — show nothing
    return null;
  }

  function renderMessage({ item }: { item: Message }) {
    if (item.senderId === 'system') {
      const node = renderSystemMessage(item);
      if (!node) return null;
      return <View style={styles.systemWrapper}>{node}</View>;
    }

    const isOwn = item.senderId === uid;
    return (
      <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
            {item.text}
          </Text>
        </View>
        {item.sentAt != null && (
          <Text style={[styles.timeText, isOwn ? styles.timeRight : styles.timeLeft]}>
            {formatTime(item.sentAt, i18n.language)}
          </Text>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>{otherPartyName}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAvatar}
          onPress={() => otherPartyPhotoURL && setShowPhotoViewer(true)}
          activeOpacity={otherPartyPhotoURL ? 0.8 : 1}
          disabled={!otherPartyPhotoURL}
        >
          {otherPartyPhotoURL ? (
            <Image source={{ uri: otherPartyPhotoURL }} style={styles.headerAvatarImage} contentFit="cover" />
          ) : (
            <Text style={styles.headerAvatarInitials}>
              {otherPartyName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <FullScreenImageViewer
        visible={showPhotoViewer}
        uri={otherPartyPhotoURL}
        onClose={() => setShowPhotoViewer(false)}
      />

      {/* inverted + newest-first data is the standard chat-app fix for reliably
          landing on the latest message — a non-inverted list relying on
          onContentSizeChange/onLayout scrollToEnd() (the old approach) computes its
          target off however much content FlatList has measured/rendered so far, which
          for a long history is only a virtualized window near the top on first
          mount, not the true full height — so the very scrollToEnd() call meant to
          reach the bottom often landed short of it. An inverted list sidesteps that
          class of bug entirely: its natural resting scroll position (offset 0) IS the
          bottom of the visual list, so there's no height to compute or scroll call to
          get right, on open or as new messages arrive. */}
      <FlatList
        data={invertedMessages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('chatThread.inputPlaceholder') ?? undefined}
          placeholderTextColor="#999999"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.7}
        >
          <Ionicons name="send" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    gap: 14,
  },
  backButton: {
    padding: 2,
  },
  headerCenter: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  headerAvatarInitials: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 4,
  },
  // ── Regular bubbles ──────────────────────────────────────────────────────────
  bubbleWrapper: {
    marginBottom: 8,
    maxWidth: '78%',
  },
  bubbleWrapperRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapperLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: '#000000',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextOwn: {
    color: '#ffffff',
  },
  bubbleTextOther: {
    color: '#000000',
  },
  timeText: {
    fontSize: 11,
    color: '#aaaaaa',
    marginTop: 3,
  },
  timeRight: {
    textAlign: 'right',
  },
  timeLeft: {
    textAlign: 'left',
  },
  // ── System message cards ─────────────────────────────────────────────────────
  systemWrapper: {
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 8,
  },
  systemCard: {
    width: '100%',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  systemCardGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  systemCardRed: {
    backgroundColor: '#fff7f7',
    borderColor: '#fecaca',
  },
  systemCardPurple: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  systemCardText: {
    fontSize: 14,
    color: '#1e3a8a',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  systemCardTextGreen: {
    color: '#166534',
  },
  systemCardTextRed: {
    color: '#991b1b',
  },
  systemCardTextPurple: {
    color: '#5b21b6',
  },
  systemActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    width: '100%',
  },
  systemBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  systemBtnDecline: {
    backgroundColor: '#ffffff',
    borderColor: '#ef4444',
  },
  systemBtnConfirm: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  systemBtnDisabled: {
    opacity: 0.45,
  },
  systemBtnDeclineText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  systemBtnConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  systemOutcome: {
    marginTop: 10,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  // Same visual treatment as booking-detail.tsx's rescheduleTimeRow/Label/Value(Strike)
  // — kept identical on purpose so the chat bubble and the booking card agree.
  rescheduleTimesBlock: {
    width: '100%',
    marginTop: 10,
    gap: 4,
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
  // ── Input row ────────────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    gap: 10,
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    maxHeight: 120,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButtonDisabled: {
    backgroundColor: '#cccccc',
  },
});
