import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AppNotification,
  NotificationType,
  markNotificationRead,
  subscribeToNotifications,
} from '@/lib/inAppNotifications';
import { formatRelativeTime } from '@/lib/dateFormat';
import { useAuthUser } from '@/lib/useAuthUser';

const NOTIFICATION_CONFIG: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; titleKey: string; messageKey: string }> = {
  booking_confirmed:      { icon: 'checkmark-circle', titleKey: 'notificationsScreen.bookingConfirmedTitle', messageKey: 'notificationsScreen.bookingConfirmedMessage' },
  booking_declined:       { icon: 'close-circle', titleKey: 'notificationsScreen.bookingDeclinedTitle', messageKey: 'notificationsScreen.bookingDeclinedMessage' },
  completion_requested:   { icon: 'time', titleKey: 'notificationsScreen.completionRequestedTitle', messageKey: 'notificationsScreen.completionRequestedMessage' },
  reschedule_proposed:    { icon: 'calendar', titleKey: 'notificationsScreen.rescheduleProposedTitle', messageKey: 'notificationsScreen.rescheduleProposedMessage' },
  review_reminder:        { icon: 'star', titleKey: 'notificationsScreen.reviewReminderTitle', messageKey: 'notificationsScreen.reviewReminderMessage' },
};

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToNotifications(user.uid, (results) => {
      setNotifications(results);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  function handlePress(notification: AppNotification) {
    if (!notification.read) markNotificationRead(notification.id);
    router.push(`/booking-detail?bookingId=${notification.bookingId}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
          <Text style={styles.backButton}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('notificationsScreen.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {loading ? (
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        ) : notifications.length === 0 ? (
          <Text style={styles.emptyText}>{t('notificationsScreen.empty')}</Text>
        ) : (
          notifications.map((notification) => {
            const config = NOTIFICATION_CONFIG[notification.type];
            return (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationCard, !notification.read && styles.unreadCard]}
                onPress={() => handlePress(notification)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconCircle, !notification.read && styles.iconCircleUnread]}>
                  <Ionicons name={config.icon} size={20} color={!notification.read ? '#ffffff' : '#000000'} />
                </View>
                <View style={styles.content}>
                  <View style={styles.titleRow}>
                    <Text style={styles.notificationTitle}>{t(config.titleKey)}</Text>
                    {!notification.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.message}>
                    {t(config.messageKey, { providerName: notification.providerName })}
                  </Text>
                  <Text style={styles.time}>
                    {formatRelativeTime(new Date(notification.createdAt), i18n.language, t)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backButton: {
    color: '#000000',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  list: {
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  unreadCard: {
    borderColor: '#000000',
    backgroundColor: '#f9f9f9',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconCircleUnread: {
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000000',
  },
  message: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 6,
  },
  time: {
    fontSize: 11,
    color: '#999999',
  },
});
