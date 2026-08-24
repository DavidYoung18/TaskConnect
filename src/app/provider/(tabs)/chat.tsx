import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Chat, getSystemMessagePreviewKey, getUnreadCountForChat, subscribeToChats } from '@/lib/chats';
import { useCategoryMap } from '@/lib/categories';
import { formatRelativeTime } from '@/lib/dateFormat';
import { useAuthUser } from '@/lib/useAuthUser';
import ChatListRow from '@/components/ChatListRow';
import ProviderBottomNav from '@/components/ProviderBottomNav';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function relativeTime(ts: any, language: string, t: (key: string, opts?: any) => string): string {
  if (!ts) return '';
  const date: Date = ts.toDate ? ts.toDate() : new Date(ts);
  return formatRelativeTime(date, language, t);
}

function displayLastMessage(chat: Chat, t: (key: string) => string): string {
  if (!chat.lastMessage) return t('chatList.noMessagesYet');
  // Re-translated for whoever's reading it right now — see chat.tsx (customer side)
  // for the full explanation of why this can't just show chat.lastMessage verbatim.
  if (chat.lastMessageType) {
    const key = getSystemMessagePreviewKey(chat.lastMessageType);
    if (key) return t(key);
  }
  // Legacy fallback — chats whose last message predates lastMessageType existing.
  if (chat.lastMessage === 'Completion request sent') return t('chatList.completionRequestSent');
  return chat.lastMessage;
}

export default function ChatTab() {
  const { t, i18n } = useTranslation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [customerPhotos, setCustomerPhotos] = useState<Record<string, string | null>>({});
  const fetchedCustomerIds = useRef(new Set<string>());
  const { user } = useAuthUser();
  const uid = user?.uid ?? '';
  const categoryMap = useCategoryMap();

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid, 'provider', (data) => {
      setChats(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Re-derives each chat's actual unread message count whenever the live chat list
  // updates — see chat.tsx (customer side) for the identical pattern/reasoning.
  useEffect(() => {
    if (!uid || chats.length === 0) return;
    let cancelled = false;
    Promise.all(
      chats.map(async (chat) => {
        const count = await getUnreadCountForChat(chat.id, chat.lastReadBy?.[uid]);
        return [chat.id, count] as const;
      }),
    ).then((results) => {
      if (cancelled) return;
      setUnreadCounts(Object.fromEntries(results));
    });
    return () => {
      cancelled = true;
    };
  }, [chats, uid]);

  // One-off lookup per customer, fetched once per unique customerId across the
  // whole list — same pattern as chat.tsx (customer side).
  useEffect(() => {
    const newIds = [...new Set(chats.map((c) => c.customerId))].filter(
      (id) => !fetchedCustomerIds.current.has(id),
    );
    if (newIds.length === 0) return;
    newIds.forEach((id) => fetchedCustomerIds.current.add(id));
    Promise.all(
      newIds.map(async (id) => {
        const snap = await getDoc(doc(db, 'users', id));
        return [id, snap.exists() ? ((snap.data().photoURL as string | null) ?? null) : null] as const;
      }),
    ).then((entries) => {
      setCustomerPhotos((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [chats]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('nav.chat')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {loading && <Text style={styles.emptyText}>{t('common.loading')}</Text>}

        {!loading && chats.length === 0 && (
          <Text style={styles.emptyText}>{t('chatList.noConversations')}</Text>
        )}

        {!loading && chats.map((chat) => (
          <ChatListRow
            key={chat.id}
            name={chat.customerName}
            photoURL={customerPhotos[chat.customerId]}
            categoryLabel={chat.categoryId ? (categoryMap[chat.categoryId] ?? capitalize(chat.categoryId)) : undefined}
            preview={displayLastMessage(chat, t)}
            timestamp={relativeTime(chat.lastMessageAt, i18n.language, t)}
            unreadCount={unreadCounts[chat.id] ?? 0}
            onPress={() =>
              router.push(
                `/chat-thread?chatId=${chat.bookingId}&otherPartyName=${encodeURIComponent(chat.customerName)}`
              )
            }
          />
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <ProviderBottomNav activeTab="chat" />
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
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
});
