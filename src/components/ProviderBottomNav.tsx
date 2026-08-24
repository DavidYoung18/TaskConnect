import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassSurface from '@/components/GlassSurface';
import { subscribeToUnreadChatCount } from '@/lib/chats';
import { useAuthUser } from '@/lib/useAuthUser';

type Tab = 'home' | 'availability' | 'chat' | 'profile';

interface Props {
  activeTab: Tab;
}

// Mirrors CustomerBottomNav.tsx exactly (same floating-glass-pill mechanism via
// GlassSurface, same positioning math) — the provider app previously used Expo
// Router's native <Tabs> for its bottom bar (a docked, OS-rendered bar that can't be
// turned into a floating glass island via style props alone), so this replaces that
// entirely rather than restyling it. provider/(tabs)/_layout.tsx now renders a plain
// Stack instead of Tabs, and each of the 4 screens renders this component itself,
// the same way every customer screen renders CustomerBottomNav.
function ProviderBottomNav({ activeTab }: Props) {
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuthUser();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!user) return;
    return subscribeToUnreadChatCount(user.uid, 'provider', setUnreadCount);
  }, [user]);

  const badge = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <View style={[styles.floatingWrapper, { bottom: Math.max(insets.bottom - 20, 8) }]} pointerEvents="box-none">
      <View style={styles.pillShadow}>
        {/* tintColor/colorScheme pin the glass to one consistent light look —
            otherwise real Liquid Glass adapts to whatever's scrolled behind it,
            reading as fully dark in some spots and fully bright in others. A
            semi-transparent tint (vs. a solid "#ffffff") keeps that same
            consistent hue while still letting the real blur/refraction show
            through, so it reads as glass rather than a flat white pill. */}
        <GlassSurface style={styles.bottomNavShape} tintColor="rgba(255,255,255,0.45)" colorScheme="light">
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/provider/(tabs)/home')}
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
            onPress={() => router.push('/provider/(tabs)/availability')}
            disabled={activeTab === 'availability'}
          >
            <Ionicons
              name={activeTab === 'availability' ? 'calendar' : 'calendar-outline'}
              size={22}
              color={activeTab === 'availability' ? '#000000' : '#999999'}
            />
            <Text
              style={activeTab === 'availability' ? styles.navLabelActive : styles.navLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {t('provider.availability')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/provider/(tabs)/chat')}
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
              {t('nav.chat')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/provider/(tabs)/profile')}
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
        </GlassSurface>
      </View>
    </View>
  );
}

export default memo(ProviderBottomNav);

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pillShadow: {
    width: '100%',
    borderRadius: 32,
    // Android clips elevation shadows to a view's own bounds when that same view
    // also sets overflow:'hidden' (needed on bottomNavShape below for rounded
    // corners) — same split as CustomerBottomNav.tsx's pillShadow/bottomNavShape.
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.92)' : 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
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
  // Same accessibility fix as CustomerBottomNav.tsx — 10px/#999999 was low-contrast
  // even before the glass background, worse now that it's semi-transparent.
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
