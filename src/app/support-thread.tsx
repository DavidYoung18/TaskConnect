import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import {
  SupportTicket,
  TicketMessage,
  TicketStatus,
  sendTicketMessage,
  subscribeToTicket,
  subscribeToTicketMessages,
} from '@/lib/supportTickets';
import { useAuthUser } from '@/lib/useAuthUser';
import { formatTime as formatTimeLocale } from '@/lib/dateFormat';

// Same bubble/input visual pattern as chat-thread.tsx — a support ticket reads
// like a chat thread with the "other party" always being the support team.

const STATUS_CONFIG: Record<TicketStatus, { labelKey: string; color: string; bg: string }> = {
  open: { labelKey: 'supportTicketsScreen.statusOpen', color: '#b45309', bg: '#fef3c7' },
  in_progress: { labelKey: 'supportTicketsScreen.statusInProgress', color: '#1e40af', bg: '#dbeafe' },
  resolved: { labelKey: 'supportTicketsScreen.statusResolved', color: '#065f46', bg: '#d1fae5' },
};

function formatTime(ts: any, language: string): string {
  if (!ts) return '';
  const date: Date = ts.toDate ? ts.toDate() : new Date(ts);
  const hhmm = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  return formatTimeLocale(hhmm, language);
}

export default function SupportThreadScreen() {
  const { t, i18n } = useTranslation();
  const { ticketId, subject: encodedSubject, userType } = useLocalSearchParams<{
    ticketId: string;
    subject: string;
    userType: 'customer' | 'provider';
  }>();
  const subject = decodeURIComponent(encodedSubject ?? '');
  const { user } = useAuthUser();
  const uid = user?.uid ?? '';

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Same inverted-list fix as chat-thread.tsx — see that file's comment for why
  // scrollToEnd() on onContentSizeChange/onLayout is unreliable for a long history.
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  useEffect(() => {
    if (!ticketId) return;
    const unsubscribe = subscribeToTicket(ticketId, setTicket);
    return unsubscribe;
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) return;
    const unsubscribe = subscribeToTicketMessages(ticketId, setMessages);
    return unsubscribe;
  }, [ticketId]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !ticketId || !uid || !userType || sending) return;
    setSending(true);
    setText('');
    await sendTicketMessage(ticketId, uid, userType, trimmed, ticket?.status ?? 'open');
    setSending(false);
  }

  function renderMessage({ item }: { item: TicketMessage }) {
    const isOwn = item.senderId === uid;
    return (
      <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
        {!isOwn && <Text style={styles.senderLabel}>{t('supportTicketsScreen.supportTeam')}</Text>}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
            {item.text}
          </Text>
        </View>
        {item.createdAt != null && (
          <Text style={[styles.timeText, isOwn ? styles.timeRight : styles.timeLeft]}>
            {formatTime(item.createdAt, i18n.language)}
          </Text>
        )}
      </View>
    );
  }

  const statusCfg = ticket ? STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open : null;

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
          <Text style={styles.headerName} numberOfLines={1}>{subject}</Text>
        </View>
        {statusCfg && (
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{t(statusCfg.labelKey)}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={invertedMessages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
      />

      {ticket?.status === 'resolved' && (
        <View style={styles.resolvedBanner}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#065f46" />
          <Text style={styles.resolvedBannerText}>{t('supportTicketsScreen.resolvedBanner')}</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('supportTicketsScreen.inputPlaceholder') ?? undefined}
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
    gap: 10,
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 4,
  },
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
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999999',
    marginBottom: 3,
    marginLeft: 2,
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
  resolvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resolvedBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: '#166534',
    lineHeight: 17,
  },
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
