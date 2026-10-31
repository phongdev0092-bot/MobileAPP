/**
 * Dịch vụ Quản lý Lịch sử và Xuất dữ liệu (CSV, JSON, TXT) cho NetTools
 * Tích hợp lấy thông tin mạng (Wi-Fi / 4G / 5G, IP) qua @react-native-community/netinfo
 * Lưu trữ lâu dài qua AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { PingResult } from './ping';
import { TracerouteResult } from './traceroute';
import { DnsLookupResult } from './nslookup';

const HISTORY_STORAGE_KEY = '@nextsu_nettools_history_v1';
const MAX_HISTORY_ITEMS = 50;

export interface NetworkSnapshot {
  type: string; // 'Wi-Fi' | '4G' | '5G' | 'Di động' | 'Khác'
  rawType: string;
  ipAddress: string;
  gateway: string;
  carrier?: string;
  ssid?: string;
  isConnected: boolean;
}

export type NetToolType = 'PING' | 'TRACEROUTE' | 'NSLOOKUP';

export interface NetToolHistoryItem {
  id: string;
  type: NetToolType;
  timestamp: number;
  host: string;
  network: NetworkSnapshot;
  pingData?: PingResult;
  tracerouteData?: TracerouteResult;
  nslookupData?: DnsLookupResult;
}

/**
 * Lấy ảnh chụp thông tin mạng hiện tại (Wi-Fi / 4G / 5G, IP, Gateway)
 */
export async function getCurrentNetworkSnapshot(): Promise<NetworkSnapshot> {
  try {
    const state: NetInfoState = await NetInfo.fetch();
    let displayType = 'Không xác định';
    let ip = '192.168.1.7';
    let gateway = '192.168.1.1';
    let carrier: string | undefined;
    let ssid: string | undefined = 'FPT_Telecom_Wi-Fi';

    if (state.type === 'wifi') {
      displayType = 'Wi-Fi';
      const details = state.details as any;
      if (details?.ipAddress) ip = details.ipAddress;
      if (details?.ssid) ssid = details.ssid;
      if (details?.gateway) gateway = details.gateway;
    } else if (state.type === 'cellular') {
      const details = state.details as any;
      const gen = details?.cellularGeneration;
      displayType = gen ? gen.toUpperCase() : 'Di động (4G/5G)';
      if (details?.carrier) carrier = details.carrier;
      gateway = '10.0.0.1';
    } else if (state.type === 'ethernet') {
      displayType = 'Ethernet';
      const details = state.details as any;
      if (details?.ipAddress) ip = details.ipAddress;
    }

    // Tự động suy ra gateway từ địa chỉ IP mạng nội bộ nếu chưa có
    if (gateway === '192.168.1.1' && ip && ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4 && parts[0] !== '127') {
        gateway = `${parts[0]}.${parts[1]}.${parts[2]}.1`;
      }
    }

    return {
      type: displayType,
      rawType: state.type,
      ipAddress: ip,
      gateway,
      carrier,
      ssid,
      isConnected: state.isConnected ?? true,
    };
  } catch {
    return {
      type: 'Wi-Fi',
      rawType: 'wifi',
      ipAddress: '192.168.1.7',
      gateway: '192.168.1.1',
      ssid: 'FPT_Telecom_Wi-Fi',
      isConnected: true,
    };
  }
}

/**
 * Lưu 1 bản ghi vào lịch sử
 */
export async function saveNetToolResult(
  type: NetToolType,
  host: string,
  data: {
    ping?: PingResult;
    traceroute?: TracerouteResult;
    nslookup?: DnsLookupResult;
  }
): Promise<NetToolHistoryItem> {
  const network = await getCurrentNetworkSnapshot();
  const newItem: NetToolHistoryItem = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type,
    timestamp: Date.now(),
    host,
    network,
    pingData: data.ping,
    tracerouteData: data.traceroute,
    nslookupData: data.nslookup,
  };

  try {
    const currentList = await loadNetToolHistory();
    const updated = [newItem, ...currentList].slice(0, MAX_HISTORY_ITEMS);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Lỗi khi lưu lịch sử NetTools:', err);
  }

  return newItem;
}

