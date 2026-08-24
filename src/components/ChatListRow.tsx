import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

interface ChatListRowProps {
  name: string;
  photoURL?: string | null;
  categoryLabel?: string;
  preview: string;
  timestamp: string;
  unreadCount: number;
  onPress: () => void;
}

// Shared between the customer and provider chat lists (chat.tsx and
// provider/(tabs)/chat.tsx) — both showed the exact same row, copy-pasted, which is
// how it's drifted out of sync with app-wide styling before. One implementation
// means both screens redesign together instead of one getting fixed and the other
// quietly staying stale.
export default function ChatListRow({
  name,
  photoURL,
  categoryLabel,
  preview,
  timestamp,
  unreadCount,
  onPress,
}: ChatListRowProps) {
  const unread = unreadCount > 0;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarWrapper}>
        <View style={styles.avatar}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{initials(name)}</Text>
          )}
        </View>
        {unread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{badgeLabel}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.time}>{timestamp}</Text>
        </View>

        {categoryLabel && (
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{categoryLabel}</Text>
          </View>
        )}

        <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Card, not a flat divided row — a light border + gap between cards reads as
  // separate tappable units instead of one continuous list, and matches the card
  // pattern already used on bookings.tsx/provider home.tsx (white bg, 16 radius,
  // 1px #e8e8e8 border) for visual consistency across the app.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  // Slightly larger than the old 48px to balance the more generous card padding.
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Numeric badge, same visual convention as the tab-bar unread badge
  // (CustomerBottomNav.tsx) — green fill, bold white count, "9+" cap.
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#34C759',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 15,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  // Name is the most prominent element in the row — bold and largest — regardless
  // of read state, so hierarchy stays constant; unread is signaled by the dot and
  // the bolder/darker preview text instead of an extra name-weight toggle.
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  // Smallest, most muted text in the row — clearly secondary to everything else.
  time: {
    fontSize: 12,
    color: '#aaaaaa',
    flexShrink: 0,
  },
  // Category is rendered as a small tag/chip (uppercase, letter-spaced, pill
  // background) rather than another line of plain gray text — that gives it its
  // own distinct visual register instead of blending into the preview line below,
  // which stays a normal-weight sentence. Reuses the same small-pill language as
  // the status badges elsewhere in the app (e.g. bookings.tsx's statusBadge).
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#f2f2f2',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#777777',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Preview (last message, or a system status like "Completion request sent")
  // stays plain body text — the contrast with the chip above is what keeps the
  // two from reading as the same kind of information.
  preview: {
    fontSize: 14,
    color: '#777777',
  },
  previewUnread: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
});
