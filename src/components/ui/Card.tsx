import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  muted?: boolean; // surfaceMuted background instead of white — matches profile.tsx's stat tiles
}

// Replaces the ~15 near-identical "white/light card, border, radius 12-16, padding
// 16" style blocks scattered across the app (bookingCard, statCard, menuItem, etc.)
// with one component using the same token every time. Intentionally minimal props —
// this isn't trying to cover every card variant in the app, just the plain
// bordered-container shape that shows up over and over.
export default function Card({ children, style, muted = false }: CardProps) {
  return <View style={[styles.card, muted && styles.muted, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
  },
});
