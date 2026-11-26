import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';
import {
  constantTimeEqual,
  hashPasswordWithEmail,
  isSha256PasswordHash,
  normalizeAuthEmail,
} from '../utils/passwordHash';

export interface EmployeeProfile {
  row: number;
  email: string;
  name: string;
  code: string;
  inside: string;
  region: string;
  partner: string;
  block: string;
  phone: string;
  title: string;
  area: string;
  avatar: string;
  status: string;
  role: 'Admin' | 'User';
}

export interface StaffOption {
  name: string;
  partner: string;
  block: string;
}

export interface ScheduleMemberRow {
  mail: string;
  hoTen: string;
  msnv: string;
  isMe: boolean;
  days: Record<number, string>;
}

export interface BlockScheduleData {
  found: boolean;
  message?: string;
  mail: string;
  msnv: string;
  hoTen: string;
  doiTac: string;
  block: string;
  soLuongNhanSuTrongBlock: number;
  lichBlock: ScheduleMemberRow[];
}

export interface SuggestEmployeeItem {
  mail: string;
  hoTen: string;
  block: string;
}

export interface CheckEmailResult {
  ok: boolean;
  msg?: string;
  hasPassword?: boolean;
  profile?: EmployeeProfile;
}

export interface AuthResult {
  ok: boolean;
  msg?: string;
  token?: string;
  profile?: EmployeeProfile;
  needCreate?: boolean;
}

const STORAGE_SESSION_KEY = '@nextsu_ai_session_v2';
const STORAGE_LOCAL_HASH_PREFIX = '@nextsu_ai_pwd_hash_v2_';
const LEGACY_PLAIN_PASS_PREFIX = ['@nextsu_ai_user', 'pass_'].join('_');
export const STORAGE_LAST_ACTIVE_KEY = '@nextsu_ai_last_active_at';

/**
 * Quét và xóa sạch toàn bộ mật khẩu plaintext từ phiên bản cũ trên thiết bị
 */
export async function purgeLegacyPlaintextStorage(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const legacyKeys = allKeys.filter((k) =>
      k.startsWith(LEGACY_PLAIN_PASS_PREFIX)
    );
    if (legacyKeys.length > 0) {
      await AsyncStorage.multiRemove(legacyKeys);
    }

    const rawSession = await AsyncStorage.getItem(STORAGE_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed && typeof parsed === 'object' && 'password' in parsed) {
        const email = normalizeAuthEmail(parsed?.profile?.email || '');
        const oldField = String(parsed.password || '');
        let migratedHash = parsed.passwordHash || '';
        if (!migratedHash && oldField && email) {
          migratedHash = isSha256PasswordHash(oldField)
            ? oldField
            : await hashPasswordWithEmail(email, oldField);
        }
        delete parsed.password;
        if (migratedHash) {
          parsed.passwordHash = migratedHash;
        }
        await AsyncStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(parsed));
      }
    }
  } catch {}
}

/**
 * Ghi lại mốc thời gian thao tác gần nhất của người dùng
 */
export async function recordLastActiveTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(Date.now()));
  } catch {}
}

/**
 * Lấy mốc thời gian thao tác gần nhất của người dùng
 */
export async function getLastActiveTime(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LAST_ACTIVE_KEY);
    if (!raw) return 0;
    const num = parseInt(raw, 10);
    return isNaN(num) ? 0 : num;
  } catch {
    return 0;
  }
}

/**
 * Phân tách dòng CSV chuẩn (hỗ trợ cả ô có dấu phẩy nằm trong ngoặc kép)
 */
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        if (ch === '\r') i++;
      } else if (ch !== '\r') {
        currentCell += ch;
      }
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }
  return rows;
}

/**
 * Tải trực tiếp dữ liệu nhân sự
 */
