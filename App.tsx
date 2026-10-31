import React, { useEffect, useRef, useState } from 'react';
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
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0072FF',
    secondaryContainer: '#DBEAFE',
  },
};
import { CONFIG } from './src/config';
import { LoginScreen } from './src/components/LoginScreen';
import { HomeScreen } from './src/components/HomeScreen';
import {
  clearSavedSession,
  EmployeeProfile,
  getLastActiveTime,
  getSavedSession,
  recordLastActiveTime,
} from './src/services/sheetAuthService';

/**
 * Màn hình gốc của ứng dụng Nextsu AI - FPT Telecom.
 * - Khi mở app: nạp font hệ thống và kiểm tra phiên đăng nhập đã lưu.
 * - Kiểm tra thời gian không thao tác (Inactivity Timeout): Quá 2 tiếng tự động ngắt phiên.
 * - Sau khi đăng nhập thành công: mở giao diện chính Native cho toàn bộ các tác vụ vận hành.
 */
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });
  const [initializing, setInitializing] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [savedPassword, setSavedPassword] = useState<string | undefined>(
    undefined
  );

  // Modal thông báo khi tự động ngắt phiên sau 2 tiếng không thao tác
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<boolean>(false);

  // Mốc thời gian thao tác gần nhất (trong bộ nhớ RAM và ghi đĩa định kỳ)
  const lastActiveRef = useRef<number>(Date.now());
  const lastSavedToDiskRef = useRef<number>(0);

  // Hàm ghi nhận thao tác của người dùng
  const updateActivity = () => {
    const now = Date.now();
    lastActiveRef.current = now;
    if (now - lastSavedToDiskRef.current > 15000) {
      lastSavedToDiskRef.current = now;
      recordLastActiveTime();
    }
  };

  // Tự động ngắt phiên đăng nhập
  const handleAutoLogout = async () => {
    await clearSavedSession();
    setToken(null);
    setProfile(null);
    setSavedPassword(undefined);
    setSessionExpiredNotice(true);
  };

  // Khởi động ứng dụng và kiểm tra phiên đã lưu
  useEffect(() => {
    getSavedSession()
      .then((session) => {
        if (session && session.token && session.profile) {
          lastActiveRef.current = Date.now();
          lastSavedToDiskRef.current = Date.now();
          recordLastActiveTime();
          setToken(session.token);
          setProfile(session.profile);
          setSavedPassword(session.password);
        }
      })
      .finally(() => setInitializing(false));
  }, []);

  // Lắng nghe sự kiện thao tác toàn cục trên Web / PWA
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

  // Đồng hồ định kỳ kiểm tra thời gian không thao tác (mỗi 10 giây khi đang đăng nhập)
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

  // Kiểm tra thời gian không thao tác khi người dùng mở lại app từ chạy nền / mở khóa màn hình
  useEffect(() => {
    if (!token || !profile) return;

    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const lastDisk = await getLastActiveTime();
        const effectiveLast = Math.max(lastActiveRef.current, lastDisk);
        if (effectiveLast > 0 && Date.now() - effectiveLast >= CONFIG.INACTIVITY_TIMEOUT_MS) {
          handleAutoLogout();
        } else {
          updateActivity();
        }
      }
    });

    return () => subscription.remove();
  }, [token, profile]);

  const handleLoginSuccess = (
    newToken: string,
    newProfile: EmployeeProfile,
    pwd?: string
  ) => {
    lastActiveRef.current = Date.now();
    lastSavedToDiskRef.current = Date.now();
    recordLastActiveTime();
    setToken(newToken);
    setProfile(newProfile);
    setSavedPassword(pwd);
  };

  const handleLogout = async () => {
    await clearSavedSession();
    setToken(null);
    setProfile(null);
    setSavedPassword(undefined);
  };

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
      <View
        style={styles.statusBarBackground}
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
          style="light"
          backgroundColor={CONFIG.COLORS.STATUS_BAR_BG}
          translucent={false}
        />
        <SafeAreaView
          style={styles.safeArea}
          edges={['top', 'left', 'right', 'bottom']}
        >
          {initializing || (!fontsLoaded && !fontError) ? (
            <View style={styles.splashLoading}>
              <ActivityIndicator size="large" color="#00C6FF" />
            </View>
          ) : token && profile ? (
            <HomeScreen
              token={token}
              profile={profile}
              password={savedPassword}
              onLogout={handleLogout}
            />
          ) : (
            <LoginScreen onLoginSuccess={handleLoginSuccess} />
          )}

          {/* Modal thông báo tự động đăng xuất do 2 tiếng không thao tác */}
          <Modal
            visible={sessionExpiredNotice}
            animationType="fade"
            transparent
            onRequestClose={() => setSessionExpiredNotice(false)}
          >
            <View style={styles.expiredModalOverlay}>
              <View style={styles.expiredModalCard}>
                <View style={styles.expiredIconCircle}>
                  <Ionicons name="time-outline" size={32} color="#DC2626" />
                </View>
                <Text style={styles.expiredModalTitle}>Phiên làm việc đã hết hạn</Text>
                <Text style={styles.expiredModalDesc}>
                  Bạn đã không có thao tác trong ứng dụng hơn 2 tiếng.{'\n\n'}
                  Vì lý do bảo mật thông tin tài khoản, hệ thống đã tự động ngắt phiên đăng nhập. Vui lòng đăng nhập lại để tiếp tục.
                </Text>
                <TouchableOpacity
                  style={styles.expiredModalBtn}
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  statusBarBackground: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.STATUS_BAR_BG,
    paddingTop: Platform.OS === 'android' ? 0 : RNStatusBar.currentHeight,
  },
  safeArea: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.STATUS_BAR_BG,
  },
  splashLoading: {
    flex: 1,
    backgroundColor: '#070F26',
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
    backgroundColor: '#FFFFFF',
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
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  expiredModalDesc: {
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  expiredModalBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0072FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiredModalBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
