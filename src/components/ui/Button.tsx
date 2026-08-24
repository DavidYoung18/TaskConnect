import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, radius, spacing, type } from '@/lib/theme';

type Variant = 'primary' | 'outlineDanger';
type Size = 'default' | 'small';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode; // leading icon, e.g. a chat-bubble Ionicon
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Replaces the 31+ separately-defined "black button" / "red outline button" style
// blocks found across the app (some files, like addresses.tsx, defined the same
// primary button 3 times over) with one component. Two variants cover what's
// actually in use today — primary (solid black) and outlineDanger (the
// logout/cancel pattern) — rather than trying to anticipate every future variant.
export default function Button({ title, onPress, variant = 'primary', size = 'default', icon, disabled, style }: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.outlineDanger,
        size === 'small' && styles.small,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {icon}
      <Text style={[styles.text, isPrimary ? styles.primaryText : styles.outlineDangerText, size === 'small' && styles.smallText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primary: {
    backgroundColor: colors.ink,
  },
  outlineDanger: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: type.body + 1,
    fontWeight: '700',
  },
  smallText: {
    fontSize: type.bodySmall,
    fontWeight: '600',
  },
  primaryText: {
    color: colors.surface,
  },
  outlineDangerText: {
    color: colors.danger,
  },
});
