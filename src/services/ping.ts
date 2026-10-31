/**
 * Dịch vụ Ping cho FPT Speed Check / NextSu AI
 * Hỗ trợ ICMP Ping qua Native Module (Android/iOS) và tự động fallback sang TCP (cổng 443) khi ICMP bị chặn.
 */

import { pingOnceNative, tcpPingOnceNative } from './netToolsNative';

export interface PingPacket {
  seq: number;
  timeMs: number | null; // null nếu timeout
  raw: string;
  ip?: string;
  ttl?: number;
  status: 'ok' | 'timeout' | 'error';
}

export interface PingResult {
  host: string;
  targetIp?: string;
  protocol: 'ICMP' | 'TCP';
  isTcpFallback: boolean;
  sent: number;
  received: number;
  lossPercent: number;
  minMs: number;
  avgMs: number;
  maxMs: number;
  jitterMs: number;
  packets: PingPacket[];
  timestamp: number;
  durationMs: number;
}

export interface PingOptions {
  host: string;
  count?: number; // 4 - 10
  timeoutSec?: number; // mặc định 2s
  onPacket?: (packet: PingPacket, currentSeq: number, total: number) => void;
  shouldAbort?: () => boolean;
}

/**
 * Regex phân tích output của lệnh ping:
 * 64 bytes from 142.250.204.46: icmp_seq=1 ttl=115 time=28.4 ms
 */
const TIME_REGEX = /time[=<]([0-9.]+)\s?ms/i;
const IP_REGEX = /(?:from\s+)?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|[a-fA-F0-9:]{4,})/i;
const TTL_REGEX = /ttl=(\d+)/i;

/**
 * Phân tích chuỗi đầu ra từ pingOnce
 */
export function parsePingOutput(raw: string, seq: number): PingPacket {
  const isTimeout =
    raw.toLowerCase().includes('timeout') ||
    raw.toLowerCase().includes('100% packet loss') ||
    raw.toLowerCase().includes('unreachable') ||
    raw.toLowerCase().includes('destination host unreachable') ||
    raw.toLowerCase().includes('request timeout');

  const timeMatch = raw.match(TIME_REGEX);
  const ttlMatch = raw.match(TTL_REGEX);
  const ipMatch = raw.match(IP_REGEX);

  if (timeMatch && !isTimeout) {
    const timeMs = parseFloat(timeMatch[1]);
    return {
      seq,
      timeMs: isNaN(timeMs) ? null : Number(timeMs.toFixed(2)),
      raw: raw.trim(),
      ip: ipMatch ? ipMatch[1] : undefined,
      ttl: ttlMatch ? parseInt(ttlMatch[1], 10) : undefined,
      status: 'ok',
    };
  }

  return {
    seq,
    timeMs: null,
    raw: raw.trim() || 'Request timeout',
    ip: ipMatch ? ipMatch[1] : undefined,
    status: isTimeout ? 'timeout' : 'error',
  };
}

/**
 * Tính toán Jitter chuẩn (RFC 3550 / Mean Consecutive Difference)
 */
export function calculateJitter(times: number[]): number {
  if (times.length < 2) return 0;
  let diffSum = 0;
  for (let i = 1; i < times.length; i++) {
    diffSum += Math.abs(times[i] - times[i - 1]);
  }
  return Number((diffSum / (times.length - 1)).toFixed(2));
}

/**
 * Thực hiện đo Ping lặp lại từ 4 đến 10 gói
 */
export async function executePing(options: PingOptions): Promise<PingResult> {
  const {
    host,
    count = 4,
    timeoutSec = 2,
    onPacket,
    shouldAbort,
  } = options;

  const validCount = Math.max(4, Math.min(10, count));
  const startTime = Date.now();
  const packets: PingPacket[] = [];
  let detectedIp: string | undefined;

  // 1. Thực hiện ping ICMP
  for (let seq = 1; seq <= validCount; seq++) {
    if (shouldAbort && shouldAbort()) {
      break;
    }

    try {
      const rawOutput = await pingOnceNative(host, 64, timeoutSec);
      const packet = parsePingOutput(rawOutput, seq);
      if (packet.ip && !detectedIp) {
        detectedIp = packet.ip;
      }
      packets.push(packet);
      if (onPacket) {
        onPacket(packet, seq, validCount);
      }
    } catch (err: any) {
      const errorPacket: PingPacket = {
        seq,
        timeMs: null,
        raw: err?.message || 'Lỗi gửi gói tin',
        status: 'error',
      };
      packets.push(errorPacket);
      if (onPacket) {
        onPacket(errorPacket, seq, validCount);
      }
    }

    // Khoảng nghỉ nhỏ giữa các gói tin (200ms) trừ gói cuối
    if (seq < validCount && (!shouldAbort || !shouldAbort())) {
      await new Promise((res) => setTimeout(res, 200));
    }
  }

  const okPackets = packets.filter((p) => p.status === 'ok' && p.timeMs !== null);
  let isTcpFallback = false;
  let protocol: 'ICMP' | 'TCP' = 'ICMP';

  // 2. Nếu ICMP thất bại toàn bộ (received === 0), tự động chuyển sang đo TCP Connect Time (cổng 443)
  if (okPackets.length === 0 && (!shouldAbort || !shouldAbort())) {
    isTcpFallback = true;
    protocol = 'TCP';
    packets.length = 0; // Xóa kết quả ICMP hỏng

    for (let seq = 1; seq <= validCount; seq++) {
      if (shouldAbort && shouldAbort()) break;

      const tcpRtt = await tcpPingOnceNative(host, 443, timeoutSec * 1000);
      let packet: PingPacket;

      if (tcpRtt >= 0) {
        packet = {
          seq,
          timeMs: Number(tcpRtt.toFixed(2)),
          raw: `TCP connect to ${host}:443: seq=${seq} time=${tcpRtt.toFixed(1)} ms (đo bằng TCP)`,
          status: 'ok',
        };
      } else {
        packet = {
          seq,
          timeMs: null,
          raw: `TCP connect to ${host}:443: seq=${seq} timeout (đo bằng TCP)`,
          status: 'timeout',
        };
      }

      packets.push(packet);
      if (onPacket) {
        onPacket(packet, seq, validCount);
      }

      if (seq < validCount && (!shouldAbort || !shouldAbort())) {
        await new Promise((res) => setTimeout(res, 200));
      }
    }
  }

  // 3. Thống kê kết quả
  const validTimes = packets
    .filter((p) => p.status === 'ok' && p.timeMs !== null)
    .map((p) => p.timeMs as number);

  const sent = packets.length;
  const received = validTimes.length;
  const lossPercent = sent > 0 ? Number((((sent - received) / sent) * 100).toFixed(1)) : 100;

  let minMs = 0;
  let maxMs = 0;
  let avgMs = 0;
  let jitterMs = 0;

  if (validTimes.length > 0) {
    minMs = Number(Math.min(...validTimes).toFixed(2));
    maxMs = Number(Math.max(...validTimes).toFixed(2));
    const sum = validTimes.reduce((acc, val) => acc + val, 0);
    avgMs = Number((sum / validTimes.length).toFixed(2));
    jitterMs = calculateJitter(validTimes);
  }

  return {
    host,
    targetIp: detectedIp,
    protocol,
    isTcpFallback,
    sent,
    received,
    lossPercent,
    minMs,
    avgMs,
    maxMs,
    jitterMs,
    packets,
    timestamp: Date.now(),
    durationMs: Date.now() - startTime,
  };
}
