import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Push notifications are a nice-to-have, never something that should block app
// startup or any other feature — every failure path here returns null instead of
// throwing, so callers never need their own try/catch around this.
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    // getExpoPushTokenAsync makes a network call to Expo's push service — retry a
    // couple of times on transient failures (e.g. "Network request failed") before
    // giving up, since a flaky connection at launch shouldn't permanently skip push
    // registration for the rest of the session.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        return token;
      } catch (error) {
        if (attempt === maxAttempts) {
          console.error('registerForPushNotifications: getExpoPushTokenAsync failed after retries:', error);
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
    return null;
  } catch (error) {
    console.error('registerForPushNotifications failed:', error);
    return null;
  }
}

export async function savePushToken(uid: string, token: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { pushToken: token });
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: object,
): Promise<void> {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: expoPushToken,
      title,
      body,
      data: data ?? {},
    }),
  });
}
