import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LANGUAGES, setLanguage } from '@/lib/i18n';

interface LanguageSelectorProps {
  visible: boolean;
  onClose: () => void;
  // Fires after the language has already been applied locally (SecureStore + i18next),
  // so callers can additionally persist it (e.g. to the user's Firestore doc).
  onSelect?: (code: string) => void;
}

export default function LanguageSelector({ visible, onClose, onSelect }: LanguageSelectorProps) {
  const { i18n, t } = useTranslation();

  async function handleSelect(code: string) {
    await setLanguage(code);
    onSelect?.(code);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.selectLanguage')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#000000" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {LANGUAGES.map((lang, index) => {
              const isActive = i18n.language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.row, index < LANGUAGES.length - 1 && styles.rowBorder]}
                  onPress={() => handleSelect(lang.code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.nativeName}>{lang.nativeName}</Text>
                    <Text style={styles.englishName}>{lang.englishName}</Text>
                  </View>
                  {isActive && <Ionicons name="checkmark" size={20} color="#000000" />}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  list: {
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowText: {
    flexDirection: 'column',
  },
  nativeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  englishName: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
});
