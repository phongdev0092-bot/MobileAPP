# FPT Telecom - Cổng nhân viên (Mobile App)

Ứng dụng Android viết bằng **React Native + Expo (TypeScript)** dùng để bọc (wrap) Web App **Google Apps Script** của Cổng nhân viên FPT Telecom và đóng gói thành file `.apk` cài đặt trực tiếp.

---

## 1. Cấu trúc thư mục dự án

```text
d:\MobileApp
├── assets/
│   ├── icon.png                 # Icon ứng dụng (1024x1024)
│   ├── adaptive-icon.png        # Adaptive Icon cho Android (1024x1024)
│   ├── splash.png               # Màn hình chờ khi mở app
│   └── favicon.png              # Favicon
├── src/
│   ├── config.ts                # Chứa URL Web App Google Apps Script & cấu hình màu sắc
│   ├── components/
│   │   ├── PortalWebView.tsx    # Thành phần WebView chính (xử lý lưu phiên, ảnh, điều hướng, làm mới)
│   │   └── ErrorScreen.tsx      # Màn hình báo lỗi/mất mạng bằng tiếng Việt, có nút "Thử lại"
│   └── utils/
│       └── permissions.ts       # Xin quyền Camera và Thư viện ảnh lúc chạy trên Android
├── App.tsx                      # Khung ứng dụng chính, cấu hình StatusBar và vùng hiển thị an toàn
├── index.ts                     # Điểm khởi chạy ứng dụng Expo
├── app.json                     # Cấu hình ứng dụng Expo (tên, package, quyền Android, bàn phím...)
├── eas.json                     # Cấu hình EAS Build để xuất file APK và AAB
├── package.json                 # Khai báo các thư viện sử dụng
├── tsconfig.json                # Cấu hình TypeScript
└── babel.config.js              # Cấu hình Babel
```

---

## 2. Hướng dẫn từng bước cho người mới bắt đầu

### Bước a: Cài đặt Node.js và tải thư viện
1. Tải và cài đặt **Node.js bản LTS** (khuyến nghị từ v18 hoặc v20 trở lên) tại trang chủ: https://nodejs.org/
2. Mở **Command Prompt (cmd)** hoặc **PowerShell**, di chuyển vào thư mục dự án:
   ```bash
   cd d:\MobileApp
   ```
3. Cài đặt các gói thư viện của dự án:
   ```bash
   npm install
   ```

### Bước b: Chạy thử ngay trên điện thoại bằng Expo Go
1. Trên điện thoại Android, mở **CH Play (Google Play Store)** và cài đặt ứng dụng **Expo Go**.
2. Đảm bảo điện thoại và máy tính đang kết nối **cùng một mạng Wi-Fi**.
3. Tại cửa sổ dòng lệnh trên máy tính, chạy lệnh:
   ```bash
   npx expo start
   ```
4. Dùng ứng dụng **Expo Go** trên điện thoại quét mã QR hiện trên màn hình máy tính để mở và kiểm tra thử ứng dụng.

### Bước c: Đóng gói ra file cài đặt `.apk` (bằng EAS Build)
1. Đăng ký một tài khoản miễn phí tại: https://expo.dev/signup
2. Cài đặt công cụ `eas-cli` toàn cục trên máy tính:
   ```bash
   npm install -g eas-cli
   ```
3. Đăng nhập vào tài khoản Expo của bạn:
   ```bash
   eas login
   ```
   *(Nhập email/username và mật khẩu tài khoản Expo vừa tạo).*
4. Chạy lệnh tạo file APK theo cấu hình `preview` đã thiết lập sẵn trong `eas.json`:
   ```bash
   eas build -p android --profile preview
   ```
   - Lần đầu chạy, nếu hệ thống hỏi *"Would you like to automatically create an EAS project..."*, nhấn **`Y`** (Yes).
   - Nếu hệ thống hỏi *"Generate a new Android Keystore?"*, nhấn **`Y`** (Yes) để Expo tự tạo chữ ký số cho app.
   - Đợi khoảng 5–10 phút để máy chủ của Expo biên dịch xong và trả về đường link tải file `.apk`.

### Bước d: Tải và cài đặt file `.apk` lên điện thoại Android
1. Mở đường link do EAS Build cung cấp (hoặc quét mã QR sau khi build xong) trực tiếp trên điện thoại Android để tải file `.apk` về máy.
2. Nhấn vào file `.apk` vừa tải về để cài đặt.
3. Nếu điện thoại hiện thông báo bảo mật chặn cài đặt, hãy bấm vào **Cài đặt (Settings)** -> bật **Cho phép từ nguồn này (Allow from this source / Cài đặt ứng dụng không xác định)**, sau đó quay lại và bấm **Cài đặt (Install)**.
4. Nếu Google Play Protect hiện cảnh báo vì app nội bộ chưa đưa lên CH Play, bấm **Chi tiết khác (More details)** -> **Vẫn cài đặt (Install anyway)**.

---

## 3. Hướng dẫn tùy chỉnh và cập nhật về sau

### Cách đổi URL Google Apps Script khi Deploy bản mới
Mở file `src/config.ts` và thay giá trị của `WEB_APP_URL`:
```ts
export const CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/MA_DEPLOY_MOI_CUA_BAN/exec',
  // ...
};
```

### Cách đổi Icon và Màn hình chờ (Splash)
- Chuẩn bị ảnh định dạng `.png`:
  - `assets/icon.png`: kích thước vuông **1024x1024 px** (không bo góc).
  - `assets/adaptive-icon.png`: kích thước vuông **1024x1024 px** (nội dung logo chính nên nằm gọn trong vùng 660x660 px ở giữa).
  - `assets/splash.png`: kích thước **1284x2778 px**.
- Ghi đè các file ảnh mới vào thư mục `assets/` rồi chạy lại lệnh build APK.

### Cách đổi Tên ứng dụng, Package và tăng Version khi cập nhật
Mở file `app.json`:
- **Đổi tên hiển thị dưới icon app**: sửa trường `"name": "FPT Telecom - Cổng nhân viên"`.
- **Đổi tên gói (Package ID)**: sửa trường `"android": { "package": "com.fpttelecom.fptportal" }` (chỉ viết chữ thường, không dấu, ngăn cách bằng dấu chấm).
- **Tăng phiên bản khi cập nhật**:
  - Sửa `"version": "1.0.1"` (phiên bản hiển thị cho người dùng).
  - Sửa `"android": { "versionCode": 2 }` (số nguyên tăng dần 1, 2, 3... mỗi lần xuất bản mới).
