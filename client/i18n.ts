import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import hi from "./locales/hi.json";

const STORE_LANGUAGE_KEY = "settings.lang";

// Custom language detector plugin that checks AsyncStorage
const languageDetectorPlugin = {
  type: "languageDetector" as const,
  async: true,
  init: () => {},
  detect: async function (callback: (lang: string) => void) {
    try {
      // 1. Try to get saved language
      const language = await AsyncStorage.getItem(STORE_LANGUAGE_KEY);
      if (language) {
        return callback(language);
      } else {
        // 2. If no saved language, try device locale, fallback to "en"
        const deviceLang = Localization.getLocales()[0]?.languageCode || "en";
        return callback(deviceLang);
      }
    } catch (error) {
      console.log("Error reading language", error);
      return callback("en");
    }
  },
  cacheUserLanguage: async function (language: string) {
    try {
      await AsyncStorage.setItem(STORE_LANGUAGE_KEY, language);
    } catch (error) {
      console.log("Error saving language", error);
    }
  },
};

export const defaultNS = "translation";
export const resources = {
  en: { translation: en },
  ta: { translation: ta },
  te: { translation: te },
  hi: { translation: hi },
};

i18n
  .use(initReactI18next)
  .use(languageDetectorPlugin)
  .init({
    compatibilityJSON: "v4",
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already safe from xss
    },
    react: {
      useSuspense: false, // Disable suspense for React Native consistency
    },
  });

export default i18n;
