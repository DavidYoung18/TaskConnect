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
import CustomerBottomNav from '@/components/CustomerBottomNav';
import ChatListRow from '@/components/ChatListRow';

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
  // Re-translated for whoever's reading it right now, rather than showing the flat
  // string frozen in whatever language the sender had active when it was written
  // (that was the actual bug: a system message sent while the OTHER party was on
  // Russian showed as Russian forever, even for a reader on Uzbek).
  if (chat.lastMessageType) {
    const key = getSystemMessagePreviewKey(chat.lastMessageType);
    if (key) return t(key);
  }
  // Legacy fallback — chats whose last message predates lastMessageType existing.
  if (chat.lastMessage === 'Completion request sent') return t('chatList.completionRequestSent');
  return chat.lastMessage;
}

export default function CustomerChatScreen() {
  const { t, i18n } = useTranslation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [providerPhotos, setProviderPhotos] = useState<Record<string, string | null>>({});
  const fetchedProviderIds = useRef(new Set<string>());
  const { user } = useAuthUser();
  const uid = user?.uid ?? '';
  const categoryMap = useCategoryMap();

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid, 'customer', (data) => {
      setChats(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Re-derives each chat's actual unread message count whenever the live chat list
  // updates (new message, or lastReadBy changing after the chat is read) — chats.tsx
  // only stores a lastReadBy timestamp per chat, not a count, so the count itself is
  // computed on demand via a lightweight aggregate query per chat.
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

  // One-off lookup per provider, fetched once per unique providerId across the
  // whole list — same pattern as bookings.tsx.
  useEffect(() => {
    const newIds = [...new Set(chats.map((c) => c.providerId))].filter(
      (id) => !fetchedProviderIds.current.has(id),
    );
    if (newIds.length === 0) return;
    newIds.forEach((id) => fetchedProviderIds.current.add(id));
    Promise.all(
      newIds.map(async (id) => {
        const snap = await getDoc(doc(db, 'users', id));
        return [id, snap.exists() ? ((snap.data().photoURL as string | null) ?? null) : null] as const;
      }),
    ).then((entries) => {
      setProviderPhotos((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [chats]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('chatList.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {loading && <Text style={styles.emptyText}>{t('common.loading')}</Text>}

        {!loading && chats.length === 0 && (
          <Text style={styles.emptyText}>{t('chatList.noConversations')}</Text>
        )}

        {!loading &&
          chats.map((chat) => (
            <ChatListRow
              key={chat.id}
              name={chat.providerName}
              photoURL={providerPhotos[chat.providerId]}
              categoryLabel={chat.categoryId ? (categoryMap[chat.categoryId] ?? capitalize(chat.categoryId)) : undefined}
              preview={displayLastMessage(chat, t)}
              timestamp={relativeTime(chat.lastMessageAt, i18n.language, t)}
              unreadCount={unreadCounts[chat.id] ?? 0}
              onPress={() =>
                router.push(
                  `/chat-thread?chatId=${chat.id}&otherPartyName=${encodeURIComponent(chat.providerName)}`
                )
              }
            />
          ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <CustomerBottomNav activeTab="chat" />
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
