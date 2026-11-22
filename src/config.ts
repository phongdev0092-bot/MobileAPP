/**
 * Tệp cấu hình trung tâm của ứng dụng Nextsu AI - FPT Telecom
 */

export const CONFIG = {
  APP_NAME: 'NextSu AI',
  APP_SUBTITLE: 'Cổng nhân viên & Trợ lý vận hành thông minh',

  // Thời gian tự động ngắt phiên nếu không có thao tác trong app (2 tiếng = 120 phút = 7.200.000 ms)
  INACTIVITY_TIMEOUT_MS: 2 * 60 * 60 * 1000,

  // Sheet nhân sự: Cột E (5) = Họ Tên NV, Cột H (8) = Password, Cột K (11) = Email, Cột V (22) = Hình ảnh, Cột AD (30) = Roles
  EMPLOYEE_SHEET_ID: '17QLc9SlfpPPrR-d1R2BkBxA7DmCI5ZCuhmQffP5F6pY',
  EMPLOYEE_SHEET_GID: 32204814,
  COL_INDEX_NAME: 4,     // Cột E (0-based index = 4)
  COL_INDEX_PASSWORD: 7, // Cột H (0-based index = 7)
  COL_INDEX_EMAIL: 10,   // Cột K (0-based index = 10)
  COL_INDEX_AVATAR: 21,  // Cột V (0-based index = 21)
  COL_INDEX_ROLE: 29,    // Cột AD (0-based index = 29)
  DEFAULT_ADMIN_EMAIL: 'phuongnam.phongnh5@fpt.net',

  // Sheet Lịch trực / Off theo Block
  SCHEDULE_SHEET_ID: '1qd8O1bqbtHmbPUO_HhZv07YS9c27bo1QMWh4yvmQr2U',
  SCHEDULE_SHEET_GID: 0,

  // Đường dẫn thực thi (exec) của Google Apps Script Web App
  WEB_APP_URL:
    'https://script.google.com/macros/s/AKfycbxwC2hCm1KfmPfFlsVQ7dO-x-6eE4lgFVu-JPOeGej12b_5Bxglxa_hVRxY2zcT3ZRk/exec',

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

  // Cấu hình Tác vụ "Tối Ưu Kênh Truyền" (thay thế SpamPool Ưu Tiên)
  OPTIMIZE_CHANNEL_SHEET_ID: '1Sw-qSbLzvVdcW4rj7ywEZBEzKI6w5M82EQeYJUpdx7M',
  OPTIMIZE_TARGET_OPTIONS: [
    {
      id: 'POOL',
      label: 'Pool Ưu Tiên',
      sheetTask: 'Spampool Ưu Tiên',
      gid: 2070394876,
      desc: 'Đẩy lên Sheet là: Spampool Ưu Tiên',
    },
    {
      id: 'BYPASS_IPNAT',
      label: 'Bypass IPNAT',
      sheetTask: 'Bỏ IP NAT',
      gid: 1907537423,
      desc: 'Đẩy lên Sheet là: Bỏ IP NAT',
    },
    {
      id: 'DEACTIVE_IP',
      label: 'Deactive IP 0.0.0.0',
      sheetTask: 'Deactive IP 0.0.0.0',
      gid: 2070394876,
      desc: 'Đẩy lên Sheet là: Deactive IP 0.0.0.0',
    },
  ],
  OPTIMIZE_CAUSE_OPTIONS: [
    'Facebook, youtube, tiktok load cham',
    'KH yeu cau',
    'PS5, vpn, web gov',
    'Khác',
  ],
  SPAM_CAUSE_OPTIONS: [
    'Facebook, youtube, tiktok load cham',
    'KH yeu cau',
    'PS5, vpn, web gov',
    'Khác',
  ],

  // Cấu hình Tác vụ "Thu Hồi Port"
  RECALL_PORT_SHEET_ID: '1Sw-qSbLzvVdcW4rj7ywEZBEzKI6w5M82EQeYJUpdx7M',
  RECALL_PORT_SHEET_GID: 966043489,
  TAP_DIEM_SHEET_ID: '17QLc9SlfpPPrR-d1R2BkBxA7DmCI5ZCuhmQffP5F6pY',
  TAP_DIEM_SHEET_GID: 1396352881,
  TAP_DIEM_CSV_URL:
    'https://docs.google.com/spreadsheets/d/17QLc9SlfpPPrR-d1R2BkBxA7DmCI5ZCuhmQffP5F6pY/export?format=csv&gid=1396352881',
  RECALL_PORT_CAUSE_OPTIONS: ['KH cũ dọn đi', 'HD cũ đã hủy', 'Khác'],
  PORT_OPTIONS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],

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
