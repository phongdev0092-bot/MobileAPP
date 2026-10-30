import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';

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
const STORAGE_LOCAL_PASS_PREFIX = '@nextsu_ai_colH_pass_';

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
 * Tải trực tiếp dữ liệu từ Sheet Nhân sự:
 * SHEET_ID: 17QLc9SlfpPPrR-d1R2BkBxA7DmCI5ZCuhmQffP5F6pY
 * GID: 32204814
 * - Cột K (index 10): Email nhân viên
 * - Cột H (index 7): Mật khẩu (Password)
 */
export async function fetchEmployeeSheetRows(): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.EMPLOYEE_SHEET_ID}/export?format=csv&gid=${CONFIG.EMPLOYEE_SHEET_GID}&t=${Date.now()}`;
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) {
    throw new Error(`Không thể kết nối dữ liệu nhân sự (HTTP ${response.status}).`);
  }
  const csvText = await response.text();
  return parseCsvRows(csvText);
}

/**
 * Gọi JSON API tới Google Apps Script (nếu đã cập nhật bản Code.gs mới có doPost)
 */
export async function callAppsScriptJsonApi<T = any>(
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
    // Nếu Apps Script trả về JSON hợp lệ
    if (text && text.trim().startsWith('{')) {
      return JSON.parse(text) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Bước 1: Kiểm tra Email người dùng nhập có nằm ở cột K trên Sheet không,
 * và kiểm tra cột H đã có mật khẩu hay chưa.
 */
export async function checkEmployeeEmail(rawEmail: string): Promise<CheckEmailResult> {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, msg: 'Định dạng Email không hợp lệ. Vui lòng kiểm tra lại.' };
  }

  try {
    const rows = await fetchEmployeeSheetRows();
    if (rows.length <= 1) {
      return { ok: false, msg: 'Không đọc được danh sách nhân sự từ hệ thống.' };
    }

    // Dòng 0 là tiêu đề, dữ liệu từ dòng 1 trở đi
    let foundRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const rowEmail = String(rows[i][CONFIG.COL_INDEX_EMAIL] || '')
        .trim()
        .toLowerCase();
      if (rowEmail === email) {
        foundRowIndex = i;
        break;
      }
    }

    if (foundRowIndex < 0) {
      return {
        ok: false,
        msg: 'Email này không tồn tại ở cột K trong danh sách nhân sự FPT Telecom.',
      };
    }

    const r = rows[foundRowIndex];
    const colHPassword = String(r[CONFIG.COL_INDEX_PASSWORD] || '').trim();
    const cachedColHPass = await AsyncStorage.getItem(STORAGE_LOCAL_PASS_PREFIX + email);

    const profile: EmployeeProfile = {
      row: foundRowIndex + 1,
      email,
      region: r[1] || '',
      partner: r[2] || '',
      block: r[3] || '',
      name: r[4] || '',
      code: r[5] || '',
      inside: r[6] || '',
      phone: r[11] || '',
      status: r[12] || '',
      title: r[14] || '',
      area: r[20] || '',
      avatar: r[21] || '',
      role: email === 'phuongnam.phongnh5@fpt.net' ? 'Admin' : 'User',
    };

    const hasPassword = Boolean(colHPassword || cachedColHPass);

    return {
      ok: true,
      hasPassword,
      profile,
    };
  } catch (err: any) {
    return {
      ok: false,
      msg: err?.message || 'Lỗi kết nối mạng khi kiểm tra dữ liệu nhân viên.',
    };
  }
}

/**
 * Bước 2a: Đăng nhập bằng mật khẩu ở cột H
 */
export async function loginWithPassword(
  rawEmail: string,
  password: string
): Promise<AuthResult> {
  const email = String(rawEmail || '').trim().toLowerCase();
  const pwd = String(password || '');

  if (!pwd) {
    return { ok: false, msg: 'Vui lòng nhập mật khẩu của bạn.' };
  }

  // 1. Thử xác thực qua Apps Script API trước (nếu đã deploy bản mới)
  const gasRes = await callAppsScriptJsonApi<AuthResult>({
    action: 'login',
    email,
    password: pwd,
  });

  if (gasRes && gasRes.ok && gasRes.profile) {
    const sessionData = {
      token: gasRes.token || `TOKEN_${Date.now()}`,
      profile: gasRes.profile,
      password: pwd,
    };
    await AsyncStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
    await AsyncStorage.setItem(STORAGE_LOCAL_PASS_PREFIX + email, pwd);
    return gasRes;
  }

  // 2. Xác thực trực tiếp trên cột K & cột H của Sheet
  const rows = await fetchEmployeeSheetRows();
  let foundRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = String(rows[i][CONFIG.COL_INDEX_EMAIL] || '')
      .trim()
      .toLowerCase();
    if (rowEmail === email) {
      foundRowIndex = i;
      break;
    }
  }

  if (foundRowIndex < 0) {
    return { ok: false, msg: 'Email không có trong danh sách nhân viên (cột K).' };
  }

  const r = rows[foundRowIndex];
  const colHPassword = String(r[CONFIG.COL_INDEX_PASSWORD] || '').trim();
  const cachedColHPass = await AsyncStorage.getItem(STORAGE_LOCAL_PASS_PREFIX + email);
  const effectiveStoredPass = colHPassword || cachedColHPass || '';

  if (!effectiveStoredPass) {
    return {
      ok: false,
      needCreate: true,
      msg: 'Tài khoản chưa có mật khẩu ở cột H, vui lòng khởi tạo mật khẩu.',
    };
  }

  if (effectiveStoredPass !== pwd) {
    return {
      ok: false,
      msg: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.',
    };
  }

  const profile: EmployeeProfile = {
    row: foundRowIndex + 1,
    email,
    region: r[1] || '',
    partner: r[2] || '',
    block: r[3] || '',
    name: r[4] || '',
    code: r[5] || '',
    inside: r[6] || '',
    phone: r[11] || '',
    status: r[12] || '',
    title: r[14] || '',
    area: r[20] || '',
    avatar: r[21] || '',
    role: email === 'phuongnam.phongnh5@fpt.net' ? 'Admin' : 'User',
  };

  const token = `NEXTSU_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(
    STORAGE_SESSION_KEY,
    JSON.stringify({ token, profile, password: pwd })
  );

  return { ok: true, token, profile };
}

