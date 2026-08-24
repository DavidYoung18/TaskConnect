import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/lib/firebase';
import LanguageSelector from '@/components/LanguageSelector';
import ProviderBottomNav from '@/components/ProviderBottomNav';

type Row = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  labelKey: string;
  onPress: () => void;
};

const rows: Row[] = [
  {
    icon: 'person-outline',
    labelKey: 'profileMenu.accountDetails',
    onPress: () => router.push('/provider/account-details'),
  },
  {
    icon: 'construct-outline',
    labelKey: 'provider.myServices',
    onPress: () => router.push('/provider/my-services'),
  },
  {
    icon: 'stats-chart-outline',
    labelKey: 'provider.performance',
    onPress: () => router.push('/provider/performance'),
  },
  {
    icon: 'help-circle-outline',
    labelKey: 'profileMenu.support',
    onPress: () => router.push('/support'),
  },
];

export default function ProfileTab() {
  const { t } = useTranslation();
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  async function handleLogOut() {
    await signOut(auth);
    router.dismissAll();
    router.replace('/login');
  }

  async function handleLanguageSelected(code: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid), { language: code });
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('profileMenu.title')}</Text>

        <Text style={styles.sectionHeader}>{t('profileMenu.accountInformationHeader')}</Text>
        <View style={styles.group}>
          {rows.map((row) => (
            <TouchableOpacity
              key={row.labelKey}
              style={[styles.row, styles.rowBorder]}
              onPress={row.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={row.icon} size={20} color="#666666" style={styles.rowIcon} />
              <Text style={styles.rowLabel}>{t(row.labelKey)}</Text>
              <Ionicons name="chevron-forward" size={18} color="#cccccc" />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowLanguageSelector(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={20} color="#666666" style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{t('profileMenu.language')}</Text>
            <Ionicons name="chevron-forward" size={18} color="#cccccc" />
          </TouchableOpacity>
        </View>

        <View style={styles.group}>
          <TouchableOpacity style={styles.row} onPress={handleLogOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color="#f44336" style={styles.rowIcon} />
            <Text style={styles.logoutLabel}>{t('profileMenu.signOut')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ProviderBottomNav activeTab="profile" />

      <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
        onSelect={handleLanguageSelected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 0.8,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  group: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e8e8e8',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowIcon: {
    marginRight: 14,
    width: 22,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  logoutLabel: {
    flex: 1,
    fontSize: 16,
    color: '#f44336',
    fontWeight: '500',
  },
});
