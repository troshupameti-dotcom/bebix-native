import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translations, Lang, TranslationKey } from "./translations";

const LANG_STORAGE_KEY = "bebix_lang";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("sq");

  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY).then((stored) => {
      if (stored === "sq" || stored === "en") setLangState(stored);
    });
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    AsyncStorage.setItem(LANG_STORAGE_KEY, next);
  }

  function t(key: TranslationKey): string {
    return translations[lang][key] ?? translations.sq[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within a LanguageProvider");
  return ctx;
}
