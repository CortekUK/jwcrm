"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

type Locale = 'en' | 'ar';

interface LanguageContextType {
  locale: Locale;
  changeLanguage: (locale: Locale) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const { profile, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [locale, setLocale] = useState<Locale>('en');
  const [isLoading, setIsLoading] = useState(true);

  // Load user's locale preference on mount
  useEffect(() => {
    const loadLocale = async () => {
      if (profile?.locale) {
        const userLocale = profile.locale as Locale;
        setLocale(userLocale);
        await i18n.changeLanguage(userLocale);
        updateDocumentAttributes(userLocale);
      }
      setIsLoading(false);
    };

    loadLocale();
  }, [profile, i18n]);

  const updateDocumentAttributes = (locale: Locale) => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    
    // Add/remove Arabic font class
    if (locale === 'ar') {
      document.documentElement.classList.add('font-arabic');
    } else {
      document.documentElement.classList.remove('font-arabic');
    }
  };

  const changeLanguage = async (newLocale: Locale) => {
    try {
      setIsLoading(true);

      // Update i18n
      await i18n.changeLanguage(newLocale);
      setLocale(newLocale);
      updateDocumentAttributes(newLocale);

      // Update database if user is logged in
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ locale: newLocale })
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to update profile locale:', error);
          throw error;
        }

        // Refresh the user's profile in useAuth
        await refreshProfile();

        // Invalidate all queries that might contain profile data
        await queryClient.invalidateQueries();
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
