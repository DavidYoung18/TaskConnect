import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LANGUAGES } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';

const ROOF_WIDTH = 308;
const ROOF_HEIGHT = 100;
const WORDMARK_WIDTH = 240;
const WORDMARK_HEIGHT = 66;

// Both reveals use the same trick: the image itself never moves and is always fully
// opaque. A "curtain" — a gradient rectangle three times the image's width, with a
// wide SOFT black<->transparent transition band in its middle third, not a hard
// edge — slides across on top of it. Because the transition band is wide and blurry,
// the image looks like it's gradually being lit up from one side rather than wiped
// or drawn on. See buildCurtainStyle below for the shared math.
const CURTAIN_STOPS = [0, 0.35, 0.65, 1] as const;

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  // The Start button/language pill only fade in once the logo animation has actually
  // settled (see the withTiming completion callback below) — not on a guessed
  // timeout, so this stays correct even if the reveal timing changes later.
  const [showControls, setShowControls] = useState(false);

  const selectedLanguageLabel = LANGUAGES.find((l) => l.code === i18n.language)?.nativeName ?? 'English';

  // Wordmark's curtain starts fully covering it (curtainX = -2 * WORDMARK_WIDTH puts
  // the image's window inside the curtain's opaque-black plateau) and ends fully off
  // it (curtainX = 0 puts the window inside the transparent plateau) — see the note
  // above CURTAIN_STOPS for why those specific multiples of the width work out.
  const wordmarkCurtainX = useSharedValue(-2 * WORDMARK_WIDTH);
  // Roofline reveals in the opposite screen direction (right-to-left), which — given
  // the curtain always travels the same way relative to ITS OWN gradient — just means
  // using the reversed gradient (black and transparent swapped) with the mirrored
  // start/end (0 -> -2 * ROOF_WIDTH instead of the wordmark's -2W -> 0).
  const roofCurtainX = useSharedValue(0);
  // Plain, fast opacity fade — no bounce/spring and no position movement, unlike the
  // slow logo reveal above.
  const controlsOpacity = useSharedValue(0);

  useEffect(() => {
    const slowEase = Easing.out(Easing.cubic);
    const roofRevealDelay = 800;
    const roofRevealDuration = 2400;

    // Wordmark reveals left-to-right first, slowly...
    wordmarkCurtainX.value = withTiming(0, { duration: 2400, easing: slowEase });

    // ...then, once it's most of the way in, the roofline reveals right-to-left the
    // same way — its own speed is untouched here.
    roofCurtainX.value = withDelay(
      roofRevealDelay,
      withTiming(-2 * ROOF_WIDTH, { duration: roofRevealDuration, easing: slowEase }),
    );

    // The Start button/language pill used to wait for the roof animation's own
    // "finished" callback — but an ease-out curve spends its last stretch on motion
    // that's already visually imperceptible, so that made the buttons feel like they
    // were lagging well after the reveal actually looked done. Triggering them at
    // ~65% of the roof's timeline (already >95% visually revealed by then, per the
    // cubic ease-out math) closes that gap without changing the reveal's own pace.
    const controlsDelay = roofRevealDelay + Math.round(roofRevealDuration * 0.65);
    const timer = setTimeout(() => setShowControls(true), controlsDelay);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showControls) return;
    controlsOpacity.value = withTiming(1, { duration: 300 });
  }, [showControls]);

  const wordmarkCurtainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: wordmarkCurtainX.value }],
  }));
  const roofCurtainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: roofCurtainX.value }],
  }));
  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* The very first screen in the app — language selection lives here (not just
          on login.tsx) so it's available before the user has made any choice at all.
          Same LanguageSelector modal/mechanism as everywhere else it appears
          (profile settings, login, signup) — nothing new built. */}
      <Animated.View style={[styles.languagePillWrap, controlsStyle]} pointerEvents={showControls ? 'auto' : 'none'}>
        <TouchableOpacity
          style={styles.languagePill}
          onPress={() => setShowLanguageSelector(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={16} color="#000000" />
          <Text style={styles.languagePillText}>{selectedLanguageLabel}</Text>
          <Ionicons name="chevron-down" size={14} color="#666666" />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.centerBlock}>
        <View style={styles.logoContainer}>
          {/* Roofline and wordmark are two separate cropped assets (split from the same
              source logo, see assets/images/splash-roof.png / splash-wordmark.png) so
              they can reveal independently. Neither image ever moves — each sits in a
              fixed, overflow:hidden window exactly its own size, with the sliding
              gradient curtain clipped to that same window on top of it. */}
          <View style={styles.roofWindow}>
            <Image
              source={require('../../assets/images/splash-roof.png')}
              style={styles.roofImage}
              resizeMode="contain"
            />
            <Animated.View style={[styles.roofCurtain, roofCurtainStyle]} pointerEvents="none">
              <LinearGradient
                colors={['#000000', '#000000', 'transparent', 'transparent']}
                locations={CURTAIN_STOPS}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>
          <View style={styles.wordmarkWindow}>
            <Image
              source={require('../../assets/images/splash-wordmark.png')}
              style={styles.wordmarkImage}
              resizeMode="contain"
            />
            <Animated.View style={[styles.wordmarkCurtain, wordmarkCurtainStyle]} pointerEvents="none">
              <LinearGradient
                colors={['transparent', 'transparent', '#000000', '#000000']}
                locations={CURTAIN_STOPS}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>
          <Animated.Text style={[styles.tagline, controlsStyle]}>{t('auth.welcomeTagline')}</Animated.Text>
        </View>
      </View>

      {/* Single entry point, now routed to Login by default — new users reach
          signup.tsx via the subtle text link at the bottom of login.tsx
          ("Don't have an account? Sign up"). */}
      <Animated.View style={[styles.buttonContainer, controlsStyle]} pointerEvents={showControls ? 'auto' : 'none'}>
        <View style={styles.primaryButtonShadowWrap}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/login')} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>{t('auth.getStarted')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  languagePillWrap: {
    position: 'absolute',
    top: 60,
    right: 24,
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  languagePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  // Takes all the space above the button and centers the logo block within it, so the
  // logo stays vertically centered in the remaining area while the button anchors to
  // the bottom instead of the whole group being centered as one unit.
  centerBlock: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  roofWindow: {
    width: ROOF_WIDTH,
    height: ROOF_HEIGHT,
    overflow: 'hidden',
  },
  roofImage: {
    width: ROOF_WIDTH,
    height: ROOF_HEIGHT,
  },
  roofCurtain: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ROOF_WIDTH * 3,
    height: ROOF_HEIGHT,
  },
  wordmarkWindow: {
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
    marginTop: -4,
    overflow: 'hidden',
  },
  wordmarkImage: {
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
  },
  wordmarkCurtain: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WORDMARK_WIDTH * 3,
    height: WORDMARK_HEIGHT,
  },
  tagline: {
    fontSize: 15,
    color: '#aaaaaa',
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 70,
    paddingBottom: 60,
    gap: 15,
  },
  primaryButtonShadowWrap: {
    borderRadius: 24,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
