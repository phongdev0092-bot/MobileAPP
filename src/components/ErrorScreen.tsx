import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CONFIG } from '../config';

interface ErrorScreenProps {
  isOffline: boolean;
  errorMessage?: string | null;
  onRetry: () => void;
}

/**
 * Màn hình thông báo tiếng Việt khi mất kết nối mạng hoặc tải trang bị lỗi.
 * Đảm bảo người dùng không bao giờ gặp màn hình trắng của trình duyệt mặc định.
 */
export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  isOffline,
  errorMessage,
  onRetry,
}) => {
  const title = isOffline
    ? 'Không có kết nối Internet'
    : 'Không thể tải trang Cổng nhân viên';

  const description = isOffline
    ? 'Vui lòng kiểm tra lại kết nối Wi-Fi hoặc dữ liệu di động (4G/5G) trên điện thoại của bạn rồi thử lại.'
    : errorMessage ||
      'Kết nối tới máy chủ bị gián đoạn hoặc phản hồi quá thời gian chờ. Vui lòng thử lại.';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{isOffline ? '📡' : '⚠️'}</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <TouchableOpacity
          style={styles.retryButton}
          activeOpacity={0.8}
          onPress={onRetry}
        >
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CONFIG.COLORS.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: CONFIG.COLORS.SURFACE,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CONFIG.COLORS.BORDER,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF3EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 34,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: CONFIG.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: CONFIG.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 26,
  },
  retryButton: {
    backgroundColor: CONFIG.COLORS.PRIMARY,
    paddingVertical: 13,
    paddingHorizontal: 36,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