export async function fetchEmployeeSheetRows(): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.EMPLOYEE_SHEET_ID}/export?format=csv&gid=${CONFIG.EMPLOYEE_SHEET_GID}&t=${Date.now()}`;
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) {
    throw new Error(`Không thể kết nối hệ thống xác thực (${response.status}).`);
  }
  const csvText = await response.text();
  return parseCsvRows(csvText);
}

/**
 * Gửi request JSON thô tới Google Apps Script
 */
async function postToAppsScriptRaw<T = any>(
  payload: Record<string, any>
): Promise<T | null> {
  try {
    const res = await fetch(CONFIG.WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (text && text.trim().startsWith('{')) {
      return JSON.parse(text) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Tự động đồng bộ & lấy session token hợp lệ từ Google Apps Script
 * nếu phiên hiện tại dùng token tạm (NEXTSU_...) hoặc đã hết hạn trên Server.
 */
async function refreshServerTokenIfNeeded(hintEmail?: string): Promise<string | null> {
  try {
    const rawSession = await AsyncStorage.getItem(STORAGE_SESSION_KEY);
    const parsedSession = rawSession ? JSON.parse(rawSession) : null;
    const email = normalizeAuthEmail(
      hintEmail || parsedSession?.profile?.email || ''
    );
    if (!email) return null;

    const cachedHash =
      parsedSession?.passwordHash ||
      (await AsyncStorage.getItem(STORAGE_LOCAL_HASH_PREFIX + email)) ||
      '';
    if (!cachedHash || !isSha256PasswordHash(cachedHash)) return null;

    let authRes = await postToAppsScriptRaw<AuthResult>({
      action: 'login',
      email,
      password: cachedHash,
    });

    if (authRes && authRes.needCreate) {
      authRes = await postToAppsScriptRaw<AuthResult>({
        action: 'setPassword',
        email,
        password: cachedHash,
        confirm: cachedHash,
      });
    }

    if (authRes && authRes.ok && authRes.token) {
      const updatedSession = {
        token: authRes.token,
        profile: authRes.profile || parsedSession?.profile,
        passwordHash: cachedHash,
      };
      await AsyncStorage.setItem(
        STORAGE_SESSION_KEY,
        JSON.stringify(updatedSession)
      );
      return authRes.token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Gọi JSON API tới Google Apps Script (tự động làm mới token nếu cần)
 */
export async function callAppsScriptJsonApi<T = any>(
  payload: Record<string, any>
): Promise<T | null> {
  const reqPayload = { ...payload };
  const isAuthAction =
    reqPayload.action === 'login' ||
    reqPayload.action === 'setPassword' ||
    reqPayload.action === 'changePassword' ||
    reqPayload.action === 'checkEmail';

  // Nếu request có đính kèm token tạm (NEXTSU_...), đổi sang token thật của Apps Script trước khi gửi
  if (
    !isAuthAction &&
    typeof reqPayload.token === 'string' &&
    reqPayload.token.startsWith('NEXTSU_')
  ) {
    const freshToken = await refreshServerTokenIfNeeded(reqPayload.email);
    if (freshToken) {
      reqPayload.token = freshToken;
    }
  }

  const firstRes = await postToAppsScriptRaw<any>(reqPayload);

  // Nếu token trên Apps Script hết hạn (expired: true), tự động đăng nhập lại ngầm và gửi lại
  if (
    !isAuthAction &&
    firstRes &&
    firstRes.ok === false &&
    firstRes.expired === true
  ) {
    const freshToken = await refreshServerTokenIfNeeded(reqPayload.email);
    if (freshToken) {
      reqPayload.token = freshToken;
      return await postToAppsScriptRaw<T>(reqPayload);
    }
  }

  return firstRes as T | null;
}

/**
 * Xác định Role từ cột AD (index 29).
 * Mặc định tài khoản phuongnam.phongnh5@fpt.net là Admin, tất cả các tài khoản khác là User (trừ khi cột AD ghi Admin).
 */
function resolveEmployeeRole(email: string, colADValue?: string): 'Admin' | 'User' {
  if (email.trim().toLowerCase() === CONFIG.DEFAULT_ADMIN_EMAIL) {
    return 'Admin';
  }
  if (String(colADValue || '').trim().toLowerCase() === 'admin') {
    return 'Admin';
  }
  return 'User';
}

/**
 * Tạo đối tượng EmployeeProfile từ dòng dữ liệu trên Sheet:
 * - Cột E (index 4): Họ và tên nhân viên
 * - Cột K (index 10): Email
 * - Cột V (index 21): Hình ảnh nhân viên
 * - Cột AD (index 29): Roles
 */
function buildProfileFromRow(row: string[], rowNumber: number, email: string): EmployeeProfile {
  return {
    row: rowNumber,
    email,
    region: row[1] || '',
    partner: row[2] || '',
    block: row[3] || '',
    name: row[CONFIG.COL_INDEX_NAME] || '',
    code: row[5] || '',
    inside: row[6] || '',
    phone: row[11] || '',
    status: row[12] || '',
    title: row[14] || '',
    area: row[20] || '',
    avatar: row[CONFIG.COL_INDEX_AVATAR] || '',
    role: resolveEmployeeRole(email, row[CONFIG.COL_INDEX_ROLE]),
  };
}
export async function checkEmployeeEmail(rawEmail: string): Promise<CheckEmailResult> {
  const email = normalizeAuthEmail(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, msg: 'Địa chỉ Email không đúng định dạng.' };
  }

  try {
    const rows = await fetchEmployeeSheetRows();
    if (rows.length <= 1) {
      return { ok: false, msg: 'Không thể kết nối máy chủ dữ liệu nhân sự.' };
    }

    let foundRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const rowEmail = normalizeAuthEmail(rows[i][CONFIG.COL_INDEX_EMAIL]);
      if (rowEmail === email) {
        foundRowIndex = i;
        break;
      }
    }

    if (foundRowIndex < 0) {
      return {
        ok: false,
        msg: 'Tài khoản Email này chưa được đăng ký trong hệ thống.',
      };
    }

    const r = rows[foundRowIndex];
    const sheetPassword = String(r[CONFIG.COL_INDEX_PASSWORD] || '').trim();
    const cachedHash = await AsyncStorage.getItem(
      STORAGE_LOCAL_HASH_PREFIX + email
    );

    const profile = buildProfileFromRow(r, foundRowIndex + 1, email);
    const hasPassword = Boolean(sheetPassword || cachedHash);

    return {
      ok: true,
      hasPassword,
      profile,
    };
  } catch (err: any) {
    return {
      ok: false,
      msg: err?.message || 'Không thể kiểm tra tài khoản lúc này. Vui lòng thử lại.',
    };
  }
}

/**
 * Bước 2a: Đăng nhập bằng mật khẩu (băm một chiều SHA-256 kèm email trước khi gửi lên Sheet;
 * nếu cột H trên Sheet đang lưu mật khẩu cũ chưa băm thì tự nâng cấp cột H lên SHA-256 ngay khi khớp).
 */
export async function loginWithPassword(
  rawEmail: string,
  password: string
): Promise<AuthResult> {
  const email = normalizeAuthEmail(rawEmail);
  const pwd = String(password || '');

  if (!pwd) {
    return { ok: false, msg: 'Vui lòng nhập mật khẩu của bạn.' };
  }

  const pwdHash = await hashPasswordWithEmail(email, pwd);

  // 1. Ưu tiên xác thực qua Apps Script bằng mã băm SHA-256
  const gasRes = await callAppsScriptJsonApi<AuthResult>({
    action: 'login',
    email,
    password: pwdHash,
  });

  if (gasRes && gasRes.ok && gasRes.profile) {
    let enrichedProfile = gasRes.profile;
    if (!enrichedProfile.title) {
      const full = await fetchFullEmployeeProfile(email);
      if (full?.title) {
        enrichedProfile = { ...enrichedProfile, title: full.title };
      }
    }
    const sessionData = {
      token: gasRes.token || `TOKEN_${Date.now()}`,
      profile: enrichedProfile,
      passwordHash: pwdHash,
    };
    await AsyncStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
    await AsyncStorage.setItem(STORAGE_LOCAL_HASH_PREFIX + email, pwdHash);
    return {
      ok: true,
      token: sessionData.token,
      profile: enrichedProfile,
    };
  }

  // 2. Đối chiếu dữ liệu trên Sheet (xử lý fallback CSV & tự nâng cấp tài khoản cũ chưa băm)
  const rows = await fetchEmployeeSheetRows();
  let foundRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = normalizeAuthEmail(rows[i][CONFIG.COL_INDEX_EMAIL]);
    if (rowEmail === email) {
      foundRowIndex = i;
      break;
    }
  }

  if (foundRowIndex < 0) {
    return { ok: false, msg: 'Tài khoản Email không tồn tại trong hệ thống.' };
  }

  const r = rows[foundRowIndex];
  const sheetPassword = String(r[CONFIG.COL_INDEX_PASSWORD] || '').trim();
  const cachedHash = await AsyncStorage.getItem(
    STORAGE_LOCAL_HASH_PREFIX + email
  );

  if (!sheetPassword && !cachedHash) {
    return {
      ok: false,
      needCreate: true,
      msg: 'Tài khoản chưa tạo mật khẩu. Vui lòng thiết lập mật khẩu mới.',
    };
  }

  const matchedHash =
    (Boolean(cachedHash) && constantTimeEqual(cachedHash!, pwdHash)) ||
    (isSha256PasswordHash(sheetPassword) &&
      constantTimeEqual(sheetPassword, pwdHash));
  const matchedLegacyPlain =
    !isSha256PasswordHash(sheetPassword) &&
    Boolean(sheetPassword) &&
    sheetPassword === pwd;

  if (!matchedHash && !matchedLegacyPlain) {
    return {
      ok: false,
      msg: 'Mật khẩu không chính xác. Vui lòng thử lại.',
    };
  }

  // Nếu cột H trên Sheet đang lưu mật khẩu cũ (chưa băm) -> tự động ghi đè mã băm SHA-256 lên cột H
  let upgradedToken: string | undefined;
  if (matchedLegacyPlain) {
    const upgradeRes = await postToAppsScriptRaw<AuthResult>({
      action: 'changePassword',
      email,
      oldPassword: pwd,
      newPassword: pwdHash,
      confirm: pwdHash,
    });
    if (upgradeRes && upgradeRes.ok && upgradeRes.token) {
      upgradedToken = upgradeRes.token;
    }
  }

  const profile = buildProfileFromRow(r, foundRowIndex + 1, email);
  const token =
    upgradedToken ||
    `NEXTSU_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  await AsyncStorage.setItem(STORAGE_LOCAL_HASH_PREFIX + email, pwdHash);
  await AsyncStorage.setItem(
    STORAGE_SESSION_KEY,
    JSON.stringify({ token, profile, passwordHash: pwdHash })
  );

  return { ok: true, token, profile };
}

