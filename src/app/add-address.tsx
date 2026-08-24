import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Region } from 'react-native-maps';
import { auth } from '@/lib/firebase';
import { addAddress, getAddress, updateAddress } from '@/lib/addresses';
import { useAuthUser } from '@/lib/useAuthUser';
import GlassSurface from '@/components/GlassSurface';

const TASHKENT = { latitude: 41.2995, longitude: 69.2401 };

export default function AddAddressScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const insets = useSafeAreaInsets();

  const [label, setLabel] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [coordinate, setCoordinate] = useState(TASHKENT);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const { user } = useAuthUser();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!isEditing || !user) return;
    getAddress(user.uid, id).then((address) => {
      if (!address) return;
      setLabel(address.label);
      setFullAddress(address.fullAddress);
      const coord = { latitude: address.latitude, longitude: address.longitude };
      setCoordinate(coord);
      // initialRegion only applies once, at first mount — this data loads asynchronously
      // after that, so without an explicit animateToRegion the map would stay centered on
      // the hardcoded Tashkent default while the pin (now fixed to screen-center, see
      // below) silently disagreed with the saved coordinate until the user panned.
      mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    });
  }, [id, isEditing, user]);

  async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=AIzaSyBGLbXVN98bZREC965p5IKVgiSQaOVgSzw`
      );
      const json = await res.json();
      return json.results?.[0]?.formatted_address ?? null;
    } catch {
      return null;
    }
  }

  async function updateCoordinate(coord: { latitude: number; longitude: number }) {
    setCoordinate(coord);
    setIsGeocoding(true);
    const address = await reverseGeocode(coord.latitude, coord.longitude);
    if (address) setFullAddress(address);
    setIsGeocoding(false);
  }

  // The pin is a fixed overlay at the exact center of the screen — the user repositions
  // it by panning the MAP underneath instead of dragging a marker (the standard
  // Uber/Yandex Go/Bolt pattern, and what the rest of this app's floating-island visual
  // language already primes users to expect). This fires once per pan/zoom gesture, not
  // per-frame, so it's not spamming the geocoding API while dragging.
  function handleRegionChangeComplete(region: Region) {
    updateCoordinate({ latitude: region.latitude, longitude: region.longitude });
  }

  async function handleUseCurrentLocation() {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('addAddressScreen.locationPermissionDeniedTitle'),
          t('addAddressScreen.locationPermissionDeniedMessage'),
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coord = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      // Just pan the map — handleRegionChangeComplete fires once the animation settles
      // and takes care of the coordinate/geocode update, so this doesn't double-fetch.
      mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    } catch {
      Alert.alert(t('alerts.errorTitle'), t('common.error'));
    } finally {
      setIsLocating(false);
    }
  }

  async function handleSave() {
    if (!label || !fullAddress) {
      Alert.alert(t('alerts.fillAllFields'));
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setIsLoading(true);
    try {
      if (isEditing) {
        await updateAddress(uid, id, {
          label,
          fullAddress,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      } else {
        await addAddress(uid, {
          label,
          fullAddress,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          isDefault: false,
        });
      }
      router.back();
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: TASHKENT.latitude,
          longitude: TASHKENT.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
      />

      {/* Fixed center pin — the map moves underneath it, it never moves itself. Offset
          up by half its own height so the glyph's point (not its visual center) lands
          exactly on the screen's center, which is what onRegionChangeComplete reports. */}
      <View style={styles.centerPinWrap} pointerEvents="none">
        {/* White halo behind the pin's round head so it stays visible against both
            light and dark map styles (MapKit switches automatically with the OS
            appearance) — a flat-colored pin alone nearly disappeared on a dark map. */}
        <View style={styles.centerPinHalo} />
        <Ionicons name="location" size={44} color="#e11d33" style={styles.centerPin} />
        <View style={styles.centerPinShadow} />
      </View>

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <GlassSurface style={styles.backButtonShape} tintColor="rgba(255,255,255,0.55)" colorScheme="light">
          <TouchableOpacity
            onPress={() => router.canGoBack() && router.back()}
            style={styles.backButtonHit}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#000000" />
          </TouchableOpacity>
        </GlassSurface>
        <GlassSurface style={styles.hintPill} tintColor="rgba(255,255,255,0.55)" colorScheme="light">
          <Text style={styles.hintText} numberOfLines={2}>{t('addAddressScreen.mapHint')}</Text>
        </GlassSurface>
      </View>

      <TouchableOpacity
        style={[styles.locateFab, { bottom: 226 + insets.bottom }]}
        onPress={handleUseCurrentLocation}
        disabled={isLocating}
        activeOpacity={0.8}
      >
        <GlassSurface style={styles.locateFabShape} tintColor="rgba(255,255,255,0.7)" colorScheme="light">
          {isLocating ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Ionicons name="locate" size={20} color="#000000" />
          )}
        </GlassSurface>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={[styles.bottomSheetWrap, { bottom: Math.max(insets.bottom - 8, 0) }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <GlassSurface style={styles.bottomSheetShape} tintColor="rgba(255,255,255,0.65)" colorScheme="light">
          <View style={styles.bottomSheet}>
            <View style={styles.inputContainer}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>{t('addAddressScreen.fullAddress')}</Text>
                {isGeocoding && <Text style={styles.geocodingHint}>{t('addAddressScreen.findingAddress')}</Text>}
              </View>
              <TextInput
                style={styles.input}
                placeholder={t('addAddressScreen.fullAddressPlaceholder') ?? undefined}
                placeholderTextColor="#999999"
                value={fullAddress}
                onChangeText={setFullAddress}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('addAddressScreen.label')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('addAddressScreen.labelPlaceholder') ?? undefined}
                placeholderTextColor="#999999"
                value={label}
                onChangeText={setLabel}
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isLoading}>
              <Text style={styles.saveButtonText}>{isLoading ? t('common.saving') : isEditing ? t('common.saveChanges') : t('addAddressScreen.saveAddress')}</Text>
            </TouchableOpacity>
          </View>
        </GlassSurface>
      </KeyboardAvoidingView>
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -22,
    marginTop: -44,
    alignItems: 'center',
  },
  centerPinHalo: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
  },
  centerPin: {
    zIndex: 1,
  },
  centerPinShadow: {
    width: 8,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: -2,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButtonShape: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  backButtonHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintPill: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  locateFab: {
    position: 'absolute',
    right: 16,
  },
  locateFabShape: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  bottomSheetShape: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  bottomSheet: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 10,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  geocodingHint: {
    color: '#999999',
    fontSize: 11,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#000000',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  saveButton: {
    backgroundColor: '#000000',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
