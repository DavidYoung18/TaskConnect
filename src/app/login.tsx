import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/lib/firebase';
import { LANGUAGES } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const selectedLanguageLabel = LANGUAGES.find((l) => l.code === i18n.language)?.nativeName ?? 'English';

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('alerts.fillAllFields'));
      return;
    }

    setIsLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', credential.user.uid));
      const data = snap.data();
      const userType = data?.userType;
      if (userType === 'provider') {
        router.replace(data?.onboardingComplete === true ? '/provider/(tabs)/home' : '/provider-onboarding-category');
      } else {
        router.replace('/home');
      }
    } catch (error: any) {
      const messages: Record<string, string> = {
        'auth/invalid-credential': t('alerts.incorrectCredentials'),
        'auth/wrong-password': t('alerts.incorrectCredentials'),
        'auth/user-not-found': t('alerts.noAccountFound'),
        'auth/invalid-email': t('alerts.invalidEmail'),
        'auth/too-many-requests': t('alerts.tooManyAttempts'),
      };
      Alert.alert(messages[error.code] ?? t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        {/* Accessible immediately, before any sign-in/sign-up action — same
            LanguageSelector modal/mechanism already used in profile settings and on
            the signup form, not a separate implementation. Placed in the top row
            rather than buried further down the form, so it reads as a global choice
            made up front rather than a signup-specific field. */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.canGoBack() && router.back()}>
            <Text style={styles.backButton}>← {t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.languagePill}
            onPress={() => setShowLanguageSelector(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={16} color="#000000" />
            <Text style={styles.languagePillText}>{selectedLanguageLabel}</Text>
            <Ionicons name="chevron-down" size={14} color="#999999" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
        <Text style={styles.subtitle}>{t('auth.signInToAccount')}</Text>
      </View>

      <View style={styles.form}>
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
            placeholder={t('auth.enterPassword') ?? undefined}
            placeholderTextColor="#999999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.forgotPassword}
          onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
        >
          <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isLoading}>
          <Text style={styles.loginButtonText}>{isLoading ? t('auth.signingIn') : t('auth.signIn')}</Text>
        </TouchableOpacity>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>{t('auth.noAccount')} </Text>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={styles.signupLink}>{t('auth.signup')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
      />
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
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
    paddingBottom: 40,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    color: '#000000',
    fontSize: 16,
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  languagePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
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
  },
  inputContainer: {
    marginBottom: 20,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: '#000000',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  signupText: {
    color: '#666666',
    fontSize: 14,
  },
  signupLink: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
  },
});