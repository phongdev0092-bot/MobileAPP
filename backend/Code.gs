/**
 * Nextsu AI - FPT Telecom (Cổng nhân viên)
 *
 * CẬP NHẬT MỚI:
 * 1. Đăng nhập xác thực bằng cột K (cột 11 - Email) trong sheet nhân sự:
 *    SHEET_ID = '17QLc9SlfpPPrR-d1R2BkBxA7DmCI5ZCuhmQffP5F6pY', GID = 32204814.
 * 2. Mật khẩu của nhân viên lưu trực tiếp tại cột H (cột 8 - Password) trên cùng dòng nhân sự đó.
 *    - Nếu cột H đang trống -> bắt buộc khởi tạo mật khẩu lần đầu và lưu vào cột H.
 *    - Hỗ trợ cả mật khẩu đã băm ("salt$hash") lẫn mật khẩu text có sẵn trong cột H (tự động nâng cấp lên băm khi đăng nhập).
 * 3. Hỗ trợ thêm doPost(e) trả về JSON API trực tiếp cho Mobile App React Native (Nextsu AI - FPT Telecom),
 *    đồng thời giữ nguyên toàn bộ hàm api... cho giao diện Web HTML.
 */

const CONFIG = {
  SHEET_ID: '17QLc9SlfpPPrR-d1R2BkBxA7DmCI5ZCuhmQffP5F6pY',
  GID: 32204814,               // gid của tab dữ liệu nhân viên
  HEADER_ROW: 1,               // dòng tiêu đề
  COL_NAME: 5,                 // Cột E (1 = A -> 5 = E): Họ và tên nhân viên
  COL_PASS: 8,                 // Cột H (1 = A -> 8 = H): cột lưu mật khẩu
  COL_EMAIL: 11,               // Cột K (1 = A -> 11 = K): cột Email đăng nhập
  COL_AVATAR: 22,              // Cột V (1 = A -> 22 = V): cột lưu hình ảnh nhân viên
  COL_ROLE: 30,                // Cột AD (1 = A -> 30 = AD): cột lưu Roles (User / Admin)
  SESSION_TTL: 6 * 60 * 60,    // giây (tối đa 21600 với CacheService)
  MAX_FAIL: 5,                 // sai tối đa
  LOCK_SEC: 10 * 60,           // khóa tạm (giây)
  MIN_PASSWORD: 6,
  // true: chặn đăng nhập nếu "Ngày làm Việc Cuối" đã có và <= hôm nay
  BLOCK_RESIGNED: false
};

// Bảng phân quyền Admin
const ACCOUNTS = {
  SHEET_ID: '1Sw-qSbLzvVdcW4rj7ywEZBEzKI6w5M82EQeYJUpdx7M',
  GID: 249541322,
  HEADER_ROW: 1,
  DEFAULT_ADMINS: ['phuongnam.phongnh5@fpt.net']   // luôn là Admin, không thể hạ quyền / xóa
};

// Sheet nhận yêu cầu Bypass
const BYPASS = {
  SHEET_ID: '1Sw-qSbLzvVdcW4rj7ywEZBEzKI6w5M82EQeYJUpdx7M',
  GID: 0,
  HEADER_ROW: 1,
  TASK: 'Bypass',
  CAUSE1: 'Bo Gong',
  CAUSE2_OPTIONS: ['Kh di day am tuong', 'Ha tang doi tac'],
  STATUS_NEW: 'Chưa cập nhật',
  PENDING_VALUES: ['chưa cập nhật', 'chưa xử lý'],
  DATE_FMT: 'dd/MM/yyyy HH:mm:ss'
};

// Sheet nhận yêu cầu Clear Cls có SR
const CLEARCLS = {
  SHEET_ID: '1Sw-qSbLzvVdcW4rj7ywEZBEzKI6w5M82EQeYJUpdx7M',
  GID: 987552880,
  HEADER_ROW: 1,
  TASK: 'Clear Cls có SR',
  CAUSE1_OPTIONS: ['KH có nhu cầu chuyển địa điểm', 'Tạo nhầm hợp đồng', 'KH không có nhu cầu bảo trì'],
  STATUS_NEW: 'Chưa cập nhật',
  RESULT_NEW: 'Chưa xử lý'
};

// Sheet nhận yêu cầu Bypass MyBAE (Mỹ Bảo)
const MYBAE = {
  SHEET_ID: '1Sw-qSbLzvVdcW4rj7ywEZBEzKI6w5M82EQeYJUpdx7M',
  GID: 1795923064,
  HEADER_ROW: 1,
  TASK: 'Bypass MyBAE',
  CAUSE1_OPTIONS: [
    'Không kết nối được hệ thống Mỹ Bảo',
    'Không đăng nhập được MobiX',
    'Không kết nối được wifi khách hàng',
    'Khách hàng không sử dụng wifi',
    'Điện thoại KTV không hỗ trợ đo kiểm'
  ],
  STATUS_NEW: 'Chưa cập nhật',
  RESULT_NEW: 'Chưa cập nhật',
  MAX_IMG_CHARS: 2800000,
  ROW_HEIGHT: 140
};

// Sheet nhận yêu cầu Phân Công Tay
const MANUAL = {
  SHEET_ID: '1Sw-qSbLzvVdcW4rj7ywEZBEzKI6w5M82EQeYJUpdx7M',
  GID: 909147347,
  HEADER_ROW: 1,
  TASK: 'Phân Công Tay',
  TYPE_OPTIONS: ['TRIỂN KHAI', 'BẢO TRÌ'],
  STATUS_NEW: 'Chưa cập nhật',
  COL_PARTNER: 3,
  COL_BLOCK: 4,
  COL_STAFF: 7,
  COL_STATUS: 13,
  STATUS_ACTIVE: 'active',
  LIMIT_HOURS: 24,
  MAX_BATCH: 30
};

// Sheet nhận yêu cầu SpamPool Ưu Tiên
const SPAMPOOL = {
  SHEET_ID: '1Sw-qSbLzvVdcW4rj7ywEZBEzKI6w5M82EQeYJUpdx7M',
  GID: 2070394876,
  HEADER_ROW: 1,
  TASK: 'Spampool Ưu Tiên',
  CAUSE_OPTIONS: ['Facebook/ Tiktok/ Youtube chậm', 'VPN công ty/ Camera chậm'],
  CAUSE_OTHER: 'Khác',
  OTHER_MIN: 3,
  OTHER_MAX: 200,
  STATUS_NEW: 'Chưa cập nhật',
  RESULT_NEW: 'Chưa cập nhật'
};

// Sheet nhận yêu cầu Reset MAC
const RESETMAC = {
  SHEET_ID: '1dXsWnon9myjDlcWM6BRLqDt_pxWBmTYFgb17k7R24vc',
  GID: 1100152201,
  HEADER_ROW: 1,
  RESULT_NEW: 'Chưa cập nhật'
};

// Sheet Lịch trực / Off theo Block
const LICHTRUC = {
  SHEET_ID: '1qd8O1bqbtHmbPUO_HhZv07YS9c27bo1QMWh4yvmQr2U',
  GID: 0,
  COL_MAIL: 1,      // A - Mail
  COL_MSNV: 2,      // B - MSNV
  COL_HOTEN: 3,     // C - Họ và tên
  COL_DOITAC: 4,    // D - Đối tác
  COL_BLOCK: 5,     // E - Block
  COL_DAY1: 6,      // F -> Ngày 1 (F..AJ = 1..31)
  COL_MONTH: 37,    // AK -> Tháng
  COL_YEAR: 38,     // AL -> Năm
  MAX_DAYS: 31,
  VAL_OFF: 'O',
  VAL_CA1: 'CA1'
};

/** Trang chính Web hoặc JSON API khi truyền ?api=1 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleJsonApi_(e.parameter);
  }
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Nextsu AI - FPT Telecom')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Endpoint JSON API cho ứng dụng di động React Native (Nextsu AI - FPT Telecom) */
function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    return handleJsonApi_(body);
  } catch (err) {
    return jsonOut_(serverError_(err));
  }
}

