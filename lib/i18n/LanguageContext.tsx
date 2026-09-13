import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translations, Language, TranslationKey } from "./translations";

const STORAGE_KEY = "bebix_language_v1";

type TranslateParams = Record<string, string | number>;

type LanguageContextValue = {
  language: Language;
  /** Alias of `language` — kept because baby.tsx and other screens already destructure `{ t, lang }`. */
  lang: Language;
  setLanguage: (lang: Language) => void;
  /**
   * Translate a key into the current language, falling back to Albanian.
   * Supports simple {placeholder} interpolation, e.g.:
   *   t("time_hr_ago", { n: 3 }) -> "3 orë më parë"
   */
  t: (key: TranslationKey, params?: TranslateParams) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("sq");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === "sq" || raw === "en") setLanguageState(raw);
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: TranslationKey, params?: TranslateParams) => {
    let str: string = translations[language][key] ?? translations.sq[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, lang: language, setLanguage, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

/**
 * Alias for useLanguage — app/(main)/_layout.tsx (tab bar) already calls
 * useTranslation(). Same context, same value, two names.
 */
export const useTranslation = useLanguage;