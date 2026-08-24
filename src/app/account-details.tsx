import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthUser } from '@/lib/useAuthUser';

// Customer counterpart to provider/account-details.tsx. All three fields are currently
// read-only (name, email, and — per updated decision — phone too), pending phone/email
// re-verification via SMS codes being built later. No avatar/photo section here: customer
// photo upload isn't a planned feature. No default-address section either — that's already
// owned by the dedicated addresses.tsx screen, reachable from booking-review.tsx.
export default function CustomerAccountDetailsScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuthUser();

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const uid = user?.uid;
    if (!uid) return;

    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      setName(data.name ?? '');
      setEmail(data.email ?? '');
      setPhone(data.phone ?? '');
    }

    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profileMenu.accountDetails')}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        ) : (
          <>
            {/* Name — read-only */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('auth.name')}</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyValue}>{name}</Text>
              </View>
              <Text style={styles.fieldHint}>{t('accountDetailsScreen.nameVerifiedHint')}</Text>
            </View>

            {/* Email — read-only */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyValue}>{email}</Text>
              </View>
              <Text style={styles.fieldHint}>{t('accountDetailsScreen.emailChangeHint')}</Text>
            </View>

            {/* Phone — read-only */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('accountDetailsScreen.phone')}</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyValue}>{phone}</Text>
              </View>
              <Text style={styles.fieldHint}>{t('accountDetailsScreen.phoneVerifiedHint')}</Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  scrollContent: {
    padding: 24,
  },
  loadingText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 15,
    marginTop: 48,
  },
  field: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 12,
    color: '#999999',
    marginTop: 6,
  },
  readonlyBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readonlyValue: {
    fontSize: 16,
    color: '#444444',
  },
});
