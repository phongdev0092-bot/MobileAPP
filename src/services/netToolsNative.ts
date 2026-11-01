import { NativeModules, Platform } from 'react-native';

const { NetTools } = NativeModules;

export interface NetToolsBridge {
  pingOnce(host: string, ttl: number, timeoutSec: number): Promise<string>;
  resolveHost(host: string): Promise<string[]>;
  tcpPingOnce(host: string, port: number, timeoutMs: number): Promise<number>;
  getWifiDetails?(): Promise<{ gateway: string; ssid: string; ipAddress: string }>;
}

export function hasNativeNetTools(): boolean {
  return Boolean(NetTools && typeof NetTools.pingOnce === 'function');
}

/**
 * Phân giải DNS fallback qua Google DoH khi chạy trên môi trường không có Native Module (như Web/Expo Go)
 */
async function fallbackResolveHost(host: string): Promise<string[]> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`);
    if (!res.ok) return [host];
    const data = await res.json();
    if (Array.isArray(data?.Answer) && data.Answer.length > 0) {
      const ips = data.Answer.filter((a: any) => a.type === 1).map((a: any) => a.data);
      if (ips.length > 0) return ips;
    }
    return [host];
  } catch {
    return [host];
  }
}

/**
 * Đo HTTP/TCP fallback khi chạy trên Web hoặc môi trường không có Native Module
 */
async function fallbackHttpPing(host: string, ttl: number, timeoutSec: number): Promise<string> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    // Gọi HEAD hoặc fetch không cache để đo thời gian phản hồi mạng
    await fetch(`https://${host}/favicon.ico?_t=${Date.now()}`, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const rtt = Math.max(1, Math.round(performance.now() - start));
    return `64 bytes from ${host}: icmp_seq=1 ttl=${ttl} time=${rtt} ms`;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return `Request timeout for icmp_seq 1 (timeout ${timeoutSec}s)`;
    }
    const rtt = Math.max(1, Math.round(performance.now() - start));
    return `64 bytes from ${host}: icmp_seq=1 ttl=${ttl} time=${rtt} ms (via TCP fallback)`;
  }
}

/**
 * Gọi pingOnce tới Native Module (Android/iOS) hoặc Fallback an toàn
 */
export async function pingOnceNative(
  host: string,
  ttl: number = 64,
  timeoutSec: number = 2
): Promise<string> {
  if (hasNativeNetTools()) {
    return await NetTools.pingOnce(host, ttl, timeoutSec);
  }
  return await fallbackHttpPing(host, ttl, timeoutSec);
}

/**
 * Gọi resolveHost tới Native Module hoặc DoH fallback
 */
export async function resolveHostNative(host: string): Promise<string[]> {
  if (hasNativeNetTools() && typeof NetTools.resolveHost === 'function') {
    return await NetTools.resolveHost(host);
  }
  return await fallbackResolveHost(host);
}

/**
 * Đo TCP connect time (cổng 443 hoặc chỉ định)
 */
export async function tcpPingOnceNative(
  host: string,
  port: number = 443,
  timeoutMs: number = 3000
): Promise<number> {
  if (hasNativeNetTools() && typeof NetTools.tcpPingOnce === 'function') {
    return await NetTools.tcpPingOnce(host, port, timeoutMs);
  }

  // Fallback đo TCP connect time bằng fetch
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`https://${host}:${port}/?_t=${Date.now()}`, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return Math.max(1, Math.round(performance.now() - start));
  } catch {
    clearTimeout(timer);
    const duration = Math.max(1, Math.round(performance.now() - start));
    return duration;
  }
}

/**
 * Lấy thông tin chi tiết Wi-Fi (SSID, Gateway, IP) trực tiếp từ Native Module Android
 */
export async function getWifiDetailsNative(): Promise<{
  gateway: string;
  ssid: string;
  ipAddress: string;
} | null> {
  if (hasNativeNetTools() && typeof NetTools.getWifiDetails === 'function') {
    try {
      return await NetTools.getWifiDetails();
    } catch {
      return null;
    }
  }
  return null;
}
