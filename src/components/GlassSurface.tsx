import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { ReactNode } from 'react';
import { Platform, StyleProp, StyleSheet, ViewStyle } from 'react-native';

// Shared by CustomerBottomNav's floating pill and any other "real liquid glass, with
// a sane fallback everywhere else" surface (e.g. the Book Now button on home.tsx's
// popular-services feed) — one place deciding which material renders, so the two
// don't drift into separately-tuned copies of the same isLiquidGlassAvailable()
// branch. See expo-glass-effect's README: real Liquid Glass only exists on iOS 26+;
// GlassView silently no-ops to a plain View everywhere else, which would look worse
// than the BlurView fallback this app already had — hence branching here instead of
// just always rendering GlassView.
const useRealLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

interface GlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  isInteractive?: boolean;
  // Real Liquid Glass is adaptive by default — it samples whatever's behind it and
  // shifts its own tone to match (that's the point of it on the bottom nav, which
  // floats over constantly-changing page content). The Book Now pills on home.tsx
  // sit over photos with very different brightness levels, so left adaptive they
  // rendered as visibly different colors card to card. Pass tintColor/colorScheme to
  // pin the glass to one consistent look instead of letting it react to content.
  tintColor?: string;
  colorScheme?: 'auto' | 'light' | 'dark';
}

export default function GlassSurface({ style, children, isInteractive = true, tintColor, colorScheme }: GlassSurfaceProps) {
  if (useRealLiquidGlass) {
    // No backgroundColor gets layered on here — that's exactly what previously
    // masked the native glass refraction (see CustomerBottomNav's fix). Let the
    // material render untouched.
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={isInteractive}
        tintColor={tintColor}
        colorScheme={colorScheme}
        style={style}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView intensity={65} tint="light" style={[style, styles.blurTint]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  // Much lighter than a flat white fill so the blurred content behind still reads as
  // blur, not just a wash of white. Android's BlurView doesn't reliably blur without
  // experimentalBlurMethod, so it gets a more opaque fallback tint instead of trying
  // (and failing) to look glassy there.
  blurTint: {
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.18)',
  },
});
