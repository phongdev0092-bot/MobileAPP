/**
 * Tệp cấu hình trung tâm của ứng dụng FPT Telecom - Cổng nhân viên.
 * Khi triển khai lại (Deploy) Google Apps Script tạo ra URL mới,
 * bạn chỉ cần thay đổi biến WEB_APP_URL tại đây.
 */

export const CONFIG = {
  // Tên hiển thị của ứng dụng
  APP_NAME: 'FPT Telecom - Cổng nhân viên',

  // Đường dẫn thực thi (exec) của Google Apps Script Web App
  WEB_APP_URL:
    'https://script.google.com/macros/s/AKfycby2h8SFwE4212R2Z95ADkvtlEcZ0P7NLsGJLHyx9s8LDTJjMXT0md9pyjQ7GLNI8y28/exec',

  // User-Agent giả lập trình duyệt Chrome Mobile chuẩn trên Android.
  // Giúp Google Apps Script không chặn WebView và hiển thị giao diện chuẩn di động.
  CHROME_MOBILE_USER_AGENT:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',

  // Danh sách các tên miền (domain) nội bộ được phép điều hướng bên trong WebView.
  // Lưu ý: Google Apps Script thường chuyển hướng (redirect) từ script.google.com
  // sang script.googleusercontent.com để hiển thị nội dung iframe sandbox.
  ALLOWED_HOST_SUFFIXES: [
    'script.google.com',
    'googleusercontent.com',
    'google.com',
    'gstatic.com',
    'googleapis.com',
  ],

  // Bảng màu đồng bộ với thương hiệu FPT Telecom và giao diện Web App
  COLORS: {
    PRIMARY: '#F37021', // Cam FPT chủ đạo
    STATUS_BAR_BG: '#F37021', // Màu nền thanh trạng thái
    BACKGROUND: '#F5F7FA', // Màu nền tổng thể của trang
    SURFACE: '#FFFFFF',
    TEXT_PRIMARY: '#1E293B',
    TEXT_SECONDARY: '#64748B',
    DANGER: '#EF4444',
    BORDER: '#E2E8F0',
  },
};
