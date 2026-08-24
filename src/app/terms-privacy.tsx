import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TERMS_ENTRIES = Array.from({ length: 10 }, (_, i) => i + 1);
const PRIVACY_ENTRIES = Array.from({ length: 6 }, (_, i) => i + 1);

export default function TermsPrivacyScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
          <Text style={styles.backButton}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('termsScreen.title')}</Text>
        <Text style={styles.lastUpdated}>{t('termsScreen.lastUpdated')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeading}>{t('termsScreen.termsHeading')}</Text>
        {TERMS_ENTRIES.map((n) => (
          <View key={`terms-${n}`} style={styles.entry}>
            <Text style={styles.entryTitle}>{t(`termsScreen.terms${n}Title`)}</Text>
            <Text style={styles.entryBody}>{t(`termsScreen.terms${n}Body`)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionHeading}>{t('termsScreen.privacyHeading')}</Text>
        {PRIVACY_ENTRIES.map((n) => (
          <View key={`privacy-${n}`} style={styles.entry}>
            <Text style={styles.entryTitle}>{t(`termsScreen.privacy${n}Title`)}</Text>
            <Text style={styles.entryBody}>{t(`termsScreen.privacy${n}Body`)}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backButton: {
    color: '#000000',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  lastUpdated: {
    fontSize: 13,
    color: '#999999',
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  entry: {
    marginBottom: 20,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
  },
  entryBody: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: '#e8e8e8',
    marginVertical: 12,
  },
});