function handleJsonApi_(req) {
  const action = String(req.action || '');
  let res;
  switch (action) {
    case 'checkEmail':       res = apiCheckEmail(req.email); break;
    case 'login':            res = apiLogin(req.email, req.password); break;
    case 'setPassword':      res = apiSetPassword(req.email, req.password, req.confirm); break;
    case 'changePassword':   res = apiChangePassword(req.email, req.oldPassword, req.newPassword, req.confirm); break;
    case 'session':          res = apiSession(req.token); break;
    case 'logout':           res = apiLogout(req.token); break;
    case 'bypassSubmit':     res = apiBypassSubmit(req.token, req.shd, req.cause2, req.email); break;
    case 'bypassStatus':     res = apiBypassStatus(req.token, req.id, req.email); break;
    case 'clearSubmit':      res = apiClearSubmit(req.token, req.shd, req.cause1, req.email); break;
    case 'clearStatus':      res = apiClearStatus(req.token, req.id, req.email); break;
    case 'myBaeSubmit':      res = apiMyBaeSubmit(req.token, req.shd, req.cause1, req.image, req.email); break;
    case 'myBaeStatus':      res = apiMyBaeStatus(req.token, req.id, req.email); break;
    case 'manualOptions':    res = apiManualOptions(req.token, req.email); break;
    case 'manualSubmit':     res = apiManualSubmit(req.token, req.items, req.email); break;
    case 'manualStatus':     res = apiManualStatus(req.token, req.id, req.email); break;
    case 'manualStatusMany': res = apiManualStatusMany(req.token, req.ids, req.email); break;
    case 'spamSubmit':       res = apiSpamSubmit(req.token, req.shd, req.cause, req.other, req.email); break;
    case 'spamStatus':       res = apiSpamStatus(req.token, req.id, req.email); break;
    case 'resetMacSubmit':   res = apiResetMacSubmit(req.token, req.shd, req.email); break;
    case 'resetMacStatus':   res = apiResetMacStatus(req.token, req.id, req.email); break;
    case 'adminList':        res = apiAdminList(req.token); break;
    case 'adminSave':        res = apiAdminSave(req.token, req.data); break;
    case 'adminDelete':      res = apiAdminDelete(req.token, req.id); break;
    // API Lịch trực / Off theo Block
    case 'getThongTinNhanVien': res = getThongTinNhanVien(req.email); break;
    case 'getLichTrucBlock':    res = getLichTrucBlock(req.email, req.thang, req.nam); break;
    case 'kiemTraNgay':         res = kiemTraNgay(req.email, req.thang, req.nam, req.day); break;
    case 'layDanhSachGoiY':     res = layDanhSachGoiY(); break;
    case 'dangKyNgayOff':       res = dangKyNgayOff(req.email, req.thang, req.nam, req.day, req.value, req.matKhauBypass); break;
    // API Hồ sơ nhân sự (Tab User)
    case 'getMyProfile':        res = apiGetMyProfile(req.token, req.email); break;
    case 'updateMyProfile':     res = apiUpdateMyProfile(req.token, req.data, req.email); break;
    default:                 res = { ok: false, msg: 'Action không hợp lệ: ' + action };
  }
  return jsonOut_(res);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ===================== API đăng nhập (Xác thực cột K - Email, Mật khẩu cột H) ===================== */

/** Bước 1: kiểm tra email ở cột K (Email) có trong sheet không, và cột H (Password) đã có mật khẩu chưa */
function apiCheckEmail(email) {
  try {
    email = normEmail_(email);
    if (!isEmail_(email)) return { ok: false, msg: 'Email không hợp lệ.' };
    const emp = findEmployeeFresh_(email);
    if (!emp) return { ok: false, msg: 'Email này không có trong danh sách nhân viên (cột K).' };
    const blocked = checkBlocked_(emp);
    if (blocked) return { ok: false, msg: blocked };
    return {
      ok: true,
      name: emp.profile.name,
      code: emp.profile.code,
      partner: emp.profile.partner,
      hasPassword: !!emp.storedPass
    };
  } catch (e) {
    return serverError_(e);
  }
}

/** Bước 2a: đăng nhập (kiểm tra mật khẩu tại cột H) */
function apiLogin(email, password) {
  try {
    email = normEmail_(email);
    password = String(password || '');
    const emp = findEmployeeFresh_(email);
    if (!emp) return { ok: false, msg: 'Email này không có trong danh sách nhân viên (cột K).' };
    const blocked = checkBlocked_(emp);
    if (blocked) return { ok: false, msg: blocked };

    const lockMsg = lockMessage_(email);
    if (lockMsg) return { ok: false, msg: lockMsg };

    if (!emp.storedPass) {
      return { ok: false, msg: 'Tài khoản chưa khởi tạo mật khẩu.', needCreate: true };
    }

    let matched = false;
    let sessionHash = '';
    const sp = splitStored_(emp.storedPass);
    if (sp.hash) {
      // Mật khẩu đã băm dạng salt$hash ở cột H
      if (hash_(sp.salt, password) === sp.hash) {
        matched = true;
        sessionHash = sp.hash;
      }
    } else {
      // Nếu cột H đang lưu mật khẩu dạng văn bản thuần (plain text) -> so khớp và lưu chuẩn hóa
      if (emp.storedPass === password) {
        matched = true;
        sessionHash = hash_('plain', password);
      }
    }

    if (!matched) {
      const left = registerFail_(email);
      return { ok: false, msg: left > 0 ? 'Mật khẩu không đúng. Còn ' + left + ' lần thử.' : lockMessage_(email) };
    }

    clearFail_(email);
    const assignedRole = ensureEmployeeRoleColAD_(emp);
    emp.role = assignedRole;
    updateEmployeeCache_(email, emp);
    return { ok: true, token: newSession_(email, sessionHash), profile: withRole_(emp.profile, assignedRole) };
  } catch (e) {
    return serverError_(e);
  }
}

/** Bước 2b: khởi tạo mật khẩu lần đầu và lưu vào cột H trên sheet nhân sự (đồng thời gán Role vào cột AD) */
function apiSetPassword(email, password, confirm) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(15000);
    locked = true;
    email = normEmail_(email);
    password = String(password || '');
    const emp = findEmployeeFresh_(email);
    if (!emp) return { ok: false, msg: 'Email này không có trong danh sách nhân viên (cột K).' };
    const blocked = checkBlocked_(emp);
    if (blocked) return { ok: false, msg: blocked };

    if (emp.storedPass) {
      return { ok: false, msg: 'Tài khoản đã có mật khẩu, vui lòng đăng nhập.', hasPassword: true };
    }
    if (password.length < CONFIG.MIN_PASSWORD) {
      return { ok: false, msg: 'Mật khẩu tối thiểu ' + CONFIG.MIN_PASSWORD + ' ký tự.' };
    }
    if (password !== String(confirm || '')) {
      return { ok: false, msg: 'Mật khẩu nhập lại không khớp.' };
    }

    // Lưu mật khẩu vào cột H (cột 8) và Role vào cột AD (cột 30)
    const assignedRole = isDefaultAdmin_(email) ? 'Admin' : (emp.role === 'Admin' ? 'Admin' : 'User');
    setEmployeePassAndRole_(emp.row, password, assignedRole);
    emp.storedPass = password;
    emp.role = assignedRole;
    updateEmployeeCache_(email, emp);

    const sessionHash = hash_('plain', password);
    return { ok: true, token: newSession_(email, sessionHash), profile: withRole_(emp.profile, assignedRole) };
  } catch (e) {
    return serverError_(e);
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

/** Bước 2c: Đổi mật khẩu (kiểm tra mật khẩu cũ đang có và cập nhật mật khẩu mới vào đúng ô trên dòng của nhân viên đó) */
function apiChangePassword(email, oldPassword, newPassword, confirm) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(15000);
    locked = true;
    email = normEmail_(email);
    oldPassword = String(oldPassword || '');
    newPassword = String(newPassword || '');
    confirm = String(confirm || '');

    const emp = findEmployeeFresh_(email);
    if (!emp) return { ok: false, msg: 'Tài khoản không tồn tại trong hệ thống.' };
    const blocked = checkBlocked_(emp);
    if (blocked) return { ok: false, msg: blocked };

    const lockMsg = lockMessage_(email);
    if (lockMsg) return { ok: false, msg: lockMsg };

    if (!emp.storedPass) {
      return { ok: false, msg: 'Tài khoản chưa có mật khẩu. Vui lòng khởi tạo mật khẩu trước.', needCreate: true };
    }

    // Kiểm tra mật khẩu cũ
    let oldMatched = false;
    const sp = splitStored_(emp.storedPass);
    if (sp.hash) {
      if (hash_(sp.salt, oldPassword) === sp.hash) oldMatched = true;
    } else {
      if (emp.storedPass === oldPassword) oldMatched = true;
    }

    if (!oldMatched) {
      const left = registerFail_(email);
      return { ok: false, msg: left > 0 ? 'Mật khẩu hiện tại không đúng. Còn ' + left + ' lần thử.' : lockMessage_(email) };
    }

    if (newPassword.length < CONFIG.MIN_PASSWORD) {
      return { ok: false, msg: 'Mật khẩu mới phải từ ' + CONFIG.MIN_PASSWORD + ' ký tự trở lên.' };
    }
    if (newPassword === oldPassword) {
      return { ok: false, msg: 'Mật khẩu mới phải khác mật khẩu hiện tại.' };
    }
    if (newPassword !== confirm) {
      return { ok: false, msg: 'Mật khẩu xác nhận không khớp.' };
    }

    clearFail_(email);
    // Cập nhật mật khẩu mới vào đúng ô trên dòng nhân sự của người dùng
    setEmployeePassColH_(emp.row, newPassword);
    emp.storedPass = newPassword;
    updateEmployeeCache_(email, emp);

    const sessionHash = hash_('plain', newPassword);
    return {
      ok: true,
      msg: 'Đổi mật khẩu thành công.',
      token: newSession_(email, sessionHash),
      profile: withRole_(emp.profile, emp.role)
    };
  } catch (e) {
    return serverError_(e);
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

/* ===================== Hồ sơ nhân sự (Tab User) ===================== */

// Cột chỉ đọc (1-based)
const PROFILE_READONLY_COLS = {
  code: 6,      // F - Mã NV
  name: 5,      // E - Họ Tên NV
  status: 13,   // M - Tình trạng tài khoản
  email: 11,    // K - Email
  area: 21,     // U - Vị trí phụ trách
  partner: 3,   // C - Đối tác
  block: 4,     // D - Block
  inside: 7,    // G - Inside Account
  mobisale: 31  // AE - Mobisale
};
// Cột cho phép nhân viên tự chỉnh sửa (1-based)
const PROFILE_EDITABLE_COLS = {
  cccd: 9,       // I - CCCD 12 số
  address: 10,   // J - Địa chỉ thường trú
  phone: 12,     // L - SĐT cá nhân
  startDate: 27  // AA - Ngày vô công ty
};

function apiGetMyProfile(token, email) {
  try {
    let empEmail = sessionEmailFast_(token);
    if (!empEmail && email) empEmail = normEmail_(email);
    if (!empEmail) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    const emp = findEmployeeFresh_(empEmail);
    if (!emp) return { ok: false, msg: 'Không tìm thấy nhân viên.' };
    const sh = getDataSheet_();
    const width = Math.max(sh.getLastColumn(), PROFILE_READONLY_COLS.mobisale);
    const row = sh.getRange(emp.row, 1, 1, width).getDisplayValues()[0];
    const out = {};
    Object.keys(PROFILE_READONLY_COLS).forEach(function (k) { out[k] = String(row[PROFILE_READONLY_COLS[k] - 1] || '').trim(); });
    Object.keys(PROFILE_EDITABLE_COLS).forEach(function (k) { out[k] = String(row[PROFILE_EDITABLE_COLS[k] - 1] || '').trim(); });
    out.avatar = String(row[CONFIG.COL_AVATAR - 1] || '').trim();
    return { ok: true, profile: out };
  } catch (e) {
    return serverError_(e);
  }
}

function apiUpdateMyProfile(token, data, email) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    let empEmail = sessionEmailFast_(token);
    if (!empEmail && email) empEmail = normEmail_(email);
    if (!empEmail) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    data = data || {};
    const cccd = String(data.cccd || '').trim();
    const address = String(data.address || '').trim();
    const phone = String(data.phone || '').trim();
    const startDate = String(data.startDate || '').trim();

    if (cccd && !/^\d{12}$/.test(cccd)) return { ok: false, msg: 'CCCD phải gồm đúng 12 chữ số.' };
    if (phone && !/^0?\d{9,10}$/.test(phone)) return { ok: false, msg: 'Số điện thoại không hợp lệ.' };
    if (startDate && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(startDate)) return { ok: false, msg: 'Ngày vô công ty phải có dạng dd/MM/yyyy.' };
    if (address.length > 300) return { ok: false, msg: 'Địa chỉ quá dài (tối đa 300 ký tự).' };

    lock.waitLock(15000);
    locked = true;
    const emp = findEmployeeFresh_(empEmail);
    if (!emp) return { ok: false, msg: 'Không tìm thấy nhân viên.' };
    const sh = getDataSheet_();
    // Chỉ ghi vào đúng 4 ô được phép trên dòng của chính nhân viên đang đăng nhập
    sh.getRange(emp.row, PROFILE_EDITABLE_COLS.cccd).setNumberFormat('@').setValue(cccd);
    sh.getRange(emp.row, PROFILE_EDITABLE_COLS.address).setValue(address);
    sh.getRange(emp.row, PROFILE_EDITABLE_COLS.phone).setNumberFormat('@').setValue(phone);
    sh.getRange(emp.row, PROFILE_EDITABLE_COLS.startDate).setNumberFormat('@').setValue(startDate);
    SpreadsheetApp.flush();
    try { CacheService.getScriptCache().remove('E_' + empEmail); } catch (x) {}
    return { ok: true, msg: 'Đã cập nhật thông tin cá nhân.' };
  } catch (e) {
    return serverError_(e);
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

/** Ghi mật khẩu vào cột H (cột thứ 8) của sheet nhân viên */
function setEmployeePassColH_(rowNumber, value) {
  const sh = getDataSheet_();
  sh.getRange(rowNumber, CONFIG.COL_PASS).setNumberFormat('@').setValue(value);
  SpreadsheetApp.flush();
}

/** Ghi đồng thời mật khẩu vào cột H (8) và Role vào cột AD (30) */
function setEmployeePassAndRole_(rowNumber, passValue, roleValue) {
  const sh = getDataSheet_();
  if (sh.getMaxColumns() < CONFIG.COL_ROLE) {
    sh.insertColumnsAfter(sh.getMaxColumns(), CONFIG.COL_ROLE - sh.getMaxColumns());
  }
  const hdrCell = sh.getRange(CONFIG.HEADER_ROW, CONFIG.COL_ROLE);
  if (!String(hdrCell.getValue() || '').trim()) {
    hdrCell.setValue('Roles');
  }
  sh.getRange(rowNumber, CONFIG.COL_PASS).setNumberFormat('@').setValue(passValue);
  sh.getRange(rowNumber, CONFIG.COL_ROLE).setNumberFormat('@').setValue(roleValue);
  SpreadsheetApp.flush();
}

/** Đảm bảo cột AD (30) có lưu Role (phuongnam.phongnh5@fpt.net mặc định là Admin, còn lại là User) */
function ensureEmployeeRoleColAD_(emp) {
  const targetRole = isDefaultAdmin_(emp.profile.email) ? 'Admin' : (emp.role === 'Admin' ? 'Admin' : 'User');
  if (emp.rawRoleColAD !== targetRole) {
    try {
      const sh = getDataSheet_();
      if (sh.getMaxColumns() < CONFIG.COL_ROLE) {
        sh.insertColumnsAfter(sh.getMaxColumns(), CONFIG.COL_ROLE - sh.getMaxColumns());
      }
      const hdrCell = sh.getRange(CONFIG.HEADER_ROW, CONFIG.COL_ROLE);
      if (!String(hdrCell.getValue() || '').trim()) {
        hdrCell.setValue('Roles');
      }
      sh.getRange(emp.row, CONFIG.COL_ROLE).setNumberFormat('@').setValue(targetRole);
      SpreadsheetApp.flush();
    } catch (e) {}
  }
  return targetRole;
}

/** Khôi phục phiên đăng nhập từ token lưu ở thiết bị */
function apiSession(token) {
  try {
    const s = requireSession_(token);
    if (!s) return { ok: false };
    return { ok: true, profile: withRole_(s.emp.profile, s.emp.role) };
  } catch (e) {
    return { ok: false };
  }
}

function apiLogout(token) {
  try { if (token) CacheService.getScriptCache().remove('S_' + token); } catch (e) {}
  return { ok: true };
}

/* ===================== Dữ liệu nhân viên (Cột K = Email, Cột H = Password) ===================== */

function getDataSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = ss.getSheets().filter(function (s) { return s.getSheetId() === CONFIG.GID; })[0];
  if (!sh) throw new Error('Không tìm thấy tab nhân sự có gid=' + CONFIG.GID);
  return sh;
}

