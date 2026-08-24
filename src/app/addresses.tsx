import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Address,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
} from '@/lib/addresses';
import { useAuthUser } from '@/lib/useAuthUser';

export default function AddressesScreen() {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuthUser();
  const uid = user?.uid;

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      getAddresses(uid)
        .then(setAddresses)
        .finally(() => setLoading(false));
    }, [uid])
  );

  async function handleSetDefault(addressId: string) {
    if (!uid) return;
    await setDefaultAddress(uid, addressId);
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, isDefault: a.id === addressId }))
    );
  }

  function handleDelete(addressId: string) {
    Alert.alert(t('alerts.deleteAddressTitle'), t('alerts.deleteAddressMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!uid) return;
          await deleteAddress(uid, addressId);
          setAddresses((prev) => prev.filter((a) => a.id !== addressId));
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() && router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('addressesScreen.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {loading && (
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        )}
        {!loading && addresses.length === 0 && (
          <Text style={styles.emptyText}>{t('addressesScreen.noSavedAddresses')}</Text>
        )}
        {addresses.map((address) => (
          <TouchableOpacity
            key={address.id}
            style={[styles.card, address.isDefault && styles.cardDefault]}
            onPress={() => router.push(`/add-address?id=${address.id}`)}
            activeOpacity={0.7}
          >
            <TouchableOpacity
              style={styles.radioButton}
              onPress={() => handleSetDefault(address.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {address.isDefault ? (
                <View style={styles.radioFilled}>
                  <View style={styles.radioDot} />
                </View>
              ) : (
                <View style={styles.radioEmpty} />
              )}
            </TouchableOpacity>
            <View style={styles.cardLeft}>
              <View style={styles.cardLabelRow}>
                <Text style={styles.label}>{address.label}</Text>
                {address.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>{t('addressesScreen.defaultBadge')}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.fullAddress}>{address.fullAddress}</Text>
            </View>
            <View style={styles.cardRight}>
              <TouchableOpacity
                onPress={() => handleDelete(address.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={20} color="#f44336" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/add-address')}>
        <Ionicons name="add" size={22} color="#ffffff" />
        <Text style={styles.addButtonText}>{t('addressesScreen.addAddress')}</Text>
      </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 14,
  },
  backButton: {
    padding: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  list: {
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#999999',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  cardDefault: {
    borderColor: '#000000',
    backgroundColor: '#f8f8f8',
  },
  cardLeft: {
    flex: 1,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  defaultBadge: {
    backgroundColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  fullAddress: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  radioButton: {
    marginRight: 12,
  },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cccccc',
  },
  radioFilled: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
  },
  addButton: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