/**
 * Bước 2b: Khởi tạo mật khẩu lần đầu (băm SHA-256 kèm email và lưu thẳng lên cột H của Sheet)
 */
export async function createFirstPassword(
  rawEmail: string,
  password: string,
  confirm: string
): Promise<AuthResult> {
  const email = normalizeAuthEmail(rawEmail);
  const pwd = String(password || '');
  const cfm = String(confirm || '');

  if (pwd.length < 6) {
    return { ok: false, msg: 'Mật khẩu phải có tối thiểu 6 ký tự.' };
  }
  if (pwd !== cfm) {
    return { ok: false, msg: 'Mật khẩu xác nhận không trùng khớp.' };
  }

  const check = await checkEmployeeEmail(email);
  if (!check.ok || !check.profile) {
    return { ok: false, msg: check.msg || 'Không tìm thấy tài khoản.' };
  }

  const pwdHash = await hashPasswordWithEmail(email, pwd);

  const gasRes = await callAppsScriptJsonApi<AuthResult>({
    action: 'setPassword',
    email,
    password: pwdHash,
    confirm: pwdHash,
  });

  await AsyncStorage.setItem(STORAGE_LOCAL_HASH_PREFIX + email, pwdHash);

  const token =
    gasRes?.token || `NEXTSU_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const profile = gasRes?.profile || check.profile;

  await AsyncStorage.setItem(
    STORAGE_SESSION_KEY,
    JSON.stringify({ token, profile, passwordHash: pwdHash })
  );

  return {
    ok: true,
    token,
    profile,
  };
}

/**
 * Bước 2c: Đổi mật khẩu (đối chiếu mã băm cũ hoặc mật khẩu legacy cũ, ghi mã băm SHA-256 mới lên cột H của Sheet)
 */
export async function changeEmployeePassword(
  rawEmail: string,
  oldPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<AuthResult> {
  const email = normalizeAuthEmail(rawEmail);
  const oldPwd = String(oldPassword || '');
  const newPwd = String(newPassword || '');
  const cfmPwd = String(confirmPassword || '');

  if (!oldPwd) {
    return { ok: false, msg: 'Vui lòng nhập mật khẩu hiện tại.' };
  }
  if (newPwd.length < 6) {
    return { ok: false, msg: 'Mật khẩu mới phải có ít nhất 6 ký tự.' };
  }
  if (newPwd === oldPwd) {
    return { ok: false, msg: 'Mật khẩu mới phải khác với mật khẩu hiện tại.' };
  }
  if (newPwd !== cfmPwd) {
    return { ok: false, msg: 'Mật khẩu xác nhận không trùng khớp.' };
  }

  const oldHash = await hashPasswordWithEmail(email, oldPwd);
  const newHash = await hashPasswordWithEmail(email, newPwd);

  // 1. Thử cập nhật lên Sheet bằng mã băm SHA-256 trước
  let gasRes = await callAppsScriptJsonApi<AuthResult>({
    action: 'changePassword',
    email,
    oldPassword: oldHash,
    newPassword: newHash,
    confirm: newHash,
  });

  // 2. Đối chiếu dòng nhân sự trên Sheet (hỗ trợ cả tài khoản cũ đang lưu mật khẩu chưa băm trên cột H)
  const rows = await fetchEmployeeSheetRows();
  let foundRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = normalizeAuthEmail(rows[i][CONFIG.COL_INDEX_EMAIL]);
    if (rowEmail === email) {
      foundRowIndex = i;
      break;
    }
  }

  if (foundRowIndex < 0) {
    return { ok: false, msg: 'Tài khoản không tồn tại trong hệ thống.' };
  }

  const r = rows[foundRowIndex];
  const sheetPassword = String(r[CONFIG.COL_INDEX_PASSWORD] || '').trim();
  const cachedHash = await AsyncStorage.getItem(
    STORAGE_LOCAL_HASH_PREFIX + email
  );

  const validHashedOld =
    (Boolean(cachedHash) && constantTimeEqual(cachedHash!, oldHash)) ||
    (isSha256PasswordHash(sheetPassword) &&
      constantTimeEqual(sheetPassword, oldHash));
  const validLegacyOld =
    !isSha256PasswordHash(sheetPassword) &&
    Boolean(sheetPassword) &&
    sheetPassword === oldPwd;

  if (!validHashedOld && !validLegacyOld && !(gasRes && gasRes.ok)) {
    return { ok: false, msg: 'Mật khẩu hiện tại không chính xác.' };
  }

  // Nếu trên cột H vẫn là mật khẩu cũ chưa băm -> gửi lệnh đổi từ oldPwd sang newHash lên Sheet
  if (validLegacyOld && (!gasRes || gasRes.ok === false)) {
    gasRes = await callAppsScriptJsonApi<AuthResult>({
      action: 'changePassword',
      email,
      oldPassword: oldPwd,
      newPassword: newHash,
      confirm: newHash,
    });
    if (gasRes && gasRes.ok === false) {
      return { ok: false, msg: gasRes.msg || 'Mật khẩu hiện tại không đúng.' };
    }
  }

  await AsyncStorage.setItem(STORAGE_LOCAL_HASH_PREFIX + email, newHash);

  const profile = buildProfileFromRow(r, foundRowIndex + 1, email);
  const token =
    gasRes?.token || `NEXTSU_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  await AsyncStorage.setItem(
    STORAGE_SESSION_KEY,
    JSON.stringify({ token, profile, passwordHash: newHash })
  );

  return {
    ok: true,
    msg: 'Đã cập nhật mật khẩu mã hóa SHA-256 thành công!',
    token,
    profile,
  };
}

