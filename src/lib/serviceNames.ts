import type { Booking } from '@/lib/bookings';

// Maps stable Firestore category/sub-service IDs to translation keys, so that
// catalog names (which are stored as plain English strings in Firestore) can be
// displayed in the user's selected language. Falls back to the raw Firestore
// name for any ID not in these maps (legacy/custom data).

export const CATEGORY_NAME_KEYS: Record<string, string> = {
  cleaning: 'categories.cleaning',
  plumbing: 'categories.plumbing',
  electrical: 'categories.electrical',
  'carpet-wash': 'categories.carpetWash',
  'tv-mounting': 'categories.tvMounting',
  'deep-clean': 'categories.deepClean',
  painting: 'categories.painting',
  furniture: 'categories.furniture',
  ac: 'categories.ac',
  'curtain-cleaning': 'categories.curtainCleaning',
};

export const SUBSERVICE_NAME_KEYS: Record<string, string> = {
  'blockage-drainage-removal': 'subServices.blockageDrainageRemoval',
  'leakage-repair': 'subServices.leakageRepair',
  'toilet-repair-installation': 'subServices.toiletRepairInstallation',
  'tap-mixer-repair-installation': 'subServices.tapMixerRepairInstallation',
  'jet-spray-installation': 'subServices.jetSprayInstallation',
  'geyser-installation': 'subServices.geyserInstallation',
  'chandelier-lights': 'subServices.chandelierLights',
  'switch-socket': 'subServices.switchSocket',
  wiring: 'subServices.wiring',
  'bulb-tube-lights': 'subServices.bulbTubeLights',
  'electrical-panel': 'subServices.electricalPanel',
  'ev-charger-installation': 'subServices.evChargerInstallation',
  'ac-repair': 'subServices.acRepair',
  'ac-installation': 'subServices.acInstallation',
  'ac-replacement': 'subServices.acReplacement',
  'tv-32': 'subServices.tv32',
  'tv-43': 'subServices.tv43',
  'tv-55': 'subServices.tv55',
  'tv-65': 'subServices.tv65',
  'tv-75': 'subServices.tv75',
  'tv-85': 'subServices.tv85',
  'tv-100': 'subServices.tv100',
  hourly: 'subServices.hourlyBooking',
};

export const CATEGORY_DESCRIPTION_KEYS: Record<string, string> = {
  cleaning: 'categoryDescriptions.cleaning',
  plumbing: 'categoryDescriptions.plumbing',
  electrical: 'categoryDescriptions.electrical',
  'carpet-wash': 'categoryDescriptions.carpetWash',
  'tv-mounting': 'categoryDescriptions.tvMounting',
  'deep-clean': 'categoryDescriptions.deepClean',
  painting: 'categoryDescriptions.painting',
  furniture: 'categoryDescriptions.furniture',
  ac: 'categoryDescriptions.ac',
  'curtain-cleaning': 'categoryDescriptions.curtainCleaning',
};

export function getCategoryNameKey(categoryId: string): string | undefined {
  return CATEGORY_NAME_KEYS[categoryId];
}

export function getCategoryDescriptionKey(categoryId: string): string | undefined {
  return CATEGORY_DESCRIPTION_KEYS[categoryId];
}

export function getSubServiceNameKey(subServiceId: string): string | undefined {
  return SUBSERVICE_NAME_KEYS[subServiceId];
}

// Cleaning-company bookings don't have a subServiceId — they're described by the
// intake wizard's fields instead, so those need their own ID→key maps.
export const SPACE_TYPE_KEYS: Record<string, string> = {
  apartment: 'cleaningIntake.apartment',
  house: 'cleaningIntake.house',
  commercial: 'cleaningIntake.commercial',
};

export function getSpaceTypeKey(spaceType: string): string | undefined {
  return SPACE_TYPE_KEYS[spaceType];
}

export const BATHROOM_COUNT_KEYS: Record<string, string> = {
  none: 'cleaningIntake.bathroomsNone',
};

export function getBathroomCountLabel(bathroomCount: string, t: (key: string) => string): string {
  const key = BATHROOM_COUNT_KEYS[bathroomCount];
  return key ? t(key) : bathroomCount;
}

export const CLEANING_TYPE_KEYS: Record<string, string> = {
  regular: 'cleaningIntake.regularCleaning',
  deep: 'cleaningIntake.deepCleaning',
  'post-construction': 'cleaningIntake.postConstructionCleaning',
};

export function getCleaningTypeKey(cleaningType: string): string | undefined {
  return CLEANING_TYPE_KEYS[cleaningType];
}

export const TOOLS_OPTION_KEYS: Record<string, string> = {
  'customer-provides': 'cleaningIntake.customerProvidesTools',
  'company-provides': 'cleaningIntake.companyProvidesTools',
};

export function getToolsOptionKey(toolsOption: string): string | undefined {
  return TOOLS_OPTION_KEYS[toolsOption];
}

// Short variants for single-line summary rows (booking-review.tsx) — the full sentences
// above read naturally as wizard option cards but wrap to 2-3 lines in a tight row, which
// breaks the single-line rhythm every other row in the same list keeps.
export const TOOLS_OPTION_SHORT_KEYS: Record<string, string> = {
  'customer-provides': 'cleaningIntake.customerProvidesToolsShort',
  'company-provides': 'cleaningIntake.companyProvidesToolsShort',
};

export function getToolsOptionShortKey(toolsOption: string): string | undefined {
  return TOOLS_OPTION_SHORT_KEYS[toolsOption];
}

// TV mounting bookings don't have a subServiceId per size in the booking record
// itself (that's just used to pick the price) — wallMaterial is its own intake
// field, described the same way spaceType/cleaningType are above.
export const WALL_MATERIAL_KEYS: Record<string, string> = {
  brick: 'tvIntake.wallBrick',
  concrete: 'tvIntake.wallConcrete',
  drywall: 'tvIntake.wallDrywall',
  'foam-block': 'tvIntake.wallFoamBlock',
};

export function getWallMaterialKey(wallMaterial: string): string | undefined {
  return WALL_MATERIAL_KEYS[wallMaterial];
}

// Single source of truth for displaying a booking's service name. This used to be
// duplicated locally in six different screens; five of those copies never handled
// cleaning-company bookings (no subServiceId, so they fell through to the raw,
// untranslated Firestore string), which is exactly how this bug kept resurfacing in
// screens the earlier fix didn't happen to touch.
export function displayBookingServiceName(
  booking: Pick<Booking, 'type' | 'subServiceId' | 'serviceName'>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (booking.type === 'cleaning-company') {
    return t('bookingDetail.cleaningServiceLabel', { duration: t('cleaningIntake.workingHoursRange') });
  }
  if (booking.type === 'curtain-company') {
    return t('bookingDetail.curtainServiceLabel');
  }
  const key = booking.subServiceId ? getSubServiceNameKey(booking.subServiceId) : undefined;
  return key ? t(key) : booking.serviceName;
}
