import { Stack, router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts, Nunito_500Medium, Nunito_600SemiBold } from '@expo-google-fonts/nunito';
import { auth, db } from '@/lib/firebase';
import { registerForPushNotifications, savePushToken } from '@/lib/notifications';
import { initI18n, isSupportedLanguage, setLanguage } from '@/lib/i18n';
import { getDocWithRetry } from '@/lib/firestoreSubscribe';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const [authReady, setAuthReady] = useState(false);
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded] = useFonts({ Nunito_500Medium, Nunito_600SemiBold });
  const redirectPath = useRef<string | null>(null);

  // Trigger the permission prompt immediately on first open, independent of auth state.
  // Token saving still happens after login (below), since that's the earliest point a uid exists.
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  // Initializes from SecureStore (or 'en' if nothing saved yet) — independent of auth,
  // so the welcome/login screens are already translated before any user signs in.
  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Retries a few times on 'unavailable' (client briefly offline) rather than throwing
          // once and leaving setAuthReady() below unreached — see getDocWithRetry for why a bare
          // getDoc() here is unsafe: this app has no Firestore offline cache to fall back to, and
          // this read gates the entire startup spinner.
          const snap = await getDocWithRetry(doc(db, 'users', user.uid));
          const data = snap.data();
          if (data?.userType === 'provider') {
            redirectPath.current = data?.onboardingComplete === true ? '/provider/(tabs)/home' : '/provider-onboarding-category';
          } else {
            redirectPath.current = '/home';
          }

          // Firestore's saved preference wins over whatever was cached in SecureStore,
          // so the correct language is set before the app finishes rendering.
          if (data?.language && isSupportedLanguage(data.language)) {
            await setLanguage(data.language);
          }

          // Deliberately not awaited: registerForPushNotifications() already catches
          // its own errors and resolves to null on failure (network issues, denied
          // permissions, etc.), but this is still fired off in the background rather
          // than inline so a slow or failed push-token network call can never delay
          // (or, if something upstream ever throws unexpectedly, block) setAuthReady
          // below — push notifications must never be able to hold the whole app on
          // its boot spinner.
          registerForPushNotifications()
            .then((token) => (token ? savePushToken(user.uid, token) : undefined))
            .catch((error) => console.error('Push token registration/save failed:', error));
        }
      } catch (error) {
        // Retries in getDocWithRetry are exhausted (still offline) or some other read failure —
        // leave redirectPath unset rather than guessing. The user lands on the welcome/login
        // screen instead of a specific home, but critically the app stops blocking here instead
        // of hanging on the boot spinner forever.
        console.error('Startup profile lookup failed:', error);
      } finally {
        setAuthReady(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (authReady && redirectPath.current) {
      router.replace(redirectPath.current);
    }
  }, [authReady]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      if (!data) return;

      if (data.type === 'booking' && data.bookingId) {
        const path = data.role === 'provider' ? '/provider/booking-detail' : '/booking-detail';
        router.push(`${path}?bookingId=${data.bookingId}`);
      } else if (data.type === 'chat' && data.chatId) {
        router.push(
          `/chat-thread?chatId=${data.chatId}&otherPartyName=${encodeURIComponent(data.otherPartyName ?? '')}`
        );
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="home" />
      <Stack.Screen name="provider-list" />
      <Stack.Screen name="cleaning-filters" />
      <Stack.Screen name="tv-filters" />
      <Stack.Screen name="provider-profile-view" />
      <Stack.Screen name="booking-review" />
      <Stack.Screen name="booking-detail" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="chat-thread" />
      <Stack.Screen name="support" />
      <Stack.Screen name="terms-privacy" />
      <Stack.Screen name="support-thread" />
      <Stack.Screen name="review" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="account-details" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="search" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="addresses" />
      <Stack.Screen name="add-address" />
      <Stack.Screen name="provider-onboarding-category" />
      <Stack.Screen name="provider-onboarding-services" />
      <Stack.Screen name="provider-onboarding-cleaning" />
      <Stack.Screen name="provider-onboarding-ac" />
      <Stack.Screen name="provider-onboarding-carpet" />
      <Stack.Screen name="provider-onboarding-tv" />
      <Stack.Screen name="provider-onboarding-profile" />
      <Stack.Screen name="provider/account-details" />
      <Stack.Screen name="provider/booking-detail" />
      <Stack.Screen name="provider/my-services" />
      <Stack.Screen name="provider/performance" />
      </Stack>

      {(!authReady || !i18nReady || !fontsLoaded) && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
          }}
        >
          <ActivityIndicator size="large" color="#000000" />
        </View>
      )}
    </>
  );
}