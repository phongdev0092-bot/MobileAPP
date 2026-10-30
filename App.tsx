import React from 'react';
import { Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PortalWebView } from './src/components/PortalWebView';
import { CONFIG } from './src/config';

/**
 * Màn hình gốc của ứng dụng FPT Telecom - Cổng nhân viên.
 * Đồng bộ màu thanh trạng thái (StatusBar) với giao diện web và đảm bảo vùng hiển thị an toàn.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.statusBarBackground}>
        <StatusBar
          style="light"
          backgroundColor={CONFIG.COLORS.STATUS_BAR_BG}
          translucent={false}
        />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <PortalWebView />
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
    backgroundColor: CONFIG.COLORS.BACKGROUND,
  },
});
