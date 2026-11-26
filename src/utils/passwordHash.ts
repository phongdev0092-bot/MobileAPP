import * as Crypto from 'expo-crypto';

export const HASH_PREFIX = 'sha256:';

export function normalizeAuthEmail(rawEmail: string): string {
  return String(rawEmail || '').trim().toLowerCase();
}

/**
 * Băm mật khẩu một chiều SHA-256 kèm email nhân sự làm muối (salt).
 * Định dạng lưu trên cột H của Google Sheet: `sha256:<64 ký tự hex>`
 * (dùng dấu `:` thay vì `$` để tương thích 100% với hàm `splitStored_` trên Code.gs)
 */
export async function hashPasswordWithEmail(
  rawEmail: string,
  rawPassword: string
): Promise<string> {
  const email = normalizeAuthEmail(rawEmail);
  const saltedInput = `nextsu_v2:${email}:${String(rawPassword || '')}`;
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    saltedInput
  );
  return `${HASH_PREFIX}${digest.toLowerCase()}`;
}

export function isSha256PasswordHash(val: string | undefined | null): boolean {
  return /^sha256[:$][0-9a-f]{64}$/.test(String(val || '').trim());
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface PasswordStrengthInfo {
  minLen: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  matches: boolean;
  strengthScore: number;
  isReady: boolean;
}

export function evaluatePasswordStrength(
  password: string,
  confirmPassword: string
): PasswordStrengthInfo {
  const minLen = password.length >= 6;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const matches = password.length > 0 && password === confirmPassword;

  let strengthScore = 0;
  if (minLen) strengthScore++;
  if (password.length >= 8 && hasLetter && hasNumber) strengthScore++;
  if (password.length >= 10) strengthScore++;
  if (/[^A-Za-z0-9]/.test(password)) strengthScore++;

  if (password.length > 0 && strengthScore === 0) {
    strengthScore = 1;
  }

  return {
    minLen,
    hasLetter,
    hasNumber,
    matches,
    strengthScore,
    isReady: minLen && matches,
  };
}
