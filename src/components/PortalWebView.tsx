import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';
import {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';
import { CONFIG } from '../config';
import { requestMediaAndCameraPermissions } from '../utils/permissions';
import { ErrorScreen } from './ErrorScreen';

/**
 * Đoạn mã JavaScript được tiêm vào WebView để:
 * 1. Theo dõi vị trí cuộn dọc (scrollY) của cửa sổ cũng như phần tử con đang cuộn,
 *    từ đó gửi thông báo về React Native nhằm bật/tắt Pull-to-Refresh chính xác
 *    (chỉ cho phép kéo làm mới khi đang ở đầu trang).
 * 2. Khi người dùng chạm vào <input type="file">, thông báo cho React Native kiểm tra
 *    quyền Camera/Ảnh.
 */
const INJECTED_SCROLL_AND_FILE_MONITOR_JS = `
(function() {
  var lastAtTop = true;
  function checkIsAtTop(target) {
    var winTop = (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0) <= 2;
    var elTop = true;
    if (target && target !== document && target !== window) {
      var el = target;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.scrollTop && el.scrollTop > 2) {
          elTop = false;
          break;
        }
        el = el.parentElement;
      }
    }
    var isAtTop = winTop && elTop;
    if (isAtTop !== lastAtTop && window.ReactNativeWebView) {
      lastAtTop = isAtTop;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SCROLL_TOP_STATE', isAtTop: isAtTop }));
    }
  }

  window.addEventListener('scroll', function(e) {
    checkIsAtTop(e.target);
  }, true);

  document.addEventListener('touchstart', function(e) {
    checkIsAtTop(e.target);
  }, { passive: true });

  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el) {
      if (el.tagName === 'INPUT' && el.type === 'file') {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FILE_INPUT_CLICKED' }));
        }
        break;
      }
      el = el.parentElement;
    }
  }, true);
})();
true;
`;

/**
 * Kiểm tra xem URL có thuộc các domain của Google Apps Script được phép mở trong WebView hay không.
 */
function isAllowedWebAppUrl(url: string): boolean {
  if (!url) return false;

  // Cho phép các giao thức nội bộ của trình duyệt/iframe như about:blank, data:, blob:, javascript:
  if (
    url.startsWith('about:') ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('javascript:')
  ) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return CONFIG.ALLOWED_HOST_SUFFIXES.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

export const PortalWebView: React.FC = () => {
  const webViewRef = useRef<WebView>(null);

  // Trạng thái điều hướng và tải trang
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAtTopOfPage, setIsAtTopOfPage] = useState<boolean>(true);

  // Trạng thái mạng và lỗi
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [hasLoadError, setHasLoadError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Xin quyền Camera & Ảnh khi khởi động ứng dụng trên Android
  useEffect(() => {
    requestMediaAndCameraPermissions();
  }, []);

  // 2. Theo dõi trạng thái kết nối mạng (Wi-Fi / 4G / 5G)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false;
      setIsOffline(offline);
    });
    return () => unsubscribe();
  }, []);

  // 3. Xử lý nút Back vật lý / cử chỉ vuốt Back trên Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onHardwareBackPress = (): boolean => {
      // Nếu WebView có lịch sử trang trước thì lùi lại
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }

      // Nếu đang ở trang gốc, hiển thị hộp thoại hỏi "Thoát ứng dụng?"
      Alert.alert(
        'Thoát ứng dụng?',
        'Bạn có chắc chắn muốn đóng ứng dụng FPT Telecom - Cổng nhân viên không?',
        [
          { text: 'Ở lại', style: 'cancel' },
          {
            text: 'Thoát',
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ],
        { cancelable: true }
      );
      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress
    );
    return () => subscription.remove();
  }, [canGoBack]);

  // 4. Xử lý làm mới trang (Pull-to-Refresh hoặc bấm nút "Thử lại")
  const handleReload = useCallback(async () => {
    const netState = await NetInfo.fetch();
    if (netState.isConnected === false) {
      setIsOffline(true);
      setIsRefreshing(false);
      return;
    }

    setIsOffline(false);
    setHasLoadError(false);
    setErrorMessage(null);

    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, []);

  const handlePullToRefresh = useCallback(() => {
    setIsRefreshing(true);
    handleReload();
  }, [handleReload]);

  // 5. Kiểm soát điều hướng: giữ các trang Google Apps Script trong WebView,
  // mở các liên kết ngoài (tel:, mailto:, trang web khác) bằng trình duyệt/ứng dụng hệ thống.
  const handleShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      const { url } = request;

      if (!url) return false;

      // Xử lý các liên kết đặc biệt: gọi điện, gửi email, tin nhắn, bản đồ, intent...
      const lowerUrl = url.toLowerCase();
      if (
        lowerUrl.startsWith('tel:') ||
        lowerUrl.startsWith('mailto:') ||
        lowerUrl.startsWith('sms:') ||
        lowerUrl.startsWith('geo:') ||
        lowerUrl.startsWith('intent:') ||
        lowerUrl.startsWith('market:')
      ) {
        Linking.openURL(url).catch(() => {
          Alert.alert(
            'Thông báo',
            'Không thể mở liên kết này trên thiết bị của bạn.'
          );
        });
        return false;
      }

      // Kiểm tra xem có nằm trong danh sách domain của Google Apps Script không
      if (isAllowedWebAppUrl(url)) {
        return true;
      }

      // Các đường link http/https bên ngoài sẽ mở bằng trình duyệt hệ thống (Chrome...)
      if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
        Linking.openURL(url).catch(() => {
          Alert.alert('Thông báo', 'Không thể mở trình duyệt ngoài.');
        });
        return false;
      }

      return false;
    },
    []
  );

  // 6. Các sự kiện vòng đời khi tải trang trong WebView
  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      setCanGoBack(navState.canGoBack);
    },
    []
  );

  const handleLoadStart = useCallback(() => {
    setHasLoadError(false);
  }, []);

  const handleLoadEnd = useCallback((_event: WebViewNavigationEvent | WebViewErrorEvent) => {
    setIsInitialLoading(false);
    setIsRefreshing(false);
  }, []);

  const handleError = useCallback((event: WebViewErrorEvent) => {
    const { nativeEvent } = event;
    setIsInitialLoading(false);
    setIsRefreshing(false);
    setHasLoadError(true);
    setErrorMessage(
      nativeEvent.description
        ? `Không thể kết nối tới máy chủ (${nativeEvent.description}).`
        : 'Không thể tải trang Cổng nhân viên. Vui lòng kiểm tra kết nối mạng và thử lại.'
    );
  }, []);

  const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    const { nativeEvent } = event;
    // Chỉ hiển thị màn hình lỗi nếu lỗi HTTP xảy ra ở khung chính (main frame) và mã lỗi >= 500
    if (nativeEvent.statusCode >= 500) {
      setIsInitialLoading(false);
      setIsRefreshing(false);
      setHasLoadError(true);
      setErrorMessage(
        `Máy chủ tạm thời không phản hồi (Mã lỗi HTTP ${nativeEvent.statusCode}). Vui lòng thử lại sau giây lát.`
      );
    }
  }, []);

  // 7. Nhận thông điệp từ JavaScript trong WebView
  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload?.type === 'SCROLL_TOP_STATE') {
        setIsAtTopOfPage(Boolean(payload.isAtTop));
      } else if (payload?.type === 'FILE_INPUT_CLICKED') {
        // Đảm bảo quyền Camera/Ảnh đã được cấp khi người dùng bấm chọn ảnh (ví dụ: Bypass MyBAE)
        requestMediaAndCameraPermissions();
      }
    } catch {
      // Bỏ qua các postMessage khác của hệ thống Google Apps Script
    }
  }, []);

  const showErrorOverlay = isOffline || hasLoadError;

  return (
    <View style={styles.root}>
      {/* Bọc WebView trong ScrollView với RefreshControl để hỗ trợ kéo xuống làm mới (Pull-to-Refresh) */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handlePullToRefresh}
            enabled={isAtTopOfPage && !isInitialLoading}
            colors={[CONFIG.COLORS.PRIMARY]}
            tintColor={CONFIG.COLORS.PRIMARY}
            title="Đang làm mới..."
            titleColor={CONFIG.COLORS.TEXT_SECONDARY}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <WebView
          ref={webViewRef}
          source={{ uri: CONFIG.WEB_APP_URL }}
          style={styles.webview}
          // --- Cấu hình lưu trữ & phiên đăng nhập ---
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          cacheEnabled={true}
          cacheMode="LOAD_DEFAULT"
          incognito={false} // Tuyệt đối KHÔNG bật ẩn danh để giữ nguyên localStorage chứa token
          // --- Cấu hình giao diện & tương thích Chrome Mobile ---
          userAgent={CONFIG.CHROME_MOBILE_USER_AGENT}
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="compatibility"
          overScrollMode="never"
          // --- Tiêm JS theo dõi cuộn trang và nút upload ảnh ---
          injectedJavaScript={INJECTED_SCROLL_AND_FILE_MONITOR_JS}
          onMessage={handleWebViewMessage}
          // --- Xử lý điều hướng và lỗi ---
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleHttpError}
          // Chặn trang báo lỗi mặc định của Android WebView
          renderError={() => <View style={styles.blankErrorPlaceholder} />}
        />
      </ScrollView>

      {/* Lớp phủ hiển thị Spinner khi đang tải trang lần đầu */}
      {isInitialLoading && !showErrorOverlay && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={CONFIG.COLORS.PRIMARY} />
            <Text style={styles.loadingText}>
              Đang tải Cổng nhân viên FPT Telecom...
            </Text>
          </View>
        </View>
      )}

      {/* Màn hình thông báo tiếng Việt khi mất mạng hoặc lỗi tải trang */}
      {showErrorOverlay && (
        <ErrorScreen
          isOffline={isOffline}
          errorMessage={errorMessage}
          onRetry={() => {
            setIsInitialLoading(true);
            handleReload();
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.BACKGROUND,
  },
  scrollContent: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.BACKGROUND,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CONFIG.COLORS.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '600',
    color: CONFIG.COLORS.TEXT_PRIMARY,
  },
  blankErrorPlaceholder: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.BACKGROUND,
  },
});