/**
 * Bước 2b: Khởi tạo mật khẩu lần đầu và lưu vào cột H trên Sheet
 */
export async function createFirstPassword(
  rawEmail: string,
  password: string,
  confirm: string
): Promise<AuthResult> {
  const email = String(rawEmail || '').trim().toLowerCase();
  const pwd = String(password || '');
  const cfm = String(confirm || '');

  if (pwd.length < 6) {
    return { ok: false, msg: 'Mật khẩu khởi tạo phải có tối thiểu 6 ký tự.' };
  }
  if (pwd !== cfm) {
    return { ok: false, msg: 'Mật khẩu nhập lại không khớp.' };
  }

  const check = await checkEmployeeEmail(email);
  if (!check.ok || !check.profile) {
    return { ok: false, msg: check.msg || 'Không tìm thấy nhân viên.' };
  }

  // Gửi yêu cầu ghi mật khẩu vào cột H lên Google Apps Script
  const gasRes = await callAppsScriptJsonApi<AuthResult>({
    action: 'setPassword',
    email,
    password: pwd,
    confirm: cfm,
  });

  // Lưu đồng bộ trên thiết bị và phiên đăng nhập
  await AsyncStorage.setItem(STORAGE_LOCAL_PASS_PREFIX + email, pwd);

  const token =
    gasRes?.token || `NEXTSU_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const profile = gasRes?.profile || check.profile;

  await AsyncStorage.setItem(
    STORAGE_SESSION_KEY,
    JSON.stringify({ token, profile, password: pwd })
  );

  return {
    ok: true,
    token,
    profile,
  };
}

/**
 * Lấy danh sách nhân sự Active (Cột C = Đối tác, Cột D = Block, Cột G = Nhân viên, Cột M = Active)
 * cho tính năng Phân Công Tay
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
  password?: string;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearSavedSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_SESSION_KEY);
  } catch {}
}
