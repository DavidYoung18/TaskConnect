import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassSurface from '@/components/GlassSurface';
import { subscribeToUnreadChatCount } from '@/lib/chats';
import { subscribeToUnseenBookingsCount } from '@/lib/bookings';
import { useAuthUser } from '@/lib/useAuthUser';

type Tab = 'home' | 'search' | 'bookings' | 'chat' | 'profile';

interface Props {
  activeTab: Tab;
}

function CustomerBottomNav({ activeTab }: Props) {
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unseenBookingsCount, setUnseenBookingsCount] = useState(0);
  const { user } = useAuthUser();
  const insets = useSafeAreaInsets();

  // Was previously reading auth.currentUser?.uid synchronously in a useEffect
  // with an empty deps array — the exact race useAuthUser() exists to prevent
  // (see src/lib/useAuthUser.ts): auth.currentUser can be null, or briefly reflect
  // a stale session across a fast logout/login transition, before Firebase's
  // persisted-session restore settles. Since deps were [], a bad first read never
  // retried, so the subscription either silently never started or could fire once
  // with a uid that no longer matches the actual current ID token — producing a
  // query Firestore correctly rejects as permission-denied, since request.auth.uid
  // (from the real, current token) wouldn't match the stale uid baked into the
  // query's filter.
  useEffect(() => {
    if (!user) return;
    return subscribeToUnreadChatCount(user.uid, 'customer', setUnreadCount);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToUnseenBookingsCount(user.uid, setUnseenBookingsCount);
  }, [user]);

  const badge = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null;
  const bookingsBadge = unseenBookingsCount > 9 ? '9+' : unseenBookingsCount > 0 ? String(unseenBookingsCount) : null;

  const navItems = (
    <>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/home')}
        disabled={activeTab === 'home'}
      >
        <Ionicons
          name={activeTab === 'home' ? 'home' : 'home-outline'}
          size={22}
          color={activeTab === 'home' ? '#000000' : '#999999'}
        />
        <Text
          style={activeTab === 'home' ? styles.navLabelActive : styles.navLabel}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {t('nav.home')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/search')}
        disabled={activeTab === 'search'}
      >
        <Ionicons
          name={activeTab === 'search' ? 'search' : 'search-outline'}
          size={22}
          color={activeTab === 'search' ? '#000000' : '#999999'}
        />
        <Text
          style={activeTab === 'search' ? styles.navLabelActive : styles.navLabel}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {t('nav.search')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/bookings')}
        disabled={activeTab === 'bookings'}
      >
        <View style={styles.iconWrapper}>
          <Ionicons
            name={activeTab === 'bookings' ? 'receipt' : 'receipt-outline'}
            size={22}
            color={activeTab === 'bookings' ? '#000000' : '#999999'}
          />
          {bookingsBadge !== null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{bookingsBadge}</Text>
            </View>
          )}
        </View>
        <Text
          style={activeTab === 'bookings' ? styles.navLabelActive : styles.navLabel}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {t('nav.bookings')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/chat')}
        disabled={activeTab === 'chat'}
      >
        <View style={styles.iconWrapper}>
          <Ionicons
            name={activeTab === 'chat' ? 'chatbubbles' : 'chatbubbles-outline'}
            size={22}
            color={activeTab === 'chat' ? '#000000' : '#999999'}
          />
          {badge !== null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text
          style={activeTab === 'chat' ? styles.navLabelActive : styles.navLabel}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {t('nav.messages')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/profile')}
        disabled={activeTab === 'profile'}
      >
        <Ionicons
          name={activeTab === 'profile' ? 'person' : 'person-outline'}
          size={22}
          color={activeTab === 'profile' ? '#000000' : '#999999'}
        />
        <Text
          style={activeTab === 'profile' ? styles.navLabelActive : styles.navLabel}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {t('nav.profile')}
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={[styles.floatingWrapper, { bottom: Math.max(insets.bottom - 20, 8) }]} pointerEvents="box-none">
      {/* Elevation/shadow lives on this outer, non-clipped layer — Android clips
          elevation shadows to a view's own bounds when that same view also sets
          overflow:'hidden', which the glass/blur fill below needs in order to round
          off its corners. Splitting them keeps both the rounded corners and the
          visible "lifted off the page" shadow. */}
      <View style={styles.pillShadow}>
        {/* tintColor/colorScheme pin the glass to one consistent light look — left
            adaptive (the default), real Liquid Glass samples whatever's scrolled
            behind the pill and shifts its own tone to match, which is exactly why
            this nav was reading as fully dark over some photos and fully bright
            over others as the page scrolled. A solid "#ffffff" tint fixed the
            consistency but read as flat/opaque rather than glassy — a
            semi-transparent white tint keeps the same consistent hue while letting
            more of the actual blur/refraction show through underneath it. */}
        <GlassSurface style={styles.bottomNavShape} tintColor="rgba(255,255,255,0.45)" colorScheme="light">
          {navItems}
        </GlassSurface>
      </View>
    </View>
  );
}

export default memo(CustomerBottomNav);

const styles = StyleSheet.create({
  // Floats the pill above the screen edge instead of docking it flush against the
  // bottom — the wrapper only positions it (and lets touches outside the pill's own
  // bounds pass through via pointerEvents="box-none"), all the visual "island"
  // styling lives on the pill itself below.
  floatingWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pillShadow: {
    width: '100%',
    borderRadius: 32,
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.92)' : 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  // Layout/shape only — deliberately no backgroundColor here. This used to carry a
  // white tint and got applied to BOTH the GlassView and BlurView paths, which
  // painted a half-opaque white layer directly over the real native glass material
  // and masked its refraction entirely (that's why it read as a flat white pill
  // instead of glass). Each material now supplies its own translucency separately.
  bottomNavShape: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  // Was fontSize:10 / color:'#999999' — light gray at 10px is already borderline
  // low-contrast on a solid background; sitting on the semi-transparent glass pill
  // now makes it worse for anyone with reduced vision. Bumped size and switched to
  // the app's standard secondary-text gray (#666666, used everywhere else already)
  // for real contrast, not just a slightly bigger version of the same problem.
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
    marginTop: 3,
  },
  navLabelActive: {
    fontSize: 11,
    color: '#000000',
    marginTop: 3,
    fontWeight: 'bold',
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    backgroundColor: '#34C759',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 14,
  },
});
