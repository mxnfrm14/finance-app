"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { translations, type Language, type Translations } from "./translations"

type LanguageContextValue = {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "fr",
  setLanguage: () => {},
  t: translations.fr,
})

/**
 * LanguageProvider — initialLanguage DOIT venir du serveur (session DB) pour éviter
 * le hydration mismatch. Ne pas lire localStorage au montage.
 *
 * Usage dans app/layout.tsx (server component) :
 *   const session = await auth()
 *   const lang = (session?.user?.language ?? "fr") as Language
 *   <LanguageProvider initialLanguage={lang}>
 */
export function LanguageProvider({
  children,
  initialLanguage = "fr",
}: {
  children: React.ReactNode
  initialLanguage?: Language
}) {
  // Initialisation directe depuis le serveur — pas de useEffect au montage
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang)
    // Persister côté client (pour les rechargements hors-session)
    if (typeof window !== "undefined") {
      localStorage.setItem("language", lang)
    }
    // Persister en DB
    try {
      await fetch("/api/users/me/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      })
    } catch {
      // Non-critique — la langue est déjà mise à jour localement
    }
  }, [])

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t: translations[language] }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
