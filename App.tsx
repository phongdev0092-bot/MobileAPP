import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
} from 'react-native-paper';
import { AppIcon, Clock } from './src/components/AppIcon';
import { CONFIG } from './src/config';
import {
  AuthThemeProvider,
  useAuthTheme,
} from './src/contexts/AuthThemeContext';
import { HomeScreen } from './src/components/HomeScreen';
import { LoginScreen } from './src/components/LoginScreen';
import {
  clearSavedSession,
  EmployeeProfile,
  getLastActiveTime,
  getSavedSession,
  recordLastActiveTime,
} from './src/services/sheetAuthService';

const AppShell: React.FC = () => {
  const { darkMode, tokens } = useAuthTheme();
  const [initializing, setInitializing] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] =
    useState<boolean>(false);

  const lastActiveRef = useRef<number>(Date.now());
  const lastSavedToDiskRef = useRef<number>(0);

  const paperTheme = useMemo(() => {
    const base = darkMode ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: '#0072FF',
        secondaryContainer: darkMode ? '#1E3A8A' : '#DBEAFE',
      },
    };
  }, [darkMode]);

  const updateActivity = () => {
    const now = Date.now();
    lastActiveRef.current = now;
    if (now - lastSavedToDiskRef.current > 15000) {
      lastSavedToDiskRef.current = now;
      recordLastActiveTime();
    }
  };

  const handleAutoLogout = async () => {
    await clearSavedSession();
    setToken(null);
    setProfile(null);
    setSessionExpiredNotice(true);
  };

  useEffect(() => {
    getSavedSession()
      .then((session) => {
        if (session && session.token && session.profile) {
          lastActiveRef.current = Date.now();
          lastSavedToDiskRef.current = Date.now();
          recordLastActiveTime();
          setToken(session.token);
          setProfile(session.profile);
        }
      })
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleEvent = () => updateActivity();
    window.addEventListener('touchstart', handleEvent, { passive: true });
    window.addEventListener('click', handleEvent, { passive: true });
    window.addEventListener('keydown', handleEvent, { passive: true });
    window.addEventListener('scroll', handleEvent, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleEvent);
      window.removeEventListener('click', handleEvent);
      window.removeEventListener('keydown', handleEvent);
      window.removeEventListener('scroll', handleEvent);
    };
  }, []);

  useEffect(() => {
    if (!token || !profile) return;
    recordLastActiveTime();

    const interval = setInterval(() => {
      const idleTime = Date.now() - lastActiveRef.current;
      if (idleTime >= CONFIG.INACTIVITY_TIMEOUT_MS) {
        handleAutoLogout();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [token, profile]);

  useEffect(() => {
    if (!token || !profile) return;

    const subscription = AppState.addEventListener(
      'change',
      async (nextState) => {
        if (nextState === 'active') {
          const lastDisk = await getLastActiveTime();
          const effectiveLast = Math.max(lastActiveRef.current, lastDisk);
          if (
            effectiveLast > 0 &&
            Date.now() - effectiveLast >= CONFIG.INACTIVITY_TIMEOUT_MS
          ) {
            handleAutoLogout();
          } else {
            updateActivity();
          }
        }
      }
    );

    return () => subscription.remove();
  }, [token, profile]);

  const handleLoginSuccess = (newToken: string, newProfile: EmployeeProfile) => {
    lastActiveRef.current = Date.now();
    lastSavedToDiskRef.current = Date.now();
    recordLastActiveTime();
    setToken(newToken);
    setProfile(newProfile);
  };

  const handleLogout = async () => {
    await clearSavedSession();
    setToken(null);
    setProfile(null);
  };

  const isAuthScreen = initializing || !token || !profile;
  const topBg = isAuthScreen ? tokens.background : CONFIG.COLORS.STATUS_BAR_BG;
  const barStyle = isAuthScreen && !darkMode ? 'dark' : 'light';

  return (
    <PaperProvider
      theme={paperTheme}
      settings={{
        icon: (props) => (
          <AppIcon
            name={typeof props.name === 'string' ? props.name : 'info'}
            size={props.size || 20}
            color={props.color || '#0072FF'}
          />
        ),
      }}
    >
      <View
        style={[styles.statusBarBackground, { backgroundColor: topBg }]}
        onStartShouldSetResponderCapture={() => {
          updateActivity();
          return false;
        }}
        onMoveShouldSetResponderCapture={() => {
          updateActivity();
          return false;
        }}
      >
        <StatusBar
          style={barStyle}
          backgroundColor={topBg}
          translucent={false}
        />
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: topBg }]}
          edges={['top', 'left', 'right', 'bottom']}
        >
          {initializing ? (
            <View
              style={[
                styles.splashLoading,
                { backgroundColor: tokens.background },
              ]}
            >
              <ActivityIndicator size="large" color={tokens.primary} />
            </View>
          ) : token && profile ? (
            <HomeScreen
              token={token}
              profile={profile}
              onLogout={handleLogout}
            />
          ) : (
            <LoginScreen onLoginSuccess={handleLoginSuccess} />
          )}

          <Modal
            visible={sessionExpiredNotice}
            animationType="fade"
            transparent
            onRequestClose={() => setSessionExpiredNotice(false)}
          >
            <View style={styles.expiredModalOverlay}>
              <View
                style={[
                  styles.expiredModalCard,
                  { backgroundColor: tokens.card },
                ]}
              >
                <View style={styles.expiredIconCircle}>
                  <Clock size={32} color="#DC2626" strokeWidth={2} />
                </View>
                <Text
                  style={[
                    styles.expiredModalTitle,
                    { color: tokens.foreground },
                  ]}
                >
                  Phiên làm việc đã hết hạn
                </Text>
                <Text
                  style={[
                    styles.expiredModalDesc,
                    { color: tokens.mutedForeground },
                  ]}
                >
                  Bạn đã không có thao tác trong ứng dụng hơn 2 tiếng.{'\n\n'}
                  Vì lý do bảo mật thông tin tài khoản, hệ thống đã tự động ngắt
                  phiên đăng nhập. Vui lòng đăng nhập lại để tiếp tục.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.expiredModalBtn,
                    { backgroundColor: tokens.primary },
                  ]}
                  onPress={() => setSessionExpiredNotice(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.expiredModalBtnText}>Đăng nhập lại</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    </PaperProvider>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthThemeProvider>
        <AppShell />
      </AuthThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  statusBarBackground: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 0 : RNStatusBar.currentHeight,
  },
  safeArea: {
    flex: 1,
  },
  splashLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  expiredModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  expiredIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  expiredModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  expiredModalDesc: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  expiredModalBtn: {
    width: '100%',
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiredModalBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
