import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import es from "./locales/es.json";
import hi from "./locales/hi.json";
import fr from "./locales/fr.json";

export const SUPPORTED_LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
] as const;

const LANG_KEY = "tz_lang";

function detectInitialLanguage(): string {
  try {
    const locales = Localization.getLocales?.() || [];
    const code = locales[0]?.languageCode || "en";
    if (SUPPORTED_LANGS.some((l) => l.code === code)) return code;
  } catch {
    // ignore
  }
  return "en";
}

export async function setLanguage(code: string) {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANG_KEY, code);
  } catch {
    // ignore
  }
}

export async function bootstrapI18n() {
  let saved: string | null = null;
  try {
    saved = await AsyncStorage.getItem(LANG_KEY);
  } catch {
    // ignore
  }
  const lang = saved && SUPPORTED_LANGS.some((l) => l.code === saved) ? saved : detectInitialLanguage();
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        es: { translation: es },
        hi: { translation: hi },
        fr: { translation: fr },
      },
      lng: lang,
      fallbackLng: "en",
      compatibilityJSON: "v4",
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  } else if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
  return i18n;
}

export default i18n;