/**
 * Lấy danh sách nhân sự đang hoạt động cho Phân Công Tay
 */
export async function fetchActiveStaffList(): Promise<StaffOption[]> {
  try {
    const rows = await fetchEmployeeSheetRows();
    const map = new Map<string, StaffOption>();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const status = String(r[12] || '').trim().toLowerCase();
      if (status !== 'active') continue;
      const partner = String(r[2] || '').trim();
      const block = String(r[3] || '').trim();
      const staff = String(r[6] || '').trim();
      if (!partner || !block || !staff) continue;
      map.set(`${staff}|${partner}|${block}`, { name: staff, partner, block });
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'vi')
    );
  } catch {
    return [];
  }
}

export async function getSavedSession(): Promise<{
  token: string;
  profile: EmployeeProfile;
  passwordHash?: string;
  lastActiveAt?: number;
} | null> {
  try {
    await purgeLegacyPlaintextStorage();
    const raw = await AsyncStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);

    // Kiểm tra thời gian không thao tác trong app (mặc định 2 tiếng = 7.200.000 ms)
    const lastActive = await getLastActiveTime();
    const effectiveLast = lastActive || session.lastActiveAt || 0;
    if (effectiveLast > 0 && Date.now() - effectiveLast >= CONFIG.INACTIVITY_TIMEOUT_MS) {
      // Đã quá 2 tiếng không thao tác -> Hết hạn phiên
      await clearSavedSession();
      return null;
    }

    // Nếu phiên lưu cũ chưa có cột Chức danh (cột O), tự động đồng bộ bổ sung từ Sheet để phân quyền Card chính xác
    if (session?.profile?.email && !session.profile.title) {
      const full = await fetchFullEmployeeProfile(session.profile.email);
      if (full?.title) {
        session.profile = { ...session.profile, title: full.title };
        await AsyncStorage.setItem(
          STORAGE_SESSION_KEY,
          JSON.stringify(session)
        );
      }
    }

    return session;
  } catch {
    return null;
  }
}

