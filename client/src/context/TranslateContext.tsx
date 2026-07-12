import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type Language = "en" | "hi";

interface TranslateContextValue {
  lang: Language;
  toggleLang: () => void;
  t: (en: string, hi: string) => string;
  uiLang: Language;
  toggleUiLang: () => void;
  uiT: (en: string, hi: string) => string;
}

const TranslateContext = createContext<TranslateContextValue | null>(null);

function loadLang(key: string): Language {
  return (localStorage.getItem(key) as Language) || "en";
}

export function TranslateProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => loadLang("lang"));
  const [uiLang, setUiLang] = useState<Language>(() => loadLang("uiLang"));

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("uiLang", uiLang);
  }, [uiLang]);

  const toggleLang = useCallback(() => {
    setLang((l) => (l === "en" ? "hi" : "en"));
  }, []);

  const toggleUiLang = useCallback(() => {
    setUiLang((l) => (l === "en" ? "hi" : "en"));
  }, []);

  const t = useCallback((en: string, hi: string) => (lang === "hi" ? hi : en), [lang]);
  const uiT = useCallback((en: string, hi: string) => (uiLang === "hi" ? hi : en), [uiLang]);

  return (
    <TranslateContext.Provider value={{ lang, toggleLang, t, uiLang, toggleUiLang, uiT }}>
      {children}
    </TranslateContext.Provider>
  );
}

export function useTranslate(): TranslateContextValue {
  const ctx = useContext(TranslateContext);
  if (!ctx) throw new Error("useTranslate must be used within TranslateProvider");
  return ctx;
}
