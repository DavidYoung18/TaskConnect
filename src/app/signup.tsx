import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_LANGUAGE, LANGUAGES } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';

export default function SignupScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('customer');
  const [language, setLanguageField] = useState(DEFAULT_LANGUAGE);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const selectedLanguageLabel = LANGUAGES.find((l) => l.code === language)?.nativeName ?? 'English';

  async function handleSignup() {
    if (!name || !phone || !email || !password || !userType) {
      Alert.alert(t('alerts.fillAllFields'));
      return;
    }

    setIsLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', credential.user.uid), {
        name,
        phone,
        email,
        userType,
        language,
        createdAt: new Date().toISOString(),
      });
      router.replace(userType === 'provider' ? '/provider-onboarding-category' : '/home');
    } catch (error: any) {
      const messages: Record<string, string> = {
        'auth/email-already-in-use': t('alerts.emailAlreadyRegistered'),
        'auth/weak-password': t('alerts.weakPassword'),
        'auth/invalid-email': t('alerts.invalidEmail'),
      };
      Alert.alert(messages[error.code] ?? t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() && router.back()}>
            <Text style={styles.backButton}>← {t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('auth.createAccount')}</Text>
          <Text style={styles.subtitle}>{t('auth.joinLabbe')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>{t('auth.iAmA')}</Text>
          <View style={styles.userTypeContainer}>
            <TouchableOpacity
              style={[styles.userTypeButton, userType === 'customer' && styles.userTypeActive]}
              onPress={() => setUserType('customer')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={userType === 'customer' ? '#000000' : '#999999'}
              />
              <Text style={[styles.userTypeText, userType === 'customer' && styles.userTypeTextActive]}>
                {t('auth.customer')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.userTypeButton, userType === 'provider' && styles.userTypeActive]}
              onPress={() => setUserType('provider')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="briefcase-outline"
                size={20}
                color={userType === 'provider' ? '#000000' : '#999999'}
              />
              <Text style={[styles.userTypeText, userType === 'provider' && styles.userTypeTextActive]}>
                {t('auth.serviceProvider')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.name')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.enterFullName') ?? undefined}
              placeholderTextColor="#999999"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.phone')}</Text>
            <TextInput
              style={styles.input}
              placeholder="+998 XX XXX XX XX"
              placeholderTextColor="#999999"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.enterEmail') ?? undefined}
              placeholderTextColor="#999999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.createPassword') ?? undefined}
              placeholderTextColor="#999999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.languageRow}
            onPress={() => setShowLanguageSelector(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={20} color="#000000" style={styles.languageIcon} />
            <Text style={styles.languageLabel}>{t('auth.selectLanguage')}</Text>
            <View style={styles.languageValueRow}>
              <Text style={styles.languageValue}>{selectedLanguageLabel}</Text>
              <Ionicons name="chevron-forward" size={18} color="#999999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signupButton, isLoading && styles.signupButtonDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.signupButtonText}>{isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
        onSelect={setLanguageField}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 30,
  },
  backButton: {
    color: '#000000',
    fontSize: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 8,
  },
  form: {
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  userTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  userTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    backgroundColor: '#ffffff',
  },
  userTypeActive: {
    borderColor: '#000000',
    backgroundColor: '#f8f8f8',
  },
  // flexShrink: 1 is the actual fix — a Text sibling in a flex row doesn't shrink
  // below its own intrinsic (single-line) width by default in RN, so a long
  // translation (e.g. fr "Prestataire de services", uz "Xizmat ko'rsatuvchi") simply
  // overflowed the button's bounds rather than wrapping. This lets it wrap onto a
  // second line instead, matching the no-truncation/no-auto-shrink pattern used
  // elsewhere in this app; textAlign keeps a wrapped 2-line label centered under the
  // icon rather than ragged.
  userTypeText: {
    flexShrink: 1,
    textAlign: 'center',
    color: '#999999',
    fontSize: 14,
    fontWeight: '600',
  },
  userTypeTextActive: {
    color: '#000000',
  },
  inputContainer: {
    marginBottom: 20,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    marginBottom: 24,
    gap: 12,
  },
  languageIcon: {
    flexShrink: 0,
  },
  languageLabel: {
    flex: 1,
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  languageValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  languageValue: {
    color: '#666666',
    fontSize: 14,
  },
  label: {
    color: '#000000',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    color: '#000000',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  signupButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  signupButtonDisabled: {
    opacity: 0.4,
  },
  signupButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