export async function clearSavedSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_SESSION_KEY);
    await AsyncStorage.removeItem(STORAGE_LAST_ACTIVE_KEY);
  } catch {}
}

/* ===================== HỒ SƠ NHÂN SỰ ĐẦY ĐỦ (TAB USER) ===================== */

export interface FullEmployeeProfile {
  code: string;      // F - Mã NV (col 6, index 5)
  name: string;      // E - Họ Tên NV (col 5, index 4)
  title?: string;    // O - Chức danh (col 15, index 14)
  status: string;    // M - Tình trạng tài khoản (col 13, index 12)
  email: string;     // K - Email (col 11, index 10)
  area: string;      // U - Vị trí phụ trách (col 21, index 20)
  partner: string;   // C - Đối tác (col 3, index 2)
  block: string;     // D - Block (col 4, index 3)
  inside: string;    // G - Inside Account (col 7, index 6)
  mobisale: string;  // AE - Mobisale (col 31, index 30)
  cccd: string;      // I - CCCD 12 số (col 9, index 8)
  address: string;   // J - Địa chỉ thường trú (col 10, index 9)
  phone: string;     // L - SĐT cá nhân (col 12, index 11)
  startDate: string; // AA - Ngày vô công ty (col 27, index 26)
  avatar: string;    // V - Hình ảnh (col 22, index 21)
}

/**
 * Đọc trực tiếp hồ sơ nhân sự đầy đủ từ Google Sheet (dùng làm nguồn dữ liệu chính hoặc fallback an toàn)
 */
export async function fetchFullEmployeeProfile(
  rawEmail: string
): Promise<FullEmployeeProfile | null> {
  const normEmail = String(rawEmail || '').trim().toLowerCase();
  if (!normEmail) return null;
  try {
    const rows = await fetchEmployeeSheetRows();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowEmail = String(row[CONFIG.COL_INDEX_EMAIL] || '')
        .trim()
        .toLowerCase();
      if (rowEmail === normEmail) {
        return {
          code: String(row[5] || '').trim(),       // F
          name: String(row[4] || '').trim(),       // E
          title: String(row[14] || '').trim(),     // O
          status: String(row[12] || '').trim(),    // M
          email: String(row[10] || '').trim(),     // K
          area: String(row[20] || '').trim(),      // U
          partner: String(row[2] || '').trim(),    // C
          block: String(row[3] || '').trim(),      // D
          inside: String(row[6] || '').trim(),     // G
          mobisale: String(row[30] || '').trim(),  // AE
          cccd: String(row[8] || '').trim(),       // I
          address: String(row[9] || '').trim(),    // J
          phone: String(row[11] || '').trim(),     // L
          startDate: String(row[26] || '').trim(), // AA
          avatar: String(row[21] || '').trim(),    // V
        };
      }
    }
    return null;
  } catch (e) {
    console.warn('fetchFullEmployeeProfile error:', e);
    return null;
  }
}

