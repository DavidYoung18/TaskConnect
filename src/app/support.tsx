import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SupportTicket, TicketStatus, createTicket, subscribeToUserTickets } from '@/lib/supportTickets';
import { formatRelativeTime } from '@/lib/dateFormat';
import { useAuthUser } from '@/lib/useAuthUser';
import CreateTicketModal from '@/components/CreateTicketModal';

// Shared between the customer and provider "Help & Support" menu rows — same
// screen either way, since a support ticket looks identical regardless of which
// side of the app the user is on.

const STATUS_CONFIG: Record<TicketStatus, { labelKey: string; color: string; bg: string }> = {
  open: { labelKey: 'supportTicketsScreen.statusOpen', color: '#b45309', bg: '#fef3c7' },
  in_progress: { labelKey: 'supportTicketsScreen.statusInProgress', color: '#1e40af', bg: '#dbeafe' },
  resolved: { labelKey: 'supportTicketsScreen.statusResolved', color: '#065f46', bg: '#d1fae5' },
};

function relativeTime(ts: any, language: string, t: (key: string, opts?: any) => string): string {
  if (!ts) return '';
  const date: Date = ts.toDate ? ts.toDate() : new Date(ts);
  return formatRelativeTime(date, language, t);
}

export default function SupportScreen() {
  const { t, i18n } = useTranslation();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<'customer' | 'provider' | null>(null);
  const [userName, setUserName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { user } = useAuthUser();

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setUserType((data.userType as 'customer' | 'provider') ?? 'customer');
      setUserName((data.name as string) ?? '');
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserTickets(user.uid, (results) => {
      setTickets(results);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  function openTicket(ticket: SupportTicket) {
    router.push(
      `/support-thread?ticketId=${ticket.id}&subject=${encodeURIComponent(ticket.subject)}&userType=${userType ?? ''}`
    );
  }

  async function handleCreate(subject: string, description: string) {
    if (!user || !userType) return;
    const ticketId = await createTicket(user.uid, userType, userName, subject, description);
    setShowCreate(false);
    router.push(
      `/support-thread?ticketId=${ticketId}&subject=${encodeURIComponent(subject)}&userType=${userType}`
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('supportTicketsScreen.title')}</Text>
      </View>

      <View style={styles.createButtonWrapper}>
        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
          <Ionicons name="add-circle" size={20} color="#ffffff" />
          <Text style={styles.createButtonText}>{t('supportTicketsScreen.createTicket')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {loading ? (
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        ) : tickets.length === 0 ? (
          <Text style={styles.emptyText}>{t('supportTicketsScreen.noTickets')}</Text>
        ) : (
          tickets.map((ticket) => {
            const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
            return (
              <TouchableOpacity
                key={ticket.id}
                style={styles.card}
                onPress={() => openTicket(ticket)}
                activeOpacity={0.85}
              >
                {/* Subject on its own full-width line (wraps up to 2 lines, never
                    truncated), status badge on its own compact line below — same fix as
                    bookings.tsx/provider home.tsx's card lists, for the same reason:
                    sharing one row squeezed the (often user-typed, unpredictable-length)
                    subject down to whatever the badge left over. */}
                <View style={styles.cardHeader}>
                  <Text style={styles.subject} numberOfLines={2}>
                    {ticket.subject}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
                  </View>
                </View>
                <Text style={styles.time}>{relativeTime(ticket.updatedAt, i18n.language, t)}</Text>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <CreateTicketModal visible={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
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
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  createButtonWrapper: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 6,
  },
  subject: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    color: '#999999',
  },
});
