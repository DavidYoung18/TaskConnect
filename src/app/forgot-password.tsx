import { sendPasswordResetEmail } from 'firebase/auth';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { auth } from '@/lib/firebase';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { email: prefilledEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSendResetLink() {
    if (!email) {
      Alert.alert(t('alerts.fillAllFields'));
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      // auth/user-not-found is deliberately NOT surfaced as its own message — doing
      // so would let this screen be used to check which emails have an account here
      // (an enumeration leak). Every outcome except a malformed email or genuine rate
      // limit shows the same "check your email" message regardless of whether an
      // account actually exists.
      if (error.code === 'auth/invalid-email') {
        Alert.alert(t('alerts.invalidEmail'));
        setIsLoading(false);
        return;
      }
      if (error.code === 'auth/too-many-requests') {
        Alert.alert(t('alerts.tooManyAttempts'));
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(false);
    Alert.alert(
      t('alerts.resetLinkSentTitle'),
      t('alerts.resetLinkSentMessage', { email }),
      [{ text: t('common.ok'), onPress: () => router.canGoBack() && router.back() }],
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() && router.back()}>
            <Text style={styles.backButton}>← {t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('auth.resetPasswordTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.resetPasswordSubtitle')}</Text>
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
              autoFocus
            />
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSendResetLink} disabled={isLoading}>
            <Text style={styles.submitButtonText}>
              {isLoading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.canGoBack() && router.back()}
          >
            <Text style={styles.backLinkText}>{t('auth.backToLogin')}</Text>
          </TouchableOpacity>
        </View>
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
    lineHeight: 22,
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
  submitButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  backLinkText: {
    color: '#666666',
    fontSize: 14,
  },
});
