import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTH_STRINGS,
  AppLanguage,
  AuthStringKey,
} from '../i18n/authStrings';
import {
  AuthThemePalette,
  DARK_AUTH_TOKENS,
  LIGHT_AUTH_TOKENS,
} from '../theme/authTokens';

const STORAGE_THEME_KEY = '@nextsu_ui_theme_v2';
const STORAGE_LANG_KEY = '@nextsu_ui_lang_v2';

interface AuthThemeContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;
  tokens: AuthThemePalette;
  t: (key: AuthStringKey) => string;
}

const AuthThemeContext = createContext<AuthThemeContextValue>({
  lang: 'vi',
  setLang: () => {},
  darkMode: false,
  setDarkMode: () => {},
  toggleDarkMode: () => {},
  tokens: LIGHT_AUTH_TOKENS,
  t: (k) => AUTH_STRINGS.vi[k] || k,
});

export const AuthThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemScheme = useColorScheme();
  const [lang, setLangState] = useState<AppLanguage>('vi');
  const [darkMode, setDarkModeState] = useState<boolean>(
    systemScheme === 'dark'
  );

  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedLang] = await Promise.all([
          AsyncStorage.getItem(STORAGE_THEME_KEY),
          AsyncStorage.getItem(STORAGE_LANG_KEY),
        ]);
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setDarkModeState(savedTheme === 'dark');
        }
        if (savedLang === 'vi' || savedLang === 'en') {
          setLangState(savedLang);
        }
      } catch {}
    })();
  }, []);

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_LANG_KEY, next).catch(() => {});
  }, []);

  const setDarkMode = useCallback((next: boolean) => {
    setDarkModeState(next);
    AsyncStorage.setItem(STORAGE_THEME_KEY, next ? 'dark' : 'light').catch(
      () => {}
    );
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkModeState((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_THEME_KEY, next ? 'dark' : 'light').catch(
        () => {}
      );
      return next;
    });
  }, []);

  const t = useCallback(
    (key: AuthStringKey): string => {
      return AUTH_STRINGS[lang][key] ?? AUTH_STRINGS.vi[key] ?? key;
    },
    [lang]
  );

  const tokens = darkMode ? DARK_AUTH_TOKENS : LIGHT_AUTH_TOKENS;

  const value = useMemo(
    () => ({
      lang,
      setLang,
      darkMode,
      setDarkMode,
      toggleDarkMode,
      tokens,
      t,
    }),
    [lang, setLang, darkMode, setDarkMode, toggleDarkMode, tokens, t]
  );

  return (
    <AuthThemeContext.Provider value={value}>
      {children}
    </AuthThemeContext.Provider>
  );
};

export function useAuthTheme() {
  return useContext(AuthThemeContext);
}