function normHeader_(s) {
  return String(s || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function updateEmployeeCache_(email, emp) {
  try {
    CacheService.getScriptCache().put('E_' + email, JSON.stringify(emp), 300);
  } catch (e) {}
}

function findEmployee_(email) {
  const cache = CacheService.getScriptCache();
  const key = 'E_' + email;
  const hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const emp = findEmployeeFresh_(email);
  if (emp) updateEmployeeCache_(email, emp);
  return emp;
}

/**
 * Tìm nhân viên theo cột K (Email - cột 11) và đọc mật khẩu tại cột H (Password - cột 8)
 */
function findEmployeeFresh_(email) {
  const sh = getDataSheet_();
  const lastCol = sh.getLastColumn();
  const lastRow = sh.getLastRow();
  if (lastRow <= CONFIG.HEADER_ROW) return null;

  const headers = sh.getRange(CONFIG.HEADER_ROW, 1, 1, lastCol).getValues()[0].map(normHeader_);
  const col = function (name) { return headers.indexOf(normHeader_(name)); };

  // Ưu tiên đúng cột K (index 10) hoặc cột có tên "Email"
  const cEmail = CONFIG.COL_EMAIL - 1;
  const cPass = CONFIG.COL_PASS - 1;

  const n = lastRow - CONFIG.HEADER_ROW;
  const emails = sh.getRange(CONFIG.HEADER_ROW + 1, cEmail + 1, n, 1).getValues();
  let idx = -1;
  for (let i = 0; i < n; i++) {
    if (normEmail_(emails[i][0]) === email) { idx = i; break; }
  }
  if (idx < 0) return null;

  const rowNumber = CONFIG.HEADER_ROW + 1 + idx;
  const width = Math.max(lastCol, CONFIG.COL_ROLE);
  const row = sh.getRange(rowNumber, 1, 1, width).getDisplayValues()[0];
  const get = function (name) { const c = col(name); return c < 0 ? '' : String(row[c] || '').trim(); };

  const storedPass = String(row[cPass] || '').trim();
  const rawRoleColAD = String(row[CONFIG.COL_ROLE - 1] || '').trim();
  const resolvedRole = isDefaultAdmin_(email)
    ? 'Admin'
    : (rawRoleColAD.toLowerCase() === 'admin' ? 'Admin' : 'User');

  // Cột E (index 4) là Họ và tên nhân viên, Cột V (index 21) là Hình ảnh nhân viên
  const empName = String(row[CONFIG.COL_NAME - 1] || get('Họ Tên NV') || '').trim();
  const empAvatar = String(row[CONFIG.COL_AVATAR - 1] || get('Hình ảnh') || '').trim();

  return {
    row: rowNumber,
    storedPass: storedPass,
    rawRoleColAD: rawRoleColAD,
    role: resolvedRole,
    lastWorkDay: get('Ngày làm Việc Cuối'),
    profile: {
      email: email,
      name: empName,
      code: get('Mã NV'),
      title: get('Chức danh'),
      region: get('Vùng'),
      partner: get('Đối tác'),
      block: get('Block'),
      phone: get('Số điện thoại'),
      area: get('Vị trí phụ trách'),
      inside: get('Inside Account'),
      avatar: empAvatar,
      role: resolvedRole
    }
  };
}

function checkBlocked_(emp) {
  if (!CONFIG.BLOCK_RESIGNED || !emp.lastWorkDay) return null;
  const d = parseDate_(emp.lastWorkDay);
  if (d && d.getTime() <= Date.now()) return 'Tài khoản đã ngưng hoạt động.';
  return null;
}

function parseDate_(s) {
  const m = String(s).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/* ===================== Vai trò / phiên ===================== */

function isDefaultAdmin_(email) {
  return ACCOUNTS.DEFAULT_ADMINS.map(normEmail_).indexOf(normEmail_(email)) >= 0;
}

function roleOf_(email, stored) {
  if (isDefaultAdmin_(email)) return 'Admin';
  return String(stored || '').trim().toLowerCase() === 'admin' ? 'Admin' : 'User';
}

function withRole_(profile, storedRole) {
  const p = {};
  Object.keys(profile).forEach(function (k) { p[k] = profile[k]; });
  p.role = roleOf_(profile.email, storedRole);
  return p;
}

function splitStored_(stored) {
  const i = String(stored).indexOf('$');
  if (i < 0) return { salt: '', hash: '' };
  return { salt: stored.slice(0, i), hash: stored.slice(i + 1) };
}

function newSession_(email, hash) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  CacheService.getScriptCache().put('S_' + token, email + '|' + String(hash || '').slice(0, 16), Math.min(CONFIG.SESSION_TTL, 21600));
  return token;
}

function requireSession_(token, emailHint) {
  if (token) {
    const v = CacheService.getScriptCache().get('S_' + token);
    if (v) {
      const i = v.indexOf('|');
      if (i >= 0) {
        const email = v.slice(0, i);
        const emp = findEmployee_(email);
        if (emp && !checkBlocked_(emp) && emp.storedPass) {
          return { email: email, emp: emp, role: roleOf_(email, emp.role) };
        }
      }
    }
  }
  // Dự phòng: Xác thực nhân sự hợp lệ trực tiếp từ Sheet khi token hết hạn trên Cache
  if (emailHint) {
    const norm = normEmail_(emailHint);
    const emp = findEmployeeFresh_(norm);
    if (emp && !checkBlocked_(emp)) {
      return { email: norm, emp: emp, role: roleOf_(norm, emp.role) };
    }
  }
  return null;
}

function requireAdmin_(token) {
  const s = requireSession_(token);
  if (!s) return { err: { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' } };
  if (s.role !== 'Admin') return { err: { ok: false, msg: 'Bạn không có quyền thực hiện thao tác này.' } };
  return { s: s };
}

/* ===================== Các API Quản trị & Nghiệp vụ (Bypass, Clear Cls, MyBAE, Phân Công Tay, SpamPool, Reset MAC) ===================== */
/* (Giữ nguyên toàn bộ các hàm getBypassSheet_, getClearSheet_, getMyBaeSheet_, getManualSheet_, getSpamSheet_, getResetMacSheet_,
   submitRequest_, submitMyBae_, submitManualBatch_, submitSpam_, submitResetMac_, requestStatus_, spamStatus_, resetMacStatus_
   như trong file gốc của bạn) */

function getBypassSheet_() {
  const ss = SpreadsheetApp.openById(BYPASS.SHEET_ID);
  const sh = ss.getSheets().filter(function (s) { return s.getSheetId() === BYPASS.GID; })[0];
  if (!sh) throw new Error('Không tìm thấy tab Bypass (gid=' + BYPASS.GID + ')');
  return sh;
}

function getClearSheet_() {
  const ss = SpreadsheetApp.openById(CLEARCLS.SHEET_ID);
  const sh = ss.getSheets().filter(function (s) { return s.getSheetId() === CLEARCLS.GID; })[0];
  if (!sh) throw new Error('Không tìm thấy tab Clear Cls (gid=' + CLEARCLS.GID + ')');
  return sh;
}

function getMyBaeSheet_() {
  const ss = SpreadsheetApp.openById(MYBAE.SHEET_ID);
  const sh = ss.getSheets().filter(function (s) { return s.getSheetId() === MYBAE.GID; })[0];
  if (!sh) throw new Error('Không tìm thấy tab Bypass MyBAE (gid=' + MYBAE.GID + ')');
  return sh;
}

function getManualSheet_() {
  const ss = SpreadsheetApp.openById(MANUAL.SHEET_ID);
  const sh = ss.getSheets().filter(function (s) { return s.getSheetId() === MANUAL.GID; })[0];
  if (!sh) throw new Error('Không tìm thấy tab Phân Công Tay (gid=' + MANUAL.GID + ')');
  return sh;
}

function apiBypassSubmit(token, shd, cause2, emailHint) { return submitRequest_('bypass', token, shd, cause2, emailHint); }
function apiClearSubmit(token, shd, cause1, emailHint) { return submitRequest_('clear', token, shd, cause1, emailHint); }
function apiMyBaeSubmit(token, shd, cause1, image, emailHint) { return submitMyBae_(token, shd, cause1, image, emailHint); }
function apiManualSubmit(token, items, emailHint) { return submitManualBatch_(token, items, emailHint); }

function getManualTree_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('MANUAL_TREE_ACTIVE');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  const sh = getDataSheet_();
  const H = CONFIG.HEADER_ROW;
  const n = sh.getLastRow() - H;
  const map = {};
  if (n > 0) {
    const width = Math.max(MANUAL.COL_PARTNER, MANUAL.COL_BLOCK, MANUAL.COL_STAFF, MANUAL.COL_STATUS);
    const vals = sh.getRange(H + 1, 1, n, width).getDisplayValues();
    vals.forEach(function (r) {
      if (String(r[MANUAL.COL_STATUS - 1]).normalize('NFC').trim().toLowerCase() !== MANUAL.STATUS_ACTIVE) return;
      const p = String(r[MANUAL.COL_PARTNER - 1]).normalize('NFC').trim();
      const b = String(r[MANUAL.COL_BLOCK - 1]).normalize('NFC').trim();
      const s = String(r[MANUAL.COL_STAFF - 1]).normalize('NFC').trim();
      if (!p || !b || !s) return;
      map[p] = map[p] || {};
      map[p][b] = map[p][b] || {};
      map[p][b][s] = true;
    });
  }
  const tree = Object.keys(map).sort().map(function (p) {
    return {
      name: p,
      blocks: Object.keys(map[p]).sort().map(function (b) {
        return { name: b, staff: Object.keys(map[p][b]).sort() };
      })
    };
  });
  try { cache.put('MANUAL_TREE_ACTIVE', JSON.stringify(tree), 300); } catch (e) {}
  return tree;
}

function apiManualOptions(token) {
  try {
    if (!sessionEmailFast_(token)) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    const staff = [];
    getManualTree_().forEach(function (p) {
      p.blocks.forEach(function (b) {
        b.staff.forEach(function (s) { staff.push([s, p.name, b.name]); });
      });
    });
    staff.sort(function (a, b) { return a[0].localeCompare(b[0], 'vi'); });
    return { ok: true, types: MANUAL.TYPE_OPTIONS, staff: staff };
  } catch (e) {
    return serverError_(e);
  }
}

function validateManual_(d, tree) {
  d = d || {};
  tree = tree || getManualTree_();
  const type = String(d.type || '').trim();
  const partner = String(d.partner || '').normalize('NFC').trim();
  const block = String(d.block || '').normalize('NFC').trim();
  const staff = String(d.staff || '').normalize('NFC').trim();
  if (MANUAL.TYPE_OPTIONS.indexOf(type) < 0) return { err: { ok: false, msg: 'Loại tác vụ không hợp lệ.' } };
  const p = tree.filter(function (x) { return x.name === partner; })[0];
  if (!p) return { err: { ok: false, msg: 'Đối tác đến không hợp lệ.' } };
  const b = p.blocks.filter(function (x) { return x.name === block; })[0];
  if (!b) return { err: { ok: false, msg: 'Block đến không thuộc đối tác đã chọn.' } };
  if (b.staff.indexOf(staff) < 0) return { err: { ok: false, msg: 'Nhân viên đến không thuộc block đã chọn.' } };
  return { val: { type: type, partner: partner, block: block, staff: staff } };
}

function submitManualBatch_(token, items, emailHint) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const s = requireSession_(token, emailHint);
    if (!s) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    const email = s.email;
    const emp = s.emp;
    if (!emp.profile.code) return { ok: false, msg: 'Tài khoản chưa có Mã NV trong danh sách.' };
    if (!emp.profile.inside) return { ok: false, msg: 'Tài khoản chưa có Inside Account trong danh sách.' };
    if (!Array.isArray(items) || !items.length) return { ok: false, msg: 'Chưa có hợp đồng nào để gửi.' };
    if (items.length > MANUAL.MAX_BATCH) return { ok: false, msg: 'Tối đa ' + MANUAL.MAX_BATCH + ' hợp đồng mỗi lần gửi.' };

    const tree = getManualTree_();
    const results = [];
    const good = [];
    const seen = {};
    items.forEach(function (it, idx) {
      it = it || {};
      const shd = String(it.shd || '').trim().toUpperCase();
      const res = { shd: shd, ok: false };
      results[idx] = res;
      if (!/^[A-Z0-9][A-Z0-9._\-\/]{3,29}$/.test(shd)) { res.msg = 'SHD không hợp lệ.'; return; }
      const v = validateManual_(it, tree);
      if (v.err) { res.msg = v.err.msg; return; }
      res.type = v.val.type;
      const key = shd + '|' + v.val.type;
      if (seen[key]) { res.msg = 'Trùng SHD + Loại tác vụ trong cùng lần gửi.'; return; }
      seen[key] = true;
      good.push({ idx: idx, shd: shd, v: v.val });
    });
    if (!good.length) return { ok: true, results: results, saved: 0 };

    lock.waitLock(20000);
    locked = true;

    const sh = getManualSheet_();
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(MANUAL.HEADER_ROW, 1, 1, lastCol).getValues()[0].map(normHeader_);
    const names = ['ID', 'Tác Vụ', 'Email', 'MSNV', 'Account Inside', 'SHD', 'Loại Tác Vụ', 'Đối tác đến', 'Block Đến', 'Nhân Viên Đến', 'Ngày Cập Nhật', 'Thao Tác'];
    const c = {};
    names.forEach(function (n) {
      const i = headers.indexOf(normHeader_(n));
      if (i < 0) throw new Error('Sheet thiếu cột "' + n + '"');
      c[n] = i;
    });

    const H = MANUAL.HEADER_ROW;
    const n = sh.getLastRow() - H;
    let maxId = 0;
    let lastDataRow = H;
    const hist = {};
    if (n > 0) {
      const col = function (name) { return sh.getRange(H + 1, c[name] + 1, n, 1); };
      const ids = col('ID').getValues();
      const shds = col('SHD').getDisplayValues();
      const types = col('Loại Tác Vụ').getDisplayValues();
      const staffs = col('Nhân Viên Đến').getDisplayValues();
      const dates = col('Ngày Cập Nhật').getValues();
      const sts = col('Thao Tác').getDisplayValues();
      const mails = col('Email').getDisplayValues();
      const want = {};
      good.forEach(function (g) { want[g.shd] = true; });
      for (let i = 0; i < n; i++) {
        const v = parseInt(ids[i][0], 10);
        if (!isNaN(v) && v > maxId) maxId = v;
        if (ids[i][0] !== '') lastDataRow = H + 1 + i;
        const shd = String(shds[i][0]).normalize('NFC').trim().toUpperCase();
        if (!want[shd]) continue;
        (hist[shd] = hist[shd] || []).push({
          type: String(types[i][0]).normalize('NFC').trim().toUpperCase(),
          staff: String(staffs[i][0]).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase(),
          ms: toTime_(dates[i][0]),
          pending: isPendingStatus_(sts[i][0]),
          id: String(ids[i][0]),
          email: normEmail_(mails[i][0])
        });
      }
    }

    const limitMs = MANUAL.LIMIT_HOURS * 3600 * 1000;
    const nowMs = Date.now();
    const fmt = function (ms) { return Utilities.formatDate(new Date(ms), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm'); };
    const accepted = [];
    good.forEach(function (g) {
      const res = results[g.idx];
      const myType = g.v.type.toUpperCase();
      const myStaff = String(g.v.staff).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
      const rel = (hist[g.shd] || []).filter(function (h) { return !h.type || h.type === myType; });

      const pend = rel.filter(function (h) { return h.pending; })[0];
      if (pend) {
        if (pend.email === email) { res.ok = true; res.resumed = true; res.id = pend.id; return; }
        res.msg = 'SHD ' + g.shd + ' (' + g.v.type + ') đã được gửi và đang chờ xử lý.';
        return;
      }
      let lastMs = 0;
      rel.forEach(function (h) {
        if (h.ms && nowMs - h.ms < limitMs && h.staff !== myStaff && h.ms > lastMs) lastMs = h.ms;
      });
      if (lastMs) {
        res.blocked = true;
        res.msg = 'Đã PTC ' + g.v.type + ' lúc ' + fmt(lastMs) + ' cho nhân sự khác. Mỗi hợp đồng chỉ PTC 1 lần/' + MANUAL.LIMIT_HOURS +
          'H cho mỗi loại tác vụ (trừ khi PTC lại cho cùng nhân sự đến), gửi lại sau ' + fmt(lastMs + limitMs) + ' hoặc liên hệ đội trưởng.';
        return;
      }
      accepted.push(g);
    });

    if (accepted.length) {
      const k = accepted.length;
      const newRow = lastDataRow + 1;
      const needMax = newRow + k - 1;
      if (needMax > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), needMax - sh.getMaxRows());
      const now = new Date();
      const TEXT_COLS = ['MSNV', 'SHD', 'Account Inside', 'Đối tác đến', 'Block Đến', 'Nhân Viên Đến'];
      const valOf = function (name, g, i) {
        switch (name) {
          case 'ID': return maxId + 1 + i;
          case 'Tác Vụ': return MANUAL.TASK;
          case 'Email': return email;
          case 'MSNV': return emp.profile.code;
          case 'Account Inside': return emp.profile.inside;
          case 'SHD': return g.shd;
          case 'Loại Tác Vụ': return g.v.type;
          case 'Đối tác đến': return g.v.partner;
          case 'Block Đến': return g.v.block;
          case 'Nhân Viên Đến': return g.v.staff;
          case 'Ngày Cập Nhật': return now;
          case 'Thao Tác': return MANUAL.STATUS_NEW;
        }
        return '';
      };
      names.forEach(function (nm) {
        const rg = sh.getRange(newRow, c[nm] + 1, k, 1);
        if (TEXT_COLS.indexOf(nm) >= 0) rg.setNumberFormat('@');
        if (nm === 'Ngày Cập Nhật') rg.setNumberFormat(BYPASS.DATE_FMT);
        rg.setValues(accepted.map(function (g, i) { return [valOf(nm, g, i)]; }));
      });
      SpreadsheetApp.flush();
      accepted.forEach(function (g, i) {
        const res = results[g.idx];
        res.ok = true;
        res.id = String(maxId + 1 + i);
      });
    }
    return { ok: true, results: results, saved: accepted.length };
  } catch (e) {
    console.error(e);
    return { ok: false, msg: 'Lỗi hệ thống: ' + (e && e.message ? e.message : e) };
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

function submitRequest_(kind, token, shd, cause, emailHint) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const s = requireSession_(token, emailHint);
    if (!s) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    const email = s.email;
    const emp = s.emp;
    if (!emp.profile.code) return { ok: false, msg: 'Tài khoản chưa có Mã NV trong danh sách.' };
    if (!emp.profile.inside) return { ok: false, msg: 'Tài khoản chưa có Inside Account trong danh sách.' };

    shd = String(shd || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._\-\/]{3,29}$/.test(shd)) return { ok: false, msg: 'SHD không hợp lệ.' };

    const isClear = kind === 'clear';
    const cfg = isClear ? CLEARCLS : BYPASS;
    cause = String(cause || '').trim();
    if (isClear) {
      if (CLEARCLS.CAUSE1_OPTIONS.indexOf(cause) < 0) return { ok: false, msg: 'Nguyên nhân 1 không hợp lệ.' };
    } else {
      if (BYPASS.CAUSE2_OPTIONS.indexOf(cause) < 0) return { ok: false, msg: 'Nguyên nhân 2 không hợp lệ.' };
    }

    lock.waitLock(20000);
    locked = true;

    const sh = isClear ? getClearSheet_() : getBypassSheet_();
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(cfg.HEADER_ROW, 1, 1, lastCol).getValues()[0].map(normHeader_);
    const names = isClear
      ? ['ID', 'Tác Vụ', 'Email', 'MSNV', 'Account Inside', 'SHD', 'Nguyên Nhân 1', 'Ngày Cập Nhật', 'Thao Tác', 'Kết quả']
      : ['ID', 'Tác Vụ', 'Email', 'MSNV', 'Account Inside', 'SHD', 'Nguyên Nhân 1', 'Nguyên Nhân 2', 'Ngày Cập Nhật', 'Thao Tác'];
    const c = {};
    names.forEach(function (n) {
      const i = headers.indexOf(normHeader_(n));
      if (i < 0) throw new Error('Sheet thiếu cột "' + n + '"');
      c[n] = i;
    });
    const cResult = isClear ? c['Kết quả'] : -1;

    const H = cfg.HEADER_ROW;
    const lastRow = sh.getLastRow();
    let maxId = 0;
    let lastDataRow = H;
    if (lastRow > H) {
      const n = lastRow - H;
      const first = H + 1;
      const ids = sh.getRange(first, c['ID'] + 1, n, 1).getValues();
      for (let i = 0; i < n; i++) {
        const v = parseInt(ids[i][0], 10);
        if (!isNaN(v) && v > maxId) maxId = v;
        if (ids[i][0] !== '') lastDataRow = first + i;
      }
      const hits = sh.getRange(first, c['SHD'] + 1, n, 1).createTextFinder(shd).matchEntireCell(true).findAll();
      for (let k = 0; k < hits.length && k < 20; k++) {
        const rv = sh.getRange(hits[k].getRow(), 1, 1, lastCol).getDisplayValues()[0];
        if (isPendingStatus_(isClear ? rv[c['Kết quả']] : rv[c['Thao Tác']])) {
          if (normEmail_(rv[c['Email']]) === email) {
            return { ok: true, resumed: true, id: String(rv[c['ID']]), shd: shd };
          }
          return { ok: false, msg: 'SHD ' + shd + ' đã được gửi và đang chờ xử lý.' };
        }
      }
    }

    const newId = maxId + 1;
    const newRow = lastDataRow + 1;
    if (newRow > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), newRow - sh.getMaxRows());

    const vals = {
      'ID': newId,
      'Tác Vụ': cfg.TASK,
      'Email': email,
      'MSNV': emp.profile.code,
      'Account Inside': emp.profile.inside,
      'SHD': shd,
      'Ngày Cập Nhật': new Date(),
      'Thao Tác': cfg.STATUS_NEW
    };
    vals['Nguyên Nhân 1'] = isClear ? cause : BYPASS.CAUSE1;
    if (!isClear) vals['Nguyên Nhân 2'] = cause;

    const TEXT_COLS = ['MSNV', 'SHD', 'Account Inside'];
    Object.keys(vals).forEach(function (n) {
      const cell = sh.getRange(newRow, c[n] + 1);
      if (TEXT_COLS.indexOf(n) >= 0) cell.setNumberFormat('@');
      if (n === 'Ngày Cập Nhật') cell.setNumberFormat(BYPASS.DATE_FMT);
      cell.setValue(vals[n]);
    });
    if (cResult >= 0) sh.getRange(newRow, cResult + 1).setValue(CLEARCLS.RESULT_NEW);
    SpreadsheetApp.flush();

    return { ok: true, id: newId, shd: shd };
  } catch (e) {
    console.error(e);
    return { ok: false, msg: 'Lỗi hệ thống: ' + (e && e.message ? e.message : e) };
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

function submitMyBae_(token, shd, cause1, image, emailHint) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const s = requireSession_(token, emailHint);
    if (!s) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    const email = s.email;
    const emp = s.emp;
    if (!emp.profile.code) return { ok: false, msg: 'Tài khoản chưa có Mã NV trong danh sách.' };
    if (!emp.profile.inside) return { ok: false, msg: 'Tài khoản chưa có Inside Account trong danh sách.' };

    shd = String(shd || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._\-\/]{3,29}$/.test(shd)) return { ok: false, msg: 'SHD không hợp lệ.' };
    cause1 = String(cause1 || '').trim();
    if (MYBAE.CAUSE1_OPTIONS.indexOf(cause1) < 0) return { ok: false, msg: 'Nguyên nhân 1 không hợp lệ.' };
    image = String(image || '');
    if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+\/=]+$/.test(image)) return { ok: false, msg: 'Vui lòng đính kèm hình ảnh hợp lệ.' };
    if (image.length > MYBAE.MAX_IMG_CHARS) return { ok: false, msg: 'Hình ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn.' };

    lock.waitLock(20000);
    locked = true;

    const sh = getMyBaeSheet_();
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(MYBAE.HEADER_ROW, 1, 1, lastCol).getValues()[0].map(normHeader_);
    const names = ['ID', 'Tác Vụ', 'Email', 'MSNV', 'Account Inside', 'SHD', 'Nguyên Nhân 1', 'Hình ảnh', 'Ngày Cập Nhật', 'Kết Quả', 'Thao Tác'];
    const c = {};
    names.forEach(function (n) {
      const i = headers.indexOf(normHeader_(n));
      if (i < 0) throw new Error('Sheet thiếu cột "' + n + '"');
      c[n] = i;
    });

    const H = MYBAE.HEADER_ROW;
    const lastRow = sh.getLastRow();
    let maxId = 0;
    let lastDataRow = H;
    if (lastRow > H) {
      const n = lastRow - H;
      const first = H + 1;
      const ids = sh.getRange(first, c['ID'] + 1, n, 1).getValues();
      for (let i = 0; i < n; i++) {
        const v = parseInt(ids[i][0], 10);
        if (!isNaN(v) && v > maxId) maxId = v;
        if (ids[i][0] !== '') lastDataRow = first + i;
      }
      const hits = sh.getRange(first, c['SHD'] + 1, n, 1).createTextFinder(shd).matchEntireCell(true).findAll();
      for (let k = 0; k < hits.length && k < 20; k++) {
        const rv = sh.getRange(hits[k].getRow(), 1, 1, lastCol).getDisplayValues()[0];
        if (isPendingStatus_(rv[c['Kết Quả']])) {
          if (normEmail_(rv[c['Email']]) === email) {
            return { ok: true, resumed: true, id: String(rv[c['ID']]), shd: shd };
          }
          return { ok: false, msg: 'SHD ' + shd + ' đã được gửi và đang chờ xử lý.' };
        }
      }
    }

    const newId = maxId + 1;
    const newRow = lastDataRow + 1;
    if (newRow > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), newRow - sh.getMaxRows());

    const vals = {
      'ID': newId,
      'Tác Vụ': MYBAE.TASK,
      'Email': email,
      'MSNV': emp.profile.code,
      'Account Inside': emp.profile.inside,
      'SHD': shd,
      'Nguyên Nhân 1': cause1,
      'Ngày Cập Nhật': new Date(),
      'Kết Quả': MYBAE.RESULT_NEW,
      'Thao Tác': MYBAE.STATUS_NEW
    };
    const TEXT_COLS = ['MSNV', 'SHD', 'Account Inside'];
    Object.keys(vals).forEach(function (n) {
      const cell = sh.getRange(newRow, c[n] + 1);
      if (TEXT_COLS.indexOf(n) >= 0) cell.setNumberFormat('@');
      if (n === 'Ngày Cập Nhật') cell.setNumberFormat(BYPASS.DATE_FMT);
      cell.setValue(vals[n]);
    });

    const img = SpreadsheetApp.newCellImage().setSourceUrl(image).setAltTextTitle('SHD ' + shd).build();
    sh.getRange(newRow, c['Hình ảnh'] + 1).setValue(img);
    sh.setRowHeight(newRow, MYBAE.ROW_HEIGHT);
    SpreadsheetApp.flush();

    return { ok: true, id: newId, shd: shd };
  } catch (e) {
    console.error(e);
    return { ok: false, msg: 'Lỗi hệ thống: ' + (e && e.message ? e.message : e) };
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

function toTime_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? 0 : v.getTime();
  const s = String(v || '').trim();
  if (!s) return 0;
  try { return Utilities.parseDate(s, 'Asia/Ho_Chi_Minh', BYPASS.DATE_FMT).getTime(); } catch (e) {}
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function isPendingStatus_(s) {
  const v = normHeader_(s);
  return v === '' || BYPASS.PENDING_VALUES.indexOf(v) >= 0;
}

function sessionEmailFast_(token, emailHint) {
  if (token) {
    const v = CacheService.getScriptCache().get('S_' + token);
    if (v) {
      const i = v.indexOf('|');
      if (i >= 0) return v.slice(0, i);
    }
  }
  if (emailHint) return normEmail_(emailHint);
  return null;
}

function apiBypassStatus(token, id, emailHint) { return requestStatus_('bypass', token, id, emailHint); }
function apiClearStatus(token, id, emailHint) { return requestStatus_('clear', token, id, emailHint); }
function apiMyBaeStatus(token, id, emailHint) { return requestStatus_('mybae', token, id, emailHint); }
function apiManualStatus(token, id, emailHint) { return requestStatus_('manual', token, id, emailHint); }

function apiManualStatusMany(token, ids, emailHint) {
  try {
    const email = sessionEmailFast_(token, emailHint);
    if (!email) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    if (!Array.isArray(ids) || !ids.length || ids.length > MANUAL.MAX_BATCH) return { ok: false, msg: 'Danh sách mã yêu cầu không hợp lệ.' };
    const want = {};
    ids.forEach(function (id) { id = String(id || '').trim(); if (/^\d{1,12}$/.test(id)) want[id] = true; });

    const sh = getManualSheet_();
    const H = MANUAL.HEADER_ROW;
    const headers = sh.getRange(H, 1, 1, sh.getLastColumn()).getValues()[0].map(normHeader_);
    const cId = headers.indexOf(normHeader_('ID'));
    const cMail = headers.indexOf(normHeader_('Email'));
    const cSt = headers.indexOf(normHeader_('Thao Tác'));
    if (cId < 0 || cMail < 0 || cSt < 0) throw new Error('Sheet thiếu cột ID / Email / Thao Tác');

    const lastRow = sh.getLastRow();
    const out = {};
    if (lastRow > H) {
      const start = Math.max(H + 1, lastRow - 1999);
      const cnt = lastRow - start + 1;
      const rd = function (ci) { return sh.getRange(start, ci + 1, cnt, 1).getDisplayValues(); };
      const a = rd(cId), b = rd(cMail), d = rd(cSt);
      for (let i = 0; i < cnt; i++) {
        const id = String(a[i][0]).trim();
        if (!want[id] || normEmail_(b[i][0]) !== email) continue;
        out[id] = { status: String(d[i][0] || '').normalize('NFC').trim(), pending: isPendingStatus_(d[i][0]) };
      }
    }
    return { ok: true, items: out };
  } catch (e) {
    return serverError_(e);
  }
}

function requestStatus_(kind, token, id, emailHint) {
  try {
    const email = sessionEmailFast_(token, emailHint);
    if (!email) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    id = String(id || '').trim();
    if (!/^\d{1,12}$/.test(id)) return { ok: false, notFound: true, msg: 'Mã yêu cầu không hợp lệ.' };

    const isClear = kind === 'clear';
    const isMyBae = kind === 'mybae';
    const isManual = kind === 'manual';
    const isResult = isClear || isMyBae;
    const sh = isClear ? getClearSheet_() : (isMyBae ? getMyBaeSheet_() : (isManual ? getManualSheet_() : getBypassSheet_()));
    const H = (isClear ? CLEARCLS : (isMyBae ? MYBAE : (isManual ? MANUAL : BYPASS))).HEADER_ROW;
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(H, 1, 1, lastCol).getValues()[0].map(normHeader_);
    const cId = headers.indexOf(normHeader_('ID'));
    const cMail = headers.indexOf(normHeader_('Email'));
    const cSt = headers.indexOf(normHeader_('Thao Tác'));
    const cRes = headers.indexOf(normHeader_('Kết quả'));
    if (cId < 0 || cMail < 0 || cSt < 0) throw new Error('Sheet thiếu cột ID / Email / Thao Tác');
    if (isResult && cRes < 0) throw new Error('Sheet thiếu cột Kết quả');

    const lastRow = sh.getLastRow();
    if (lastRow <= H) return { ok: false, notFound: true, msg: 'Không tìm thấy yêu cầu #' + id + '.' };
    const hits = sh.getRange(H + 1, cId + 1, lastRow - H, 1).createTextFinder(id).matchEntireCell(true).findAll();
    for (let i = 0; i < hits.length && i < 5; i++) {
      const rv = sh.getRange(hits[i].getRow(), 1, 1, lastCol).getDisplayValues()[0];
      if (normEmail_(rv[cMail]) === email) {
        const thaoTac = String(rv[cSt] || '').normalize('NFC').trim();
        if (isResult) {
          const result = String(rv[cRes] || '').normalize('NFC').trim();
          const note = isPendingStatus_(thaoTac) ? '' : thaoTac;
          return { ok: true, status: result, note: note, pending: isPendingStatus_(result) };
        }
        return { ok: true, status: thaoTac, note: '', pending: isPendingStatus_(thaoTac) };
      }
    }
    return { ok: false, notFound: true, msg: 'Không tìm thấy yêu cầu #' + id + '.' };
  } catch (e) {
    return serverError_(e);
  }
}

/* ===================== SpamPool Ưu Tiên ===================== */

function getSpamSheet_() {
  const ss = SpreadsheetApp.openById(SPAMPOOL.SHEET_ID);
  const sh = ss.getSheets().filter(function (s) { return s.getSheetId() === SPAMPOOL.GID; })[0];
  if (!sh) throw new Error('Không tìm thấy tab Spampool (gid=' + SPAMPOOL.GID + ')');
  return sh;
}

function apiSpamSubmit(token, shd, cause, other, emailHint) { return submitSpam_(token, shd, cause, other, emailHint); }
function apiSpamStatus(token, id, emailHint) { return spamStatus_(token, id, emailHint); }

function submitSpam_(token, shd, cause, other, emailHint) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const s = requireSession_(token, emailHint);
    if (!s) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    const email = s.email;
    const emp = s.emp;
    if (!emp.profile.code) return { ok: false, msg: 'Tài khoản chưa có Mã NV trong danh sách.' };
    if (!emp.profile.inside) return { ok: false, msg: 'Tài khoản chưa có Inside Account trong danh sách.' };

    shd = String(shd || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._\-\/]{3,29}$/.test(shd)) return { ok: false, msg: 'SHD không hợp lệ.' };

    cause = String(cause || '').trim();
    let cause1;
    if (cause === SPAMPOOL.CAUSE_OTHER) {
      other = String(other || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (other.length < SPAMPOOL.OTHER_MIN) return { ok: false, msg: 'Vui lòng điền nội dung nguyên nhân khác.' };
      if (other.length > SPAMPOOL.OTHER_MAX) return { ok: false, msg: 'Nội dung tối đa ' + SPAMPOOL.OTHER_MAX + ' ký tự.' };
      cause1 = SPAMPOOL.CAUSE_OTHER + ': ' + other;
    } else if (SPAMPOOL.CAUSE_OPTIONS.indexOf(cause) >= 0) {
      cause1 = cause;
    } else {
      return { ok: false, msg: 'Nguyên nhân không hợp lệ.' };
    }

    lock.waitLock(20000);
    locked = true;

    const sh = getSpamSheet_();
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(SPAMPOOL.HEADER_ROW, 1, 1, lastCol).getValues()[0].map(normHeader_);
    const names = ['ID', 'Tác Vụ', 'Email', 'MSNV', 'Account Inside', 'SHD', 'Nguyên Nhân 1', 'Ngày Cập Nhật', 'Kết Quả', 'Thao Tác'];
    const c = {};
    names.forEach(function (n) {
      const i = headers.indexOf(normHeader_(n));
      if (i < 0) throw new Error('Sheet thiếu cột "' + n + '"');
      c[n] = i;
    });

    const H = SPAMPOOL.HEADER_ROW;
    const lastRow = sh.getLastRow();
    let maxId = 0;
    let lastDataRow = H;
    if (lastRow > H) {
      const n = lastRow - H;
      const first = H + 1;
      const ids = sh.getRange(first, c['ID'] + 1, n, 1).getValues();
      for (let i = 0; i < n; i++) {
        const v = parseInt(ids[i][0], 10);
        if (!isNaN(v) && v > maxId) maxId = v;
        if (ids[i][0] !== '') lastDataRow = first + i;
      }
      const hits = sh.getRange(first, c['SHD'] + 1, n, 1).createTextFinder(shd).matchEntireCell(true).findAll();
      for (let k = 0; k < hits.length && k < 20; k++) {
        const rv = sh.getRange(hits[k].getRow(), 1, 1, lastCol).getDisplayValues()[0];
        if (isPendingStatus_(rv[c['Kết Quả']])) {
          if (normEmail_(rv[c['Email']]) === email) {
            return { ok: true, resumed: true, id: String(rv[c['ID']]), shd: shd };
          }
          return { ok: false, msg: 'SHD ' + shd + ' đã được gửi và đang chờ xử lý.' };
        }
      }
    }

    const newId = maxId + 1;
    const newRow = lastDataRow + 1;
    if (newRow > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), newRow - sh.getMaxRows());

    const vals = {
      'ID': newId,
      'Tác Vụ': SPAMPOOL.TASK,
      'Email': email,
      'MSNV': emp.profile.code,
      'Account Inside': emp.profile.inside,
      'SHD': shd,
      'Nguyên Nhân 1': cause1,
      'Ngày Cập Nhật': new Date(),
      'Kết Quả': SPAMPOOL.RESULT_NEW,
      'Thao Tác': SPAMPOOL.STATUS_NEW
    };
    const TEXT_COLS = ['MSNV', 'SHD', 'Account Inside', 'Nguyên Nhân 1'];
    Object.keys(vals).forEach(function (n) {
      const cell = sh.getRange(newRow, c[n] + 1);
      if (TEXT_COLS.indexOf(n) >= 0) cell.setNumberFormat('@');
      if (n === 'Ngày Cập Nhật') cell.setNumberFormat(BYPASS.DATE_FMT);
      cell.setValue(vals[n]);
    });
    SpreadsheetApp.flush();

    return { ok: true, id: newId, shd: shd };
  } catch (e) {
    console.error(e);
    return { ok: false, msg: 'Lỗi hệ thống: ' + (e && e.message ? e.message : e) };
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

function spamStatus_(token, id, emailHint) {
  try {
    const email = sessionEmailFast_(token, emailHint);
    if (!email) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    id = String(id || '').trim();
    if (!/^\d{1,12}$/.test(id)) return { ok: false, notFound: true, msg: 'Mã yêu cầu không hợp lệ.' };

    const sh = getSpamSheet_();
    const H = SPAMPOOL.HEADER_ROW;
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(H, 1, 1, lastCol).getValues()[0].map(normHeader_);
    const cId = headers.indexOf(normHeader_('ID'));
    const cMail = headers.indexOf(normHeader_('Email'));
    const cSt = headers.indexOf(normHeader_('Thao Tác'));
    const cRes = headers.indexOf(normHeader_('Kết Quả'));
    if (cId < 0 || cMail < 0 || cSt < 0 || cRes < 0) throw new Error('Sheet thiếu cột ID / Email / Thao Tác / Kết Quả');

    const lastRow = sh.getLastRow();
    if (lastRow <= H) return { ok: false, notFound: true, msg: 'Không tìm thấy yêu cầu #' + id + '.' };
    const hits = sh.getRange(H + 1, cId + 1, lastRow - H, 1).createTextFinder(id).matchEntireCell(true).findAll();
    for (let i = 0; i < hits.length && i < 5; i++) {
      const rv = sh.getRange(hits[i].getRow(), 1, 1, lastCol).getDisplayValues()[0];
      if (normEmail_(rv[cMail]) === email) {
        const thaoTac = String(rv[cSt] || '').normalize('NFC').trim();
        const result = String(rv[cRes] || '').normalize('NFC').trim();
        return { ok: true, status: result, note: isPendingStatus_(thaoTac) ? '' : thaoTac, pending: isPendingStatus_(result) };
      }
    }
    return { ok: false, notFound: true, msg: 'Không tìm thấy yêu cầu #' + id + '.' };
  } catch (e) {
    return serverError_(e);
  }
}

/* ===================== Reset MAC ===================== */

function getResetMacSheet_() {
  const ss = SpreadsheetApp.openById(RESETMAC.SHEET_ID);
  const sh = ss.getSheets().filter(function (s) { return s.getSheetId() === RESETMAC.GID; })[0];
  if (!sh) throw new Error('Không tìm thấy tab Reset MAC (gid=' + RESETMAC.GID + ')');
  return sh;
}

function apiResetMacSubmit(token, shd, emailHint) { return submitResetMac_(token, shd, emailHint); }
function apiResetMacStatus(token, id, emailHint) { return resetMacStatus_(token, id, emailHint); }

function resetMacCols_(sh) {
  const headers = sh.getRange(RESETMAC.HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0].map(normHeader_);
  const c = {};
  ['Ho va Ten', 'Mail', 'SHD', 'Ket Qua', 'Ngay Cap Nhat'].forEach(function (n) {
    const i = headers.indexOf(normHeader_(n));
    if (i < 0) throw new Error('Sheet Reset MAC thiếu cột "' + n + '"');
    c[n] = i;
  });
  return c;
}

function submitResetMac_(token, shd, emailHint) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const s = requireSession_(token, emailHint);
    if (!s) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    const email = s.email;
    const name = s.emp.profile.name;
    if (!name) return { ok: false, msg: 'Tài khoản chưa có Họ tên trong danh sách.' };

    shd = String(shd || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._\-\/]{3,29}$/.test(shd)) return { ok: false, msg: 'SHD không hợp lệ.' };

    lock.waitLock(20000);
    locked = true;

    const sh = getResetMacSheet_();
    const c = resetMacCols_(sh);
    const H = RESETMAC.HEADER_ROW;
    const lastRow = sh.getLastRow();

    let lastDataRow = H;
    if (lastRow > H) {
      const n = lastRow - H;
      const first = H + 1;
      const mails = sh.getRange(first, c['Mail'] + 1, n, 1).getValues();
      for (let i = n - 1; i >= 0; i--) {
        if (String(mails[i][0]).trim() !== '') { lastDataRow = first + i; break; }
      }
      const hits = sh.getRange(first, c['SHD'] + 1, n, 1).createTextFinder(shd).matchEntireCell(true).findAll();
      const lastCol = sh.getLastColumn();
      for (let k = 0; k < hits.length && k < 20; k++) {
        const row = hits[k].getRow();
        const rv = sh.getRange(row, 1, 1, lastCol).getDisplayValues()[0];
        if (isPendingStatus_(rv[c['Ket Qua']])) {
          if (normEmail_(rv[c['Mail']]) === email) return { ok: true, resumed: true, id: String(row), shd: shd };
          return { ok: false, msg: 'SHD ' + shd + ' đã được gửi và đang chờ xử lý.' };
        }
      }
    }

    const newRow = lastDataRow + 1;
    if (newRow > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), newRow - sh.getMaxRows());

    const put = function (col, val, text) {
      const cell = sh.getRange(newRow, c[col] + 1);
      if (text) cell.setNumberFormat('@');
      cell.setValue(val);
    };
    put('Ho va Ten', name, true);
    put('Mail', email, true);
    put('SHD', shd, true);
    put('Ket Qua', RESETMAC.RESULT_NEW, false);
    const dc = sh.getRange(newRow, c['Ngay Cap Nhat'] + 1);
    dc.setNumberFormat(BYPASS.DATE_FMT);
    dc.setValue(new Date());
    SpreadsheetApp.flush();

    return { ok: true, id: String(newRow), shd: shd };
  } catch (e) {
    console.error(e);
    return { ok: false, msg: 'Lỗi hệ thống: ' + (e && e.message ? e.message : e) };
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

function resetMacStatus_(token, id, emailHint) {
  try {
    const email = sessionEmailFast_(token, emailHint);
    if (!email) return { ok: false, expired: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    id = String(id || '').trim();
    if (!/^\d{1,9}$/.test(id)) return { ok: false, notFound: true, msg: 'Mã yêu cầu không hợp lệ.' };
    const row = parseInt(id, 10);

    const sh = getResetMacSheet_();
    const c = resetMacCols_(sh);
    if (row <= RESETMAC.HEADER_ROW || row > sh.getLastRow()) return { ok: false, notFound: true, msg: 'Không tìm thấy yêu cầu.' };
    const rv = sh.getRange(row, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    if (normEmail_(rv[c['Mail']]) !== email) return { ok: false, notFound: true, msg: 'Không tìm thấy yêu cầu.' };

    const result = String(rv[c['Ket Qua']] || '').normalize('NFC').trim();
    return { ok: true, status: result, note: '', pending: isPendingStatus_(result) };
  } catch (e) {
    return serverError_(e);
  }
}

/* ===================== Băm mật khẩu / chống dò ===================== */

function hash_(salt, password) {
  const pepper = getPepper_();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pepper + salt + password, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function getPepper_() {
  const props = PropertiesService.getScriptProperties();
  let p = props.getProperty('PEPPER');
  if (!p) { p = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('PEPPER', p); }
  return p;
}

function registerFail_(email) {
  const cache = CacheService.getScriptCache();
  const key = 'F_' + email;
  const n = (parseInt(cache.get(key), 10) || 0) + 1;
  cache.put(key, String(n), CONFIG.LOCK_SEC);
  return Math.max(0, CONFIG.MAX_FAIL - n);
}

function clearFail_(email) {
  CacheService.getScriptCache().remove('F_' + email);
}

function lockMessage_(email) {
  const n = parseInt(CacheService.getScriptCache().get('F_' + email), 10) || 0;
  return n >= CONFIG.MAX_FAIL
    ? 'Nhập sai quá nhiều lần. Vui lòng thử lại sau ' + Math.round(CONFIG.LOCK_SEC / 60) + ' phút.'
    : null;
}

function normEmail_(s) { return String(s || '').trim().toLowerCase(); }
function isEmail_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

function serverError_(e) {
  console.error(e);
  return { ok: false, msg: 'Lỗi hệ thống, vui lòng thử lại.' };
}


/* ===================== HỆ THỐNG ĐĂNG KÝ LỊCH TRỰC / OFF THEO BLOCK ===================== */

function getLichTrucSheet_() {
  const ss = SpreadsheetApp.openById(LICHTRUC.SHEET_ID);
  const sh = ss.getSheets().filter(function (s) { return s.getSheetId() === LICHTRUC.GID; })[0];
  if (!sh) throw new Error('Không tìm thấy sheet Lịch trực với GID ' + LICHTRUC.GID);
  return sh;
}

function chuanHoaChuoiLT_(s) {
  return String(s || '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function soNgayTrongThangLT_(thang, nam) {
  return new Date(Number(nam), Number(thang), 0).getDate();
}

function layMapNhanSuLT_() {
  const sh = getDataSheet_();
  const data = sh.getDataRange().getValues();
  const map = {};
  for (let r = 1; r < data.length; r++) {
    const mailGoc = data[r][CONFIG.COL_EMAIL - 1];
    const mailChuanHoa = normEmail_(mailGoc);
    if (!mailChuanHoa) continue;
    map[mailChuanHoa] = {
      mail: mailGoc,
      msnv: data[r][5],   // F - MSNV
      hoTen: data[r][4],  // E - Họ và tên
      doiTac: String(data[r][2] || '').trim(), // C - Đối tác
      block: String(data[r][3] || '').trim(),  // D - Block
      status: String(data[r][12] || '').trim().toUpperCase() // M - Status
    };
  }
  return map;
}

function timNhanVienTheoMailLT_(email) {
  const map = layMapNhanSuLT_();
  const nv = map[normEmail_(email)];
  if (!nv) return { found: false };
  return {
    found: true,
    mail: nv.mail,
    msnv: nv.msnv,
    hoTen: nv.hoTen,
    doiTac: nv.doiTac,
    block: nv.block,
    status: nv.status
  };
}

function demSoNhanVienTrongBlockLT_(block) {
  const map = layMapNhanSuLT_();
  const blockChuanHoa = chuanHoaChuoiLT_(block);
  let count = 0;
  for (const key in map) {
    const nv = map[key];
    if (chuanHoaChuoiLT_(nv.block) === blockChuanHoa && nv.status === 'ACTIVE') count++;
  }
  return count;
}

function timHoacTaoDongLT_(sheet, nv, thang, nam) {
  const data = sheet.getDataRange().getValues();
  const mailChuanHoa = normEmail_(nv.mail);

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowMail = normEmail_(row[LICHTRUC.COL_MAIL - 1]);
    const rowThang = Number(row[LICHTRUC.COL_MONTH - 1]);
    const rowNam = Number(row[LICHTRUC.COL_YEAR - 1]);
    if (rowMail === mailChuanHoa && rowThang === Number(thang) && rowNam === Number(nam)) {
      const rowIndex = r + 1;
      sheet.getRange(rowIndex, LICHTRUC.COL_MSNV, 1, 4)
           .setValues([[nv.msnv, nv.hoTen, nv.doiTac, nv.block]]);
      return rowIndex;
    }
  }

  const newRowIndex = sheet.getLastRow() + 1;
  const newRow = new Array(LICHTRUC.COL_YEAR).fill('');
  newRow[LICHTRUC.COL_MAIL - 1]   = nv.mail;
  newRow[LICHTRUC.COL_MSNV - 1]   = nv.msnv;
  newRow[LICHTRUC.COL_HOTEN - 1]  = nv.hoTen;
  newRow[LICHTRUC.COL_DOITAC - 1] = nv.doiTac;
  newRow[LICHTRUC.COL_BLOCK - 1]  = nv.block;
  newRow[LICHTRUC.COL_MONTH - 1]  = thang;
  newRow[LICHTRUC.COL_YEAR - 1]   = nam;
  sheet.getRange(newRowIndex, 1, 1, newRow.length).setValues([newRow]);
  return newRowIndex;
}

function dienMacDinhCA1LT_(sheet, rowIndex, thang, nam) {
  const soNgay = soNgayTrongThangLT_(thang, nam);
  const rowRange = sheet.getRange(rowIndex, LICHTRUC.COL_DAY1, 1, soNgay);
  const values = rowRange.getValues()[0];
  let daThayDoi = false;
  for (let i = 0; i < soNgay; i++) {
    if (!String(values[i] || '').trim()) {
      values[i] = LICHTRUC.VAL_CA1;
      daThayDoi = true;
    }
  }
  if (daThayDoi) {
    rowRange.setValues([values]);
  }
}

function timNguoiDaOffNgayLT_(sheet, nv, thang, nam, day, mapNhanSu) {
  const map = mapNhanSu || layMapNhanSuLT_();
  const data = sheet.getDataRange().getValues();
  const mailChuanHoa = normEmail_(nv.mail);
  const blockChuanHoa = chuanHoaChuoiLT_(nv.block);

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowMail = normEmail_(row[LICHTRUC.COL_MAIL - 1]);
    if (!rowMail || rowMail === mailChuanHoa) continue;

    const rowThang = Number(row[LICHTRUC.COL_MONTH - 1]);
    const rowNam = Number(row[LICHTRUC.COL_YEAR - 1]);
    if (rowThang !== Number(thang) || rowNam !== Number(nam)) continue;

    const thongTinNv = map[rowMail];
    const rowBlock = thongTinNv ? chuanHoaChuoiLT_(thongTinNv.block) : chuanHoaChuoiLT_(row[LICHTRUC.COL_BLOCK - 1]);

    if (rowBlock === blockChuanHoa) {
      const giaTriNgay = String(row[LICHTRUC.COL_DAY1 - 1 + (Number(day) - 1)] || '').trim().toUpperCase();
      if (giaTriNgay === LICHTRUC.VAL_OFF) {
        return row[LICHTRUC.COL_HOTEN - 1] || row[LICHTRUC.COL_MAIL - 1];
      }
    }
  }
  return null;
}

function getThongTinNhanVien(email) {
  const nv = timNhanVienTheoMailLT_(email);
  if (!nv.found) {
    return { found: false, message: 'Không tìm thấy nhân viên với email này trong danh sách Nhân Sự.' };
  }
  return {
    found: true,
    mail: nv.mail,
    msnv: nv.msnv,
    hoTen: nv.hoTen,
    doiTac: nv.doiTac,
    block: nv.block,
    soLuongNhanSuTrongBlock: demSoNhanVienTrongBlockLT_(nv.block)
  };
}

function getLichTrucBlock(email, thang, nam) {
  const nv = timNhanVienTheoMailLT_(email);
  if (!nv.found) return { found: false, message: 'Không tìm thấy nhân viên.' };

  const map = layMapNhanSuLT_();
  const sheet = getLichTrucSheet_();
  const data = sheet.getDataRange().getValues();
  const blockChuanHoa = chuanHoaChuoiLT_(nv.block);

  const lichBlock = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowMail = normEmail_(row[LICHTRUC.COL_MAIL - 1]);
    if (!rowMail) continue;

    const rowThang = Number(row[LICHTRUC.COL_MONTH - 1]);
    const rowNam = Number(row[LICHTRUC.COL_YEAR - 1]);
    if (rowThang !== Number(thang) || rowNam !== Number(nam)) continue;

    const thongTinNv = map[rowMail];
    const rowBlock = thongTinNv ? chuanHoaChuoiLT_(thongTinNv.block) : chuanHoaChuoiLT_(row[LICHTRUC.COL_BLOCK - 1]);
    if (rowBlock !== blockChuanHoa) continue;

    const days = {};
    for (let d = 1; d <= LICHTRUC.MAX_DAYS; d++) {
      const v = row[LICHTRUC.COL_DAY1 - 1 + (d - 1)];
      days[d] = v ? String(v).trim().toUpperCase() : '';
    }
    lichBlock.push({
      mail: row[LICHTRUC.COL_MAIL - 1],
      hoTen: row[LICHTRUC.COL_HOTEN - 1],
      msnv: row[LICHTRUC.COL_MSNV - 1],
      isMe: rowMail === normEmail_(email),
      days: days
    });
  }

  return {
    found: true,
    block: nv.block,
    soLuongNhanSuTrongBlock: demSoNhanVienTrongBlockLT_(nv.block),
    lichBlock: lichBlock
  };
}

function kiemTraNgay(email, thang, nam, day) {
  const nv = timNhanVienTheoMailLT_(email);
  if (!nv.found) return { success: false, message: 'Không tìm thấy nhân viên.' };

  const soLuongBlock = demSoNhanVienTrongBlockLT_(nv.block);
  if (soLuongBlock <= 1) {
    return { success: true, coRangBuoc: false, allowO: true };
  }

  const sheet = getLichTrucSheet_();
  const nguoiDaOff = timNguoiDaOffNgayLT_(sheet, nv, thang, nam, day);

  return {
    success: true,
    coRangBuoc: true,
    allowO: !nguoiDaOff,
    nguoiDaOff: nguoiDaOff || null
  };
}

function layDanhSachGoiY() {
  const map = layMapNhanSuLT_();
  const ds = [];
  for (const key in map) {
    const nv = map[key];
    if (nv.status === 'ACTIVE') {
      ds.push({ mail: nv.mail, hoTen: nv.hoTen, block: nv.block });
    }
  }
  return ds;
}

function dangKyNgayOff(email, thang, nam, day, value) {
  value = String(value || '').trim().toUpperCase();
  day = Number(day);
  thang = Number(thang);
  nam = Number(nam);

  if (value !== LICHTRUC.VAL_CA1 && value !== LICHTRUC.VAL_OFF) {
    return { success: false, message: 'Giá trị không hợp lệ. Chỉ chấp nhận CA1 hoặc O.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const map = layMapNhanSuLT_();
    const nvRaw = map[normEmail_(email)];
    const nv = nvRaw
      ? { found: true, mail: nvRaw.mail, msnv: nvRaw.msnv, hoTen: nvRaw.hoTen,
          doiTac: nvRaw.doiTac, block: nvRaw.block }
      : { found: false };
    if (!nv.found) return { success: false, message: 'Không tìm thấy nhân viên.' };

    const soNgayThucCuaThang = soNgayTrongThangLT_(thang, nam);
    if (!day || day < 1 || day > soNgayThucCuaThang) {
      return { success: false, message: 'Ngày không hợp lệ. Tháng ' + thang + '/' + nam + ' chỉ có ' + soNgayThucCuaThang + ' ngày.' };
    }

    const sheet = getLichTrucSheet_();

    let soLuongBlock = 0;
    const blockChuanHoa = chuanHoaChuoiLT_(nv.block);
    for (const key in map) {
      if (chuanHoaChuoiLT_(map[key].block) === blockChuanHoa && map[key].status === 'ACTIVE') soLuongBlock++;
    }

    if (soLuongBlock > 1) {
      const nguoiDaOff = timNguoiDaOffNgayLT_(sheet, nv, thang, nam, day, map);
      if (nguoiDaOff && value === LICHTRUC.VAL_OFF) {
        return {
          success: false,
          forceCA1: true,
          message: 'Đã có nhân sự "' + nguoiDaOff + '" đăng ký OFF ngày ' + day +
                    '. Ngày này chỉ có thể chọn CA1. Vui lòng liên hệ CBQL để sắp xếp thêm.'
        };
      }
    }

    const rowIndex = timHoacTaoDongLT_(sheet, nv, thang, nam);
    dienMacDinhCA1LT_(sheet, rowIndex, thang, nam);
    sheet.getRange(rowIndex, LICHTRUC.COL_DAY1 + (day - 1)).setValue(value);
    SpreadsheetApp.flush();

    return {
      success: true,
      message: 'Đã lưu thành công: Ngày ' + day + '/' + thang + '/' + nam + ' = ' + value
    };
  } finally {
    lock.releaseLock();
  }
}
