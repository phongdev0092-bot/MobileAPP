import { Alert as RNAlert, AlertButton, Platform } from 'react-native';

/**
 * Alert dùng chung cho cả điện thoại (native) và trình duyệt / PWA iOS.
 * react-native-web không hỗ trợ Alert.alert (nút bấm không chạy) nên trên Web
 * dùng window.alert / window.confirm để các nút Xóa, Xác nhận... hoạt động đúng.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') {
      RNAlert.alert(title, message, buttons);
      return;
    }
    const text = message ? `${title}\n\n${message}` : title;
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const ok = window.confirm(text);
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    const actionBtn =
      buttons.find((b) => b.style === 'destructive') ||
      buttons.find((b) => b.style !== 'cancel') ||
      buttons[buttons.length - 1];
    if (ok) {
      actionBtn?.onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
  },
};