/**
 * Tải danh sách lịch sử
 */
export async function loadNetToolHistory(): Promise<NetToolHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Xóa toàn bộ lịch sử NetTools
 */
export async function clearNetToolHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (err) {
    console.error('Lỗi khi xóa lịch sử:', err);
  }
}

/**
 * Định dạng thời gian
 */
function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Xuất dữ liệu sang định dạng CSV
 * Bao gồm đầy đủ các cột cho Ping, Traceroute, Nslookup và Thông tin mạng
 */
export function exportToCsv(items: NetToolHistoryItem[]): string {
  const lines: string[] = [];

  // 1. Phần PING
  const pingItems = items.filter((it) => it.type === 'PING' && it.pingData);
  if (pingItems.length > 0) {
    lines.push('--- [KET QUA PING] ---');
    lines.push('ThoiGian,Host,Protocol,GoiGui,GoiNhan,TiLeMatGoi(%),Min(ms),Avg(ms),Max(ms),Jitter(ms),LoaiMang,DiaChiIP');
    for (const item of pingItems) {
      const p = item.pingData!;
      lines.push(
        `"${formatTime(item.timestamp)}","${p.host}","${p.protocol}",${p.sent},${p.received},${p.lossPercent}%,${p.minMs},${p.avgMs},${p.maxMs},${p.jitterMs},"${item.network.type}","${item.network.ipAddress}"`
      );
    }
    lines.push('');
  }

  // 2. Phần TRACEROUTE
  const traceItems = items.filter((it) => it.type === 'TRACEROUTE' && it.tracerouteData);
  if (traceItems.length > 0) {
    lines.push('--- [KET QUA TRACEROUTE] ---');
    lines.push('ThoiGian,HostDich,IPDich,Hop,IPHop,RTT1(ms),RTT2(ms),RTT3(ms),LoaiMang,DiaChiIP');
    for (const item of traceItems) {
      const t = item.tracerouteData!;
      for (const h of t.hops) {
        const rtt1 = h.times[0] !== null ? `${h.times[0]}` : '*';
        const rtt2 = h.times[1] !== null ? `${h.times[1]}` : '*';
        const rtt3 = h.times[2] !== null ? `${h.times[2]}` : '*';
        lines.push(
          `"${formatTime(item.timestamp)}","${t.host}","${t.targetIp}",${h.hop},"${h.ip}","${rtt1}","${rtt2}","${rtt3}","${item.network.type}","${item.network.ipAddress}"`
        );
      }
    }
    lines.push('');
  }

  // 3. Phần NSLOOKUP
  const dnsItems = items.filter((it) => it.type === 'NSLOOKUP' && it.nslookupData);
  if (dnsItems.length > 0) {
    lines.push('--- [KET QUA NSLOOKUP] ---');
    lines.push('ThoiGian,Host,LoaiBanGhi,Resolver,TenBanGhi,TTL,DuLieu,QueryTime(ms),LoaiMang,DiaChiIP');
    for (const item of dnsItems) {
      const d = item.nslookupData!;
      if (d.records.length === 0) {
        lines.push(
          `"${formatTime(item.timestamp)}","${d.host}","${d.type}","${d.resolverName}","N/A",0,"(Khong co ban ghi)",${d.queryTimeMs},"${item.network.type}","${item.network.ipAddress}"`
        );
      } else {
        for (const rec of d.records) {
          lines.push(
            `"${formatTime(item.timestamp)}","${d.host}","${rec.typeName}","${d.resolverName}","${rec.name}",${rec.TTL},"${rec.data.replace(/"/g, '""')}",${d.queryTimeMs},"${item.network.type}","${item.network.ipAddress}"`
          );
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Xuất dữ liệu sang định dạng JSON có cấu trúc
 */
export function exportToJson(items: NetToolHistoryItem[]): string {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    totalItems: items.length,
    items,
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Xuất dữ liệu sang định dạng TXT (báo cáo chẩn đoán dễ đọc)
 */
export function exportToTxt(items: NetToolHistoryItem[]): string {
  const lines: string[] = [];
  lines.push('================================================================');
  lines.push('          FPT SPEED CHECK - BÁO CÁO CHẨN ĐOÁN MẠNG             ');
  lines.push(`               Thời gian xuất: ${formatTime(Date.now())}        `);
  lines.push('================================================================\n');

  if (items.length === 0) {
    lines.push('Chưa có dữ liệu chẩn đoán nào trong lịch sử.');
    return lines.join('\n');
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    lines.push(`[#${i + 1}] CÔNG CỤ: ${item.type} | Host: ${item.host}`);
    lines.push(`Thời gian: ${formatTime(item.timestamp)}`);
    lines.push(`Thông tin mạng: ${item.network.type} (IP nội bộ: ${item.network.ipAddress})${item.network.carrier ? ` - Nhà mạng: ${item.network.carrier}` : ''}`);

    if (item.type === 'PING' && item.pingData) {
      const p = item.pingData;
      lines.push(`Giao thức: ${p.protocol} ${p.isTcpFallback ? '(đo bằng TCP connect port 443)' : '(ICMP)'}`);
      lines.push(`Gói tin: Gửi = ${p.sent}, Nhận = ${p.received}, Mất gói = ${p.lossPercent}%`);
      lines.push(`Độ trễ: Min = ${p.minMs} ms, Avg = ${p.avgMs} ms, Max = ${p.maxMs} ms, Jitter = ${p.jitterMs} ms`);
      lines.push('Chi tiết các gói:');
      p.packets.forEach((pkt) => {
        lines.push(`  - Seq ${pkt.seq}: ${pkt.timeMs !== null ? `${pkt.timeMs} ms` : 'Timeout'} (${pkt.raw})`);
      });
    } else if (item.type === 'TRACEROUTE' && item.tracerouteData) {
      const t = item.tracerouteData;
      lines.push(`Đích: ${t.host} (${t.targetIp}) - Trạng thái: ${t.reachedDestination ? 'Đến đích' : (t.aborted ? 'Đã hủy' : 'Hoàn thành')}`);
      lines.push('Bảng đường đi (Traceroute Table):');
      lines.push('Hop | IP Address         | RTT 1   | RTT 2   | RTT 3   ');
      lines.push('----+--------------------+---------+---------+---------');
      t.hops.forEach((h) => {
        const hopStr = h.hop.toString().padStart(3, ' ');
        const ipStr = h.ip.padEnd(18, ' ');
        const t1 = (h.times[0] !== null ? `${h.times[0]} ms` : '*').padEnd(7, ' ');
        const t2 = (h.times[1] !== null ? `${h.times[1]} ms` : '*').padEnd(7, ' ');
        const t3 = (h.times[2] !== null ? `${h.times[2]} ms` : '*').padEnd(7, ' ');
        lines.push(`${hopStr} | ${ipStr} | ${t1} | ${t2} | ${t3}`);
      });
    } else if (item.type === 'NSLOOKUP' && item.nslookupData) {
      const d = item.nslookupData;
      lines.push(`Resolver: ${d.resolverName} | Loại: ${d.type} | Phản hồi: ${d.queryTimeMs} ms`);
      lines.push(`Ghi chú: ${d.note}`);
      lines.push('Danh sách bản ghi:');
      if (d.records.length === 0) {
        lines.push('  (Không tìm thấy bản ghi tương ứng)');
      } else {
        d.records.forEach((rec, rIdx) => {
          lines.push(`  [${rIdx + 1}] ${rec.name} -> ${rec.data} (TTL: ${rec.TTL}s)`);
        });
      }
    }

    lines.push('\n----------------------------------------------------------------\n');
  }

  return lines.join('\n');
}
