import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import en from '@/locales/en/common.json';
import uz from '@/locales/uz/common.json';
import ru from '@/locales/ru/common.json';
import fr from '@/locales/fr/common.json';
import es from '@/locales/es/common.json';
import pt from '@/locales/pt/common.json';
import hi from '@/locales/hi/common.json';
import ar from '@/locales/ar/common.json';
import fa from '@/locales/fa/common.json';
import ky from '@/locales/ky/common.json';
import tg from '@/locales/tg/common.json';

export const LANGUAGE_STORAGE_KEY = 'app_language';
export const DEFAULT_LANGUAGE = 'en';
// Used when the device's own OS language isn't one of the app's supported languages —
// distinct from DEFAULT_LANGUAGE, which stays the i18next fallbackLng (the safety net for a
// key missing from whichever language IS active, regardless of what that language is).
const FALLBACK_APP_LANGUAGE = 'ru';

export interface LanguageOption {
  code: string;
  nativeName: string;
  englishName: string;
  isRTL: boolean;
}

// Native names are shown in the LanguageSelector so each language reads in its own script.
export const LANGUAGES: LanguageOption[] = [
  { code: 'en', nativeName: 'English',    englishName: 'English',    isRTL: false },
  { code: 'uz', nativeName: "O'zbek",     englishName: 'Uzbek',      isRTL: false },
  { code: 'ru', nativeName: 'Русский',    englishName: 'Russian',    isRTL: false },
  { code: 'fr', nativeName: 'Français',   englishName: 'French',     isRTL: false },
  { code: 'es', nativeName: 'Español',    englishName: 'Spanish',    isRTL: false },
  { code: 'pt', nativeName: 'Português',  englishName: 'Portuguese', isRTL: false },
  { code: 'hi', nativeName: 'हिन्दी',       englishName: 'Hindi',      isRTL: false },
  { code: 'ar', nativeName: 'العربية',     englishName: 'Arabic',     isRTL: true },
  { code: 'fa', nativeName: 'فارسی',       englishName: 'Persian',    isRTL: true },
  { code: 'ky', nativeName: 'Кыргызча',   englishName: 'Kyrgyz',     isRTL: false },
  { code: 'tg', nativeName: 'Тоҷикӣ',      englishName: 'Tajik',      isRTL: false },
];

const resources = {
  en: { common: en },
  uz: { common: uz },
  ru: { common: ru },
  fr: { common: fr },
  es: { common: es },
  pt: { common: pt },
  hi: { common: hi },
  ar: { common: ar },
  fa: { common: fa },
  ky: { common: ky },
  tg: { common: tg },
};

// i18next.init() itself — not just i18n.use() — is what binds the instance react-i18next's
// useTranslation() reads (it calls setI18n() synchronously inside init(), not use()). That bind
// has to happen before ANY component's first render. Doing this in performInit() below, gated
// behind an async SecureStore read and only ever invoked from a useEffect (which runs *after*
// the first render), was too late: the first screen's useTranslation() would find no bound
// instance yet, and react-i18next would silently attach it to a disposable throwaway instance
// instead — permanently stuck showing raw keys for that component's whole lifetime, since that
// throwaway instance never receives the resources or language the real instance loads later.
// Initializing synchronously here with a safe default language closes that gap; the real
// saved/detected language is applied afterward via changeLanguage(), which — unlike init() —
// correctly notifies already-mounted, properly-bound components.
i18n.use(initReactI18next).init({
  resources,
  lng: FALLBACK_APP_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export function isRTLLanguage(code: string): boolean {
  return LANGUAGES.find((l) => l.code === code)?.isRTL ?? false;
}

export function isSupportedLanguage(code: string): boolean {
  return LANGUAGES.some((l) => l.code === code);
}

// React Native only fully applies a layout-direction change after a reload, but we still
// flip the flag immediately so it takes effect the next time the app launches.
function applyRTL(languageCode: string): void {
  const shouldBeRTL = isRTLLanguage(languageCode);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
  }
}

// First of the device's preferred locales (in the user's own OS-level order) that
// this app actually has translations for, if any. Only consulted when there's no
// SecureStore preference yet — i.e. a genuinely first-ever launch — so it never
// overrides a language the user (or their account's saved Firestore preference,
// applied later in _layout.tsx's auth handler) has already chosen.
function detectDeviceLanguage(): string | null {
  try {
    const locales = Localization.getLocales();
    const match = locales.find((l) => isSupportedLanguage(l.languageCode ?? ''));
    return match?.languageCode ?? null;
  } catch {
    // getLocales() is synchronous and shouldn't throw, but this runs before any
    // other app code — never let a platform quirk here block startup.
    return null;
  }
}

let initPromise: Promise<void> | null = null;

async function performInit(): Promise<void> {
  let savedLanguage: string | null = null;
  try {
    savedLanguage = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
  } catch {
    // SecureStore unavailable — fall back below
  }

  // Priority: explicit saved preference > device locale (first-launch only) > Russian.
  const initialLanguage = (savedLanguage && isSupportedLanguage(savedLanguage))
    ? savedLanguage
    : (detectDeviceLanguage() ?? FALLBACK_APP_LANGUAGE);

  if (initialLanguage !== i18n.language) {
    await i18n.changeLanguage(initialLanguage);
  }

  applyRTL(initialLanguage);
}

// Memoized so it's safe to call from multiple places (e.g. an app-start effect and an
// auth-state callback) — every caller awaits the same underlying init, which only runs once.
export function initI18n(): Promise<void> {
  if (!initPromise) {
    initPromise = performInit();
  }
  return initPromise;
}

export async function setLanguage(languageCode: string): Promise<void> {
  if (!isSupportedLanguage(languageCode)) return;
  await initI18n();

  try {
    await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, languageCode);
  } catch {
    // SecureStore isn't available on web — the language change itself shouldn't be blocked
  }

  await i18n.changeLanguage(languageCode);
  applyRTL(languageCode);
}

export async function getStoredLanguage(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export default i18n;
