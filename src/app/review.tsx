import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function ReviewScreen() {
  const { t } = useTranslation();
  const { bookingId, providerId, providerName: encodedName } =
    useLocalSearchParams<{ bookingId: string; providerId: string; providerName: string }>();
  const providerName = decodeURIComponent(encodedName ?? '');

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (rating === 0 || isSubmitting) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setIsSubmitting(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      const customerName = userSnap.exists() ? ((userSnap.data().name as string) ?? '') : '';

      await addDoc(collection(db, 'reviews'), {
        bookingId,
        providerId,
        customerId: uid,
        customerName,
        rating,
        reviewText: reviewText.trim() || null,
        createdAt: new Date().toISOString(),
      });

      Alert.alert(t('alerts.reviewThankYouTitle'), t('alerts.reviewThankYouMessage'), [
        { text: t('common.ok'), onPress: () => router.replace('/home') },
      ]);
    } catch {
      Alert.alert(t('alerts.errorTitle'), t('alerts.reviewSubmitError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('review.ratePrefix')} {providerName}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Stars */}
        <View style={styles.starsSection}>
          <Text style={styles.starsLabel}>
            {rating === 0
              ? t('review.tapToRate')
              : rating === 5
                ? t('review.excellent')
                : rating === 4
                  ? t('review.veryGood')
                  : rating === 3
                    ? t('review.good')
                    : rating === 2
                      ? t('review.fair')
                      : t('review.poor')}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setRating(n)}
                activeOpacity={0.7}
                style={styles.starButton}
              >
                <Ionicons
                  name={n <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={n <= rating ? '#F5A623' : '#CCCCCC'}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Written review */}
        <View style={styles.textSection}>
          <Text style={styles.textLabel}>{t('review.writtenReview')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={`${t('review.shareExperiencePrefix')} ${providerName} (optional)`}
            placeholderTextColor="#999999"
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>{reviewText.length}/1000</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (rating === 0 || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={rating === 0 || isSubmitting}
          activeOpacity={0.85}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? t('common.submitting') : t('review.submitReview')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    gap: 14,
  },
  backButton: {
    padding: 2,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  starsSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  starsLabel: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 16,
    fontWeight: '500',
    minHeight: 20,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  textSection: {
    marginBottom: 8,
  },
  textLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000000',
    minHeight: 120,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 12,
    color: '#bbbbbb',
    textAlign: 'right',
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  submitButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
