/**
 * Dịch vụ Nslookup (DoH - DNS over HTTPS) cho FPT Speed Check / NextSu AI
 * Hỗ trợ các Resolver: Google Public DNS & Cloudflare DNS.
 * Các loại bản ghi: A, AAAA, MX, NS, TXT, CNAME.
 */

export type DnsRecordType = 'A' | 'AAAA' | 'MX' | 'NS' | 'TXT' | 'CNAME';
export type DnsResolver = 'google' | 'cloudflare';

export interface DnsRecord {
  name: string;
  type: number | string;
  typeName: string;
  TTL: number;
  data: string;
}

export interface DnsLookupResult {
  host: string;
  type: DnsRecordType;
  resolver: DnsResolver;
  resolverName: string;
  queryTimeMs: number;
  status: number; // 0 = NOERROR, 3 = NXDOMAIN, v.v.
  statusText: string;
  records: DnsRecord[];
  authorities?: DnsRecord[];
  comment?: string;
  timestamp: number;
  note: string;
}

export interface DnsLookupOptions {
  host: string;
  type?: DnsRecordType;
  resolver?: DnsResolver;
  timeoutMs?: number;
}

// Bảng ánh xạ Type ID sang Type Name chuẩn IANA
const DNS_TYPE_MAP: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  33: 'SRV',
  257: 'CAA',
};

// Bảng ánh xạ RCODE chuẩn DNS
const DNS_STATUS_MAP: Record<number, string> = {
  0: 'NOERROR (Thành công)',
  1: 'FORMERR (Lỗi định dạng truy vấn)',
  2: 'SERVFAIL (Máy chủ DNS lỗi)',
  3: 'NXDOMAIN (Tên miền không tồn tại)',
  4: 'NOTIMP (Loại bản ghi chưa hỗ trợ)',
  5: 'REFUSED (Truy vấn bị từ chối)',
};

export function getRecordTypeName(typeId: number | string): string {
  if (typeof typeId === 'string') return typeId.toUpperCase();
  return DNS_TYPE_MAP[typeId] || `TYPE${typeId}`;
}

export function getStatusText(statusCode: number): string {
  return DNS_STATUS_MAP[statusCode] || `Code ${statusCode}`;
}

export const DNS_NOTE = 'Kết quả theo DNS Google/Cloudflare, không phải DNS nhà mạng.';

/**
 * Thực hiện tra cứu DNS qua DNS-over-HTTPS (DoH)
 */
export async function queryDns(options: DnsLookupOptions): Promise<DnsLookupResult> {
  const {
    host,
    type = 'A',
    resolver = 'google',
    timeoutMs = 6000,
  } = options;

  const startTime = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let url = '';
  const headers: Record<string, string> = {};

  if (resolver === 'google') {
    url = `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${type}`;
    headers['Accept'] = 'application/json';
  } else {
    url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`;
    headers['Accept'] = 'application/dns-json';
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const queryTimeMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      throw new Error(`Lỗi máy chủ DoH: HTTP ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const status = typeof json.Status === 'number' ? json.Status : 0;
    const statusText = getStatusText(status);

    const records: DnsRecord[] = [];
    if (Array.isArray(json.Answer)) {
      for (const item of json.Answer) {
        records.push({
          name: item.name || host,
          type: item.type,
          typeName: getRecordTypeName(item.type),
          TTL: item.TTL || 0,
          data: item.data || '',
        });
      }
    }

    const authorities: DnsRecord[] = [];
    if (Array.isArray(json.Authority)) {
      for (const item of json.Authority) {
        authorities.push({
          name: item.name || host,
          type: item.type,
          typeName: getRecordTypeName(item.type),
          TTL: item.TTL || 0,
          data: item.data || '',
        });
      }
    }

    return {
      host,
      type,
      resolver,
      resolverName: resolver === 'google' ? 'Google DNS (8.8.8.8)' : 'Cloudflare DNS (1.1.1.1)',
      queryTimeMs,
      status,
      statusText,
      records,
      authorities: authorities.length > 0 ? authorities : undefined,
      comment: json.Comment,
      timestamp: Date.now(),
      note: DNS_NOTE,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const queryTimeMs = Math.round(performance.now() - startTime);
    throw new Error(
      err?.name === 'AbortError'
        ? `Quá thời gian chờ phản hồi DNS (${timeoutMs}ms)`
        : err?.message || 'Không thể kết nối đến máy chủ DoH'
    );
  }
}
