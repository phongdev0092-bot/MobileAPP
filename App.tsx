import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { CONFIG } from './src/config';
import { LoginScreen } from './src/components/LoginScreen';
import { HomeScreen } from './src/components/HomeScreen';
import {
  clearSavedSession,
  EmployeeProfile,
  getSavedSession,
} from './src/services/sheetAuthService';

/**
 * Màn hình gốc của ứng dụng Nextsu AI - FPT Telecom.
 * - Khi mở app: nạp font hệ thống và kiểm tra phiên đăng nhập đã lưu.
 * - Sau khi đăng nhập thành công: mở giao diện chính Native cho toàn bộ các tác vụ vận hành.
 */
export default function App() {
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [savedPassword, setSavedPassword] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    getSavedSession()
      .then((session) => {
        if (session && session.token && session.profile) {
          setToken(session.token);
          setProfile(session.profile);
          setSavedPassword(session.password);
        }
      })
      .finally(() => setInitializing(false));
  }, []);

  const handleLoginSuccess = (
    newToken: string,
    newProfile: EmployeeProfile,
    pwd?: string
  ) => {
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
      <View style={styles.statusBarBackground}>
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
        </SafeAreaView>
      </View>
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
});
