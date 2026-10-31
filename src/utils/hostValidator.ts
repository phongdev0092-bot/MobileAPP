/**
 * Bộ kiểm tra và chuẩn hóa tên miền / địa chỉ IP
 * Đảm bảo chặn mọi ký tự nguy hiểm phòng chống Command Injection
 */

export const QUICK_HOSTS = [
  { label: 'Google', host: 'google.com', icon: 'logo-google' },
  { label: 'Facebook', host: 'facebook.com', icon: 'logo-facebook' },
  { label: 'YouTube', host: 'youtube.com', icon: 'logo-youtube' },
];

/**
 * Làm sạch chuỗi host nhập vào (bỏ http://, https://, dấu /, port...)
 */
export function sanitizeHost(input: string): string {
  let clean = input.trim();
  // Bỏ http:// hoặc https://
  clean = clean.replace(/^https?:\/\//i, '');
  // Bỏ path phía sau nếu có (ví dụ: google.com/search -> google.com)
  const slashIdx = clean.indexOf('/');
  if (slashIdx >= 0) {
    clean = clean.slice(0, slashIdx);
  }
  // Bỏ port nếu có (ví dụ: google.com:443 -> google.com, nhưng không làm hỏng IPv6 dạng ::1)
  if (clean.includes(':') && clean.indexOf(':') === clean.lastIndexOf(':')) {
    clean = clean.split(':')[0];
  }
  return clean.trim();
}

/**
 * Kiểm tra xem chuỗi có phải là IPv4 hợp lệ không
 */
export function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const num = parseInt(p, 10);
    return num >= 0 && num <= 255 && String(num) === p;
  });
}

/**
 * Kiểm tra xem chuỗi có phải là IPv6 hợp lệ không
 */
export function isValidIpv6(ip: string): boolean {
  if (!ip.includes(':')) return false;
  // Chặn ký tự lạ
  if (!/^[a-fA-F0-9:]+$/.test(ip)) return false;
  const parts = ip.split(':');
  return parts.length >= 3 && parts.length <= 8;
}

/**
 * Kiểm tra xem chuỗi có phải là tên miền hợp lệ không
 */
export function isValidDomain(domain: string): boolean {
  if (domain.length < 3 || domain.length > 253) return false;
  // Chặn tuyệt đối mọi ký tự shell injection: ; & | $ ` " ' < > \ / space...
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) return false;
  // Không được bắt đầu hoặc kết thúc bằng dấu gạch ngang hoặc dấu chấm
  if (domain.startsWith('-') || domain.endsWith('-') || domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }
  // Phải có ít nhất 1 dấu chấm ngăn cách TLD (ví dụ google.com)
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      !label.startsWith('-') &&
      !label.endsWith('-')
  );
}

/**
 * Kiểm tra tính hợp lệ toàn diện của Host
 */
export function validateHostInput(input: string): { valid: boolean; host: string; error?: string } {
  const clean = sanitizeHost(input);
  if (!clean) {
    return { valid: false, host: '', error: 'Vui lòng nhập tên miền hoặc địa chỉ IP.' };
  }

  // Chặn tuyệt đối ký tự nguy hiểm
  if (/[\s;&|$`"\'<>\\(){}[\]!*?^]/.test(clean)) {
    return {
      valid: false,
      host: clean,
      error: 'Host chứa ký tự cấm không an toàn! Chỉ được nhập ký tự chữ, số, dấu chấm và gạch ngang.',
    };
  }

  if (isValidIpv4(clean) || isValidIpv6(clean) || isValidDomain(clean)) {
    return { valid: true, host: clean };
  }

  return {
    valid: false,
    host: clean,
    error: 'Địa chỉ host không đúng định dạng tên miền (VD: google.com) hoặc IP (VD: 8.8.8.8).',
  };
}