/* ===================== HỆ THỐNG ĐĂNG KÝ LỊCH TRỰC / OFF THEO BLOCK ===================== */

const STORAGE_SCHEDULE_LOCAL_KEY = '@nextsu_ai_schedule_overrides_v1';

function normalizeBlockStr(s: string): string {
  return String(s || '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function getDaysInMonth(month: number, year: number): number {
  return new Date(Number(year), Number(month), 0).getDate();
}

/**
 * Tải trực tiếp Sheet Lịch Trực (1qd8O1bqbtHmbPUO_HhZv07YS9c27bo1QMWh4yvmQr2U, gid=0)
 */
export async function fetchScheduleSheetRows(): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SCHEDULE_SHEET_ID}/export?format=csv&gid=${CONFIG.SCHEDULE_SHEET_GID}&t=${Date.now()}`;
  const response = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) {
    throw new Error(`Không thể tải bảng Lịch trực (${response.status}).`);
  }
  const csvText = await response.text();
  return parseCsvRows(csvText);
}

/**
 * Lấy danh sách gợi ý nhân sự Active (mail, hoTen, block) để tìm kiếm trong Lịch trực
 */
export async function fetchScheduleSuggestions(): Promise<SuggestEmployeeItem[]> {
  try {
    const rows = await fetchEmployeeSheetRows();
    const list: SuggestEmployeeItem[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const mail = String(row[CONFIG.COL_INDEX_EMAIL] || '').trim();
      const status = String(row[12] || '').trim().toUpperCase();
      if (!mail || status !== 'ACTIVE') continue;
      list.push({
        mail,
        hoTen: String(row[CONFIG.COL_INDEX_NAME] || '').trim(),
        block: String(row[3] || '').trim(),
      });
    }
    return list;
  } catch {
    return [];
  }
}

/**
 * Tra cứu thông tin nhân viên + Lịch trực của cả Block trong tháng/năm
 */
export async function fetchBlockSchedule(
  rawEmail: string,
  thang: number,
  nam: number
): Promise<BlockScheduleData> {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) {
    return {
      found: false,
      message: 'Vui lòng nhập email nhân viên.',
      mail: '',
      msnv: '',
      hoTen: '',
      doiTac: '',
      block: '',
      soLuongNhanSuTrongBlock: 0,
      lichBlock: [],
    };
  }

  try {
    // 1. Ưu tiên gọi Google Apps Script Real-time (0 giây độ trễ, không bị cache CSV của Google)
    try {
      const [gasBlock, gasEmp] = await Promise.all([
        postToAppsScriptRaw<{
          found?: boolean;
          message?: string;
          mail?: string;
          msnv?: string;
          hoTen?: string;
          doiTac?: string;
          block?: string;
          soLuongNhanSuTrongBlock?: number;
          lichBlock?: ScheduleMemberRow[];
        }>({
          action: 'getLichTrucBlock',
          email,
          thang: Number(thang),
          nam: Number(nam),
        }),
        postToAppsScriptRaw<{
          found?: boolean;
          mail?: string;
          msnv?: string;
          hoTen?: string;
          doiTac?: string;
          block?: string;
          soLuongNhanSuTrongBlock?: number;
        }>({
          action: 'getThongTinNhanVien',
          email,
        }),
      ]);

      if (gasBlock && gasBlock.found && Array.isArray(gasBlock.lichBlock)) {
        const normalizedRows: ScheduleMemberRow[] = gasBlock.lichBlock.map((m) => {
          const days: Record<number, string> = {};
          for (let d = 1; d <= 31; d++) {
            const rawV = m.days ? (m.days[d] ?? (m.days as any)[String(d)]) : '';
            days[d] = rawV ? String(rawV).trim().toUpperCase() : '';
          }
          return {
            mail: String(m.mail || '').trim(),
            hoTen: String(m.hoTen || '').trim(),
            msnv: String(m.msnv || '').trim(),
            isMe: Boolean(m.isMe) || String(m.mail || '').trim().toLowerCase() === email,
            days,
          };
        });

        return {
          found: true,
          mail: String(gasBlock.mail || gasEmp?.mail || email),
          msnv: String(gasBlock.msnv || gasEmp?.msnv || ''),
          hoTen: String(gasBlock.hoTen || gasEmp?.hoTen || ''),
          doiTac: String(gasBlock.doiTac || gasEmp?.doiTac || ''),
          block: String(gasBlock.block || gasEmp?.block || ''),
          soLuongNhanSuTrongBlock: Number(
            gasBlock.soLuongNhanSuTrongBlock ?? gasEmp?.soLuongNhanSuTrongBlock ?? 0
          ),
          lichBlock: normalizedRows,
        };
      }

      if (gasBlock && gasBlock.found === false && gasBlock.message) {
        return {
          found: false,
          message: gasBlock.message,
          mail: '',
          msnv: '',
          hoTen: '',
          doiTac: '',
          block: '',
          soLuongNhanSuTrongBlock: 0,
          lichBlock: [],
        };
      }
    } catch {
      // Nếu GAS gặp sự cố mạng, tự động chuyển sang đọc CSV dự phòng bên dưới
    }

    // 2. Dự phòng: Đọc trực tiếp từ CSV Export của Google Sheets
    const [empRows, schedRows] = await Promise.all([
      fetchEmployeeSheetRows(),
      fetchScheduleSheetRows(),
    ]);

    // Xây dựng map Nhân sự theo mail (nguồn chuẩn xác định Block, Họ tên, MSNV, Đối tác)
    const empMap: Record<
      string,
      {
        mail: string;
        msnv: string;
        hoTen: string;
        doiTac: string;
        block: string;
        status: string;
      }
    > = {};

    for (let r = 1; r < empRows.length; r++) {
      const row = empRows[r];
      const mailGoc = String(row[CONFIG.COL_INDEX_EMAIL] || '').trim();
      const mailKey = mailGoc.toLowerCase();
      if (!mailKey) continue;
      empMap[mailKey] = {
        mail: mailGoc,
        msnv: String(row[5] || '').trim(),
        hoTen: String(row[CONFIG.COL_INDEX_NAME] || '').trim(),
        doiTac: String(row[2] || '').trim(),
        block: String(row[3] || '').trim(),
        status: String(row[12] || '').trim().toUpperCase(),
      };
    }

    const nv = empMap[email];
    if (!nv) {
      return {
        found: false,
        message: 'Không tìm thấy nhân viên với email này trong danh sách Nhân Sự.',
        mail: '',
        msnv: '',
        hoTen: '',
        doiTac: '',
        block: '',
        soLuongNhanSuTrongBlock: 0,
        lichBlock: [],
      };
    }

    const targetBlockNorm = normalizeBlockStr(nv.block);
    let soLuongNhanSuTrongBlock = 0;
    for (const k in empMap) {
      if (
        normalizeBlockStr(empMap[k].block) === targetBlockNorm &&
        empMap[k].status === 'ACTIVE'
      ) {
        soLuongNhanSuTrongBlock++;
      }
    }

    // Đọc các thay đổi vừa lưu tạm trên thiết bị (để giao diện phản hồi tức thì)
    let localOverrides: Record<string, Record<number, string>> = {};
    try {
      const rawLocal = await AsyncStorage.getItem(STORAGE_SCHEDULE_LOCAL_KEY);
      if (rawLocal) localOverrides = JSON.parse(rawLocal);
    } catch {}

    const lichBlock: ScheduleMemberRow[] = [];
    for (let r = 1; r < schedRows.length; r++) {
      const row = schedRows[r];
      const rowMailGoc = String(row[0] || '').trim();
      const rowMail = rowMailGoc.toLowerCase();
      if (!rowMail) continue;

      const rowThang = Number(row[36]); // Cột AK (index 36)
      const rowNam = Number(row[37]);   // Cột AL (index 37)
      if (rowThang !== Number(thang) || rowNam !== Number(nam)) continue;

      const infoNv = empMap[rowMail];
      if (!infoNv || infoNv.status !== 'ACTIVE') continue;
      const rowBlock = normalizeBlockStr(infoNv.block);

      if (rowBlock !== targetBlockNorm) continue;

      const days: Record<number, string> = {};
      for (let d = 1; d <= 31; d++) {
        const v = row[5 + (d - 1)]; // Cột F (index 5) là Ngày 1
        days[d] = v ? String(v).trim().toUpperCase() : '';
      }

      const overrideKey = `${rowMail}_${Number(thang)}_${Number(nam)}`;
      if (localOverrides[overrideKey]) {
        Object.keys(localOverrides[overrideKey]).forEach((dayKey) => {
          days[Number(dayKey)] = localOverrides[overrideKey][Number(dayKey)];
        });
      }

      lichBlock.push({
        mail: infoNv ? infoNv.mail : rowMailGoc,
        hoTen: infoNv ? infoNv.hoTen : String(row[2] || '').trim(),
        msnv: infoNv ? infoNv.msnv : String(row[1] || '').trim(),
        isMe: rowMail === email,
        days,
      });
    }

    // Nếu nhân viên đang tra cứu vừa đăng ký ở local mà chưa có dòng trên CSV export, bổ sung vào bảng hiển thị
    const myOverrideKey = `${email}_${Number(thang)}_${Number(nam)}`;
    if (
      !lichBlock.some((item) => item.isMe) &&
      localOverrides[myOverrideKey]
    ) {
      lichBlock.push({
        mail: nv.mail,
        hoTen: nv.hoTen,
        msnv: nv.msnv,
        isMe: true,
        days: localOverrides[myOverrideKey],
      });
    }

    return {
      found: true,
      mail: nv.mail,
      msnv: nv.msnv,
      hoTen: nv.hoTen,
      doiTac: nv.doiTac,
      block: nv.block,
      soLuongNhanSuTrongBlock,
      lichBlock,
    };
  } catch (err: any) {
    return {
      found: false,
      message: err?.message || 'Lỗi khi tải dữ liệu Lịch trực.',
      mail: '',
      msnv: '',
      hoTen: '',
      doiTac: '',
      block: '',
      soLuongNhanSuTrongBlock: 0,
      lichBlock: [],
    };
  }
}

/**
 * Kiểm tra xem ngày `day` trong Block đã có nhân sự khác đăng ký OFF ('O') chưa
 */
export function checkDayConflictFromBlockData(
  blockData: BlockScheduleData,
  day: number
): { coRangBuoc: boolean; allowO: boolean; nguoiDaOff: string | null } {
  if (blockData.soLuongNhanSuTrongBlock <= 1) {
    return { coRangBuoc: false, allowO: true, nguoiDaOff: null };
  }

  for (const member of blockData.lichBlock) {
    if (member.isMe) continue;
    const val = String(member.days[day] || '').trim().toUpperCase();
    if (val === 'O') {
      return {
        coRangBuoc: true,
        allowO: false,
        nguoiDaOff: member.hoTen || member.mail,
      };
    }
  }

  return { coRangBuoc: true, allowO: true, nguoiDaOff: null };
}

/**
 * Lưu đăng ký ngày CA1 hoặc O cho nhân viên
 * - Tự động điền mặc định CA1 cho các ngày còn trống trong phạm vi số ngày thực của tháng
 * - Ghi đè ngày đang chọn bằng giá trị (CA1 hoặc O)
 */
export async function submitScheduleRegistration(
  rawEmail: string,
  thang: number,
  nam: number,
  day: number,
  value: 'CA1' | 'O',
  matKhauBypass?: string,
  currentBlockData?: BlockScheduleData
): Promise<{ success: boolean; message: string }> {
  const email = String(rawEmail || '').trim().toLowerCase();
  const soNgayThuc = getDaysInMonth(thang, nam);

  if (day < 1 || day > soNgayThuc) {
    return {
      success: false,
      message: `Ngày không hợp lệ. Tháng ${thang}/${nam} chỉ có ${soNgayThuc} ngày.`,
    };
  }

  // Kiểm tra xung đột ngày OFF trong cùng Block (nếu không nhập mật khẩu CBQL)
  if (currentBlockData && value === 'O') {
    const conflict = checkDayConflictFromBlockData(currentBlockData, day);
    if (conflict.coRangBuoc && !conflict.allowO && !matKhauBypass?.trim()) {
      return {
        success: false,
        message: `Đã có nhân sự "${conflict.nguoiDaOff}" đăng ký OFF ngày ${day}. Ngày này chỉ có thể chọn CA1 hoặc nhập mật khẩu CBQL để cho phép trùng OFF.`,
      };
    }
  }

  // 1. Gửi lên Google Apps Script API
  const gasRes = await callAppsScriptJsonApi<{
    success?: boolean;
    message?: string;
  }>({
    action: 'dangKyNgayOff',
    email,
    thang: Number(thang),
    nam: Number(nam),
    day: Number(day),
    value,
    matKhauBypass: matKhauBypass || '',
  });

  if (gasRes && gasRes.success === false && gasRes.message) {
    return { success: false, message: gasRes.message };
  }

  // 2. Lưu trạng thái tức thì để bảng Lịch Block cập nhật ngay lập tức
  try {
    const rawLocal = await AsyncStorage.getItem(STORAGE_SCHEDULE_LOCAL_KEY);
    const localOverrides: Record<string, Record<number, string>> = rawLocal
      ? JSON.parse(rawLocal)
      : {};
    const key = `${email}_${Number(thang)}_${Number(nam)}`;
    const existingDays =
      currentBlockData?.lichBlock.find((m) => m.isMe)?.days ||
      localOverrides[key] ||
      {};

    const updatedDays: Record<number, string> = { ...existingDays };
    for (let d = 1; d <= soNgayThuc; d++) {
      if (!String(updatedDays[d] || '').trim()) {
        updatedDays[d] = 'CA1';
      }
    }
    updatedDays[day] = value;
    localOverrides[key] = updatedDays;
    await AsyncStorage.setItem(
      STORAGE_SCHEDULE_LOCAL_KEY,
      JSON.stringify(localOverrides)
    );
  } catch {}

  return {
    success: true,
    message:
      gasRes?.message ||
      `Đã lưu thành công: Ngày ${day}/${thang}/${nam} = ${value}`,
  };
}

