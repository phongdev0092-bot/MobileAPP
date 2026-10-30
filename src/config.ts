/**
 * Tệp cấu hình trung tâm của ứng dụng Nextsu AI - FPT Telecom
 */

export const CONFIG = {
  APP_NAME: 'Nextsu AI - FPT Telecom',
  APP_SUBTITLE: 'Cổng nhân viên & Trợ lý vận hành thông minh',

  // Sheet nhân sự: Cột K (11) = Email đăng nhập, Cột H (8) = Password
  EMPLOYEE_SHEET_ID: '17QLc9SlfpPPrR-d1R2BkBxA7DmCI5ZCuhmQffP5F6pY',
  EMPLOYEE_SHEET_GID: 32204814,
  COL_INDEX_PASSWORD: 7, // Cột H (0-based index = 7)
  COL_INDEX_EMAIL: 10,   // Cột K (0-based index = 10)

  // Đường dẫn thực thi (exec) của Google Apps Script Web App
  WEB_APP_URL:
    'https://script.google.com/macros/s/AKfycby2h8SFwE4212R2Z95ADkvtlEcZ0P7NLsGJLHyx9s8LDTJjMXT0md9pyjQ7GLNI8y28/exec',

  CHROME_MOBILE_USER_AGENT:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',

  ALLOWED_HOST_SUFFIXES: [
    'script.google.com',
    'googleusercontent.com',
    'google.com',
    'gstatic.com',
    'googleapis.com',
  ],

  // Danh sách nguyên nhân các tác vụ nghiệp vụ
  BYPASS_CAUSE2_OPTIONS: ['Kh di day am tuong', 'Ha tang doi tac'],
  CLEAR_CAUSE1_OPTIONS: [
    'KH có nhu cầu chuyển địa điểm',
    'Tạo nhầm hợp đồng',
    'KH không có nhu cầu bảo trì',
  ],
  MYBAE_CAUSE1_OPTIONS: [
    'Không kết nối được hệ thống Mỹ Bảo',
    'Không đăng nhập được MobiX',
    'Không kết nối được wifi khách hàng',
    'Khách hàng không sử dụng wifi',
    'Điện thoại KTV không hỗ trợ đo kiểm',
  ],
  MANUAL_TYPE_OPTIONS: ['TRIỂN KHAI', 'BẢO TRÌ'],
  SPAM_CAUSE_OPTIONS: [
    'Facebook/ Tiktok/ Youtube chậm',
    'VPN công ty/ Camera chậm',
    'Khác',
  ],

  // Bảng màu đồng bộ với Logo Caption Nextsu AI - FPT Telecom (Xanh Cyan -> Xanh Dương -> Tím Gradient)
  COLORS: {
    PRIMARY: '#0066FF',
    PRIMARY_DARK: '#0A1931',
    SECONDARY: '#00C2FF',
    ACCENT_PURPLE: '#6C3CE9',
    GRADIENT_START: '#00C6FF',
    GRADIENT_MID: '#0072FF',
    GRADIENT_END: '#6C3CE9',
    STATUS_BAR_BG: '#0B1736',
    BACKGROUND: '#F4F7FE',
    SURFACE: '#FFFFFF',
    TEXT_PRIMARY: '#0F172A',
    TEXT_SECONDARY: '#64748B',
    DANGER: '#EF4444',
    SUCCESS: '#10B981',
    WARNING: '#F59E0B',
    BORDER: '#E2E8F0',
  },
};
