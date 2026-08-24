import { useRef } from 'react';
import { Animated, Modal, PanResponder, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

interface FullScreenImageViewerProps {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

// Single gesture surface (no nested TouchableOpacity + PanResponder) handles both
// tap-to-dismiss and swipe-down-to-dismiss — deliberately avoiding the
// TouchableWithoutFeedback-wraps-a-competing-gesture pattern that caused the responder
// conflicts fixed elsewhere in this app (see provider/account-details.tsx history).
export default function FullScreenImageViewer({ visible, uri, onClose }: FullScreenImageViewerProps) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_event, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        const isTap = Math.abs(gesture.dy) < 10 && Math.abs(gesture.dx) < 10;
        const isSwipeDown = gesture.dy > 100;
        if (isTap || isSwipeDown) {
          translateY.setValue(0);
          onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        style={[styles.backdrop, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <Image source={{ uri }} style={styles.image} contentFit="contain" />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
