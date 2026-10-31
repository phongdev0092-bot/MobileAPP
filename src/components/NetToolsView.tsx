/**
 * NetToolsView.tsx
 * Bộ 3 công cụ chẩn đoán mạng chuyên sâu cho FPT Telecom / NextSu AI:
 * - Hỗ trợ hiển thị Logo và Tên mạng Wi-Fi (SSID) nổi bật.
 * - Giao diện chuẩn Windows Command Prompt (CMD) với phím tắt 1 chạm.
 * - Xuất báo cáo chẩn đoán mạng dưới dạng Hình Ảnh Chụp CMD (PNG Image).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { QUICK_HOSTS, validateHostInput } from '../utils/hostValidator';
import { executePing, PingPacket, PingResult } from '../services/ping';
import { executeTraceroute, TracerouteHop, TracerouteResult } from '../services/traceroute';
import {
  queryDns,
  DnsLookupResult,
  DnsRecordType,
  DnsResolver,
  DNS_NOTE,
} from '../services/nslookup';
import {
  getCurrentNetworkSnapshot,
  saveNetToolResult,
  loadNetToolHistory,
  clearNetToolHistory,
  exportToCsv,
  exportToJson,
  exportToTxt,
  NetToolHistoryItem,
  NetworkSnapshot,
} from '../services/netToolsExport';
import {
  CMD_BANNER,
  CMD_PROMPT_PREFIX,
  formatPingHeader,
  formatPingPacket,
  formatPingStats,
  formatTracertHeader,
  formatTracertHop,
  formatNslookupOutput,
} from '../utils/cmdFormatter';
import {
  generateCmdCanvasImage,
  downloadCmdImage,
  shareCmdReport,
  CmdSnapshotData,
} from '../utils/cmdImageExport';
import { Alert } from '../utils/alert';

type ViewMode = 'CMD' | 'MODERN';
type ToolTab = 'PING' | 'TRACEROUTE' | 'NSLOOKUP' | 'HISTORY';

interface NetToolsViewProps {
  onBack?: () => void;
}

export const NetToolsView: React.FC<NetToolsViewProps> = ({ onBack }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('CMD');

  // Thông tin mạng và Wi-Fi
  const [networkInfo, setNetworkInfo] = useState<NetworkSnapshot | null>(null);
  const [wifiSsid, setWifiSsid] = useState<string>('FPT_Telecom_Wi-Fi');
  const [showEditWifiModal, setShowEditWifiModal] = useState<boolean>(false);
  const [editWifiInput, setEditWifiInput] = useState<string>('');

  // States cho CMD (Command Prompt)
  const [cmdInput, setCmdInput] = useState<string>('ping 8.8.8.8');
  const [cmdLogs, setCmdLogs] = useState<string[]>([
    ...CMD_BANNER,
    '[📶 MẠNG ĐANG BẮT: Wi-Fi: FPT_Telecom_Wi-Fi | IP: 192.168.1.7 | Gateway: 192.168.1.1]',
    'Nhập lệnh (ping, tracert, nslookup, cls) hoặc bấm nút chọn nhanh bên dưới:',
    '',
  ]);
  const [isCmdRunning, setIsCmdRunning] = useState<boolean>(false);
  const cmdAbortRef = useRef<boolean>(false);
  const cmdScrollRef = useRef<ScrollView>(null);

  // States cho Xuất Ảnh Chụp Màn Hình CMD
  const [cmdImageModalVisible, setCmdImageModalVisible] = useState<boolean>(false);
  const [cmdImageUrl, setCmdImageUrl] = useState<string | null>(null);
  const [copiedImageNotice, setCopiedImageNotice] = useState<string>('');

  // States cho Giao Diện Thẻ (Modern)
  const [activeTab, setActiveTab] = useState<ToolTab>('PING');
  const [targetHost, setTargetHost] = useState<string>('google.com');
  const [inputError, setInputError] = useState<string>('');

  // States cho PING
  const [pingCount, setPingCount] = useState<number>(4);
  const [pingRunning, setPingRunning] = useState<boolean>(false);
  const [pingPackets, setPingPackets] = useState<PingPacket[]>([]);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const pingAbortRef = useRef<boolean>(false);

  // States cho TRACEROUTE
  const [traceRunning, setTraceRunning] = useState<boolean>(false);
  const [traceHops, setTraceHops] = useState<TracerouteHop[]>([]);
  const [traceResult, setTraceResult] = useState<TracerouteResult | null>(null);
  const [traceStatusText, setTraceStatusText] = useState<string>('');
  const traceAbortRef = useRef<boolean>(false);

  // States cho NSLOOKUP
  const [dnsResolver, setDnsResolver] = useState<DnsResolver>('google');
  const [dnsType, setDnsType] = useState<DnsRecordType>('A');
  const [dnsRunning, setDnsRunning] = useState<boolean>(false);
  const [dnsResult, setDnsResult] = useState<DnsLookupResult | null>(null);

  // States cho LỊCH SỬ & XUẤT
  const [historyList, setHistoryList] = useState<NetToolHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'PING' | 'TRACEROUTE' | 'NSLOOKUP'>('ALL');
  const [exportModalVisible, setExportModalVisible] = useState<boolean>(false);
  const [exportContent, setExportContent] = useState<string>('');
  const [exportTitle, setExportTitle] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState<string>('');

  useEffect(() => {
    // Tải tên Wi-Fi đã lưu
    AsyncStorage.getItem('@nextsu_custom_wifi_name').then((saved) => {
      if (saved) setWifiSsid(saved);
    });
    refreshNetworkInfo();
    loadHistory();
  }, []);

  // Cuộn xuống cuối console khi có log mới
  useEffect(() => {
    if (viewMode === 'CMD') {
      setTimeout(() => {
        cmdScrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [cmdLogs, viewMode]);

  const refreshNetworkInfo = async () => {
    const info = await getCurrentNetworkSnapshot();
    setNetworkInfo(info);
    if (info.ssid && info.ssid !== '<unknown ssid>' && info.ssid !== 'Wi-Fi') {
      setWifiSsid(info.ssid);
    }
  };

  const loadHistory = async () => {
    const list = await loadNetToolHistory();
    setHistoryList(list);
  };

  const handleSaveCustomWifi = async () => {
    if (editWifiInput.trim()) {
      const cleanName = editWifiInput.trim();
      setWifiSsid(cleanName);
      await AsyncStorage.setItem('@nextsu_custom_wifi_name', cleanName);
    }
    setShowEditWifiModal(false);
  };

  // =========================================================================
  // XỬ LÝ LỆNH TRONG CHẾ ĐỘ CMD
  // =========================================================================
  const handleExecuteCmd = async (customCommand?: string) => {
    const rawCmd = (customCommand !== undefined ? customCommand : cmdInput).trim();
    if (!rawCmd || isCmdRunning) return;

    cmdAbortRef.current = false;
    setIsCmdRunning(true);

    const parts = rawCmd.split(/\s+/);
    const mainCmd = parts[0].toLowerCase();
    const arg1 = parts[1] || '';
    const arg2 = parts[2] || '';

    // 1. CLS: Xóa màn hình
    if (mainCmd === 'cls' || mainCmd === 'clear') {
      setCmdLogs([
        ...CMD_BANNER,
        `[📶 MẠNG ĐANG BẮT: Wi-Fi: ${wifiSsid} | IP: ${networkInfo?.ipAddress || '192.168.1.7'} | Gateway: ${networkInfo?.gateway || '192.168.1.1'}]`,
        '',
      ]);
      setIsCmdRunning(false);
      return;
    }

    // 2. HELP: Hướng dẫn
    if (mainCmd === 'help' || mainCmd === '?') {
      setCmdLogs((prev) => [
        ...prev,
        `${CMD_PROMPT_PREFIX}${rawCmd}`,
        '',
        'Các lệnh mạng chuẩn Windows CMD được hỗ trợ:',
        '  ping <host> [-n count]   - Gửi gói tin ICMP/TCP kiểm tra kết nối',
        '  tracert <host>           - Dò tuyến đường đi qua các hop mạng',
        '  nslookup <host> [dns]    - Tra cứu bản ghi DNS (Google/Cloudflare)',
        '  cls                      - Xóa màn hình dòng lệnh',
        '',
      ]);
      setIsCmdRunning(false);
      return;
    }

    let targetHostToRun = arg1;
    let actionType: 'ping' | 'tracert' | 'nslookup' = 'ping';
    let customCount = 4;

    if (mainCmd === 'ping') {
      actionType = 'ping';
      if (arg2.toLowerCase() === '-n' && parts[3]) {
        customCount = parseInt(parts[3], 10) || 4;
      }
    } else if (mainCmd === 'tracert' || mainCmd === 'traceroute') {
      actionType = 'tracert';
    } else if (mainCmd === 'nslookup') {
      actionType = 'nslookup';
    } else {
      actionType = 'ping';
      targetHostToRun = mainCmd;
    }

    if (!targetHostToRun) {
      setCmdLogs((prev) => [
        ...prev,
        `${CMD_PROMPT_PREFIX}${rawCmd}`,
        `Cú pháp không đúng. Hãy gõ: ${mainCmd} <tên miền hoặc IP>`,
        '',
      ]);
      setIsCmdRunning(false);
      return;
    }

    const check = validateHostInput(targetHostToRun);
    if (!check.valid) {
      setCmdLogs((prev) => [
        ...prev,
        `${CMD_PROMPT_PREFIX}${rawCmd}`,
        `Lỗi: ${check.error || 'Host không hợp lệ.'}`,
        '',
      ]);
      setIsCmdRunning(false);
      return;
    }

    const host = check.host;

    // --- A. PING ---
    if (actionType === 'ping') {
      const headerLines = formatPingHeader(host);
      setCmdLogs((prev) => [
        ...prev,
        `[📶 Mạng đo: Wi-Fi (${wifiSsid}) | IP: ${networkInfo?.ipAddress || '192.168.1.7'} | Gateway: ${networkInfo?.gateway || '192.168.1.1'}]`,
        ...headerLines,
      ]);

      try {
        let detectedTargetIp = host;
        const result = await executePing({
          host,
          count: customCount,
          timeoutSec: 2,
          shouldAbort: () => cmdAbortRef.current,
          onPacket: (pkt) => {
            if (pkt.ip && detectedTargetIp === host) {
              detectedTargetIp = pkt.ip;
            }
            const packetLine = formatPingPacket(pkt, detectedTargetIp);
            setCmdLogs((prev) => [...prev, packetLine]);
          },
        });

        if (cmdAbortRef.current) {
          setCmdLogs((prev) => [...prev, '^C', 'Control-C', '']);
        } else {
          const statLines = formatPingStats(result);
          setCmdLogs((prev) => [...prev, ...statLines]);
          await saveNetToolResult('PING', host, { ping: result });
          loadHistory();
        }
      } catch (err: any) {
        setCmdLogs((prev) => [...prev, `Lỗi: ${err?.message || 'Không thể thực hiện ping'}`, '']);
      } finally {
        setIsCmdRunning(false);
      }
      return;
    }

    // --- B. TRACERT ---
    if (actionType === 'tracert') {
      const headerLines = formatTracertHeader(host, host, {
        type: 'Wi-Fi',
        ssid: wifiSsid,
        ipAddress: networkInfo?.ipAddress || '192.168.1.7',
        gateway: networkInfo?.gateway || '192.168.1.1',
      });
      setCmdLogs((prev) => [...prev, ...headerLines]);

      try {
        const result = await executeTraceroute({
          host,
          maxHops: 30,
          timeoutSec: 2,
          probesPerHop: 3,
          shouldAbort: () => cmdAbortRef.current,
          onHop: (hop) => {
            const hopLine = formatTracertHop(hop);
            setCmdLogs((prev) => [...prev, hopLine]);
          },
        });

        if (cmdAbortRef.current) {
          setCmdLogs((prev) => [...prev, '^C', 'Control-C', '']);
        } else {
          setCmdLogs((prev) => [...prev, '', 'Trace complete.', '']);
          await saveNetToolResult('TRACEROUTE', host, { traceroute: result });
          loadHistory();
        }
      } catch (err: any) {
        setCmdLogs((prev) => [...prev, `Lỗi: ${err?.message || 'Lỗi traceroute'}`, '']);
      } finally {
        setIsCmdRunning(false);
      }
      return;
    }

    // --- C. NSLOOKUP ---
    if (actionType === 'nslookup') {
      const resolver: DnsResolver = arg2.includes('1.1.1.1') || arg2.includes('cloudflare') ? 'cloudflare' : 'google';
      try {
        const result = await queryDns({
          host,
          type: 'A',
          resolver,
        });
        const outputLines = formatNslookupOutput(result);
        setCmdLogs((prev) => [...prev, ...outputLines]);
        await saveNetToolResult('NSLOOKUP', host, { nslookup: result });
        loadHistory();
      } catch (err: any) {
        setCmdLogs((prev) => [
          ...prev,
          `${CMD_PROMPT_PREFIX}nslookup ${host}`,
          `*** Không thể kết nối máy chủ DNS: ${err?.message || 'Lỗi truy vấn'}`,
          '',
        ]);
      } finally {
        setIsCmdRunning(false);
      }
    }
  };

  const handleStopCmd = () => {
    cmdAbortRef.current = true;
    setIsCmdRunning(false);
  };

  // =========================================================================
  // XUẤT ẢNH CHỤP MÀN HÌNH CMD (PNG IMAGE SNAPSHOT)
  // =========================================================================
  const handleExportCmdImage = () => {
    const timestamp = new Date().toLocaleString('vi-VN');
    const snapshotData: CmdSnapshotData = {
      title: 'NextSu AI - FPT Telecom CMD Diagnostic Report',
      wifiSsid,
      ipAddress: networkInfo?.ipAddress || '192.168.1.7',
      gateway: networkInfo?.gateway || '192.168.1.1',
      logs: cmdLogs,
      timestamp,
    };

    const dataUrl = generateCmdCanvasImage(snapshotData);
    setCmdImageUrl(dataUrl);
    setCmdImageModalVisible(true);
    setCopiedImageNotice('');

    // Nếu chạy trên Web, tự động kích hoạt tải file PNG về máy tính
    if (dataUrl && Platform.OS === 'web') {
      downloadCmdImage(dataUrl, `BaoCao-CMD-FPT-${Date.now()}.png`);
    }
  };

  const handleShareReport = async () => {
    const reportText = [
      `FPT Telecom - Báo Cáo Chẩn Đoán Mạng CMD (${wifiSsid})`,
      `IP: ${networkInfo?.ipAddress || '192.168.1.7'} | Gateway: ${networkInfo?.gateway || '192.168.1.1'}`,
      '------------------------------------------------',
      cmdLogs.slice(-25).join('\n'),
    ].join('\n');

    await shareCmdReport(reportText);
  };

  // =========================================================================
  // CHẾ ĐỘ THẺ (MODERN)
  // =========================================================================
  const selectQuickHost = (host: string) => {
    setTargetHost(host);
    setInputError('');
  };

  const getValidatedHost = (): string | null => {
    const check = validateHostInput(targetHost);
    if (!check.valid) {
      setInputError(check.error || 'Host không hợp lệ.');
      return null;
    }
    setInputError('');
    return check.host;
  };

  const handleStartPing = async () => {
    const validHost = getValidatedHost();
    if (!validHost) return;

    pingAbortRef.current = false;
    setPingRunning(true);
    setPingPackets([]);
    setPingResult(null);

    try {
      const result = await executePing({
        host: validHost,
        count: pingCount,
        timeoutSec: 2,
        shouldAbort: () => pingAbortRef.current,
        onPacket: (pkt) => {
          setPingPackets((prev) => [...prev, pkt]);
        },
      });

      setPingResult(result);
      await saveNetToolResult('PING', validHost, { ping: result });
      loadHistory();
    } catch (err: any) {
      Alert.alert('Lỗi kiểm tra Ping', err?.message || 'Không thể thực hiện kiểm tra ping.');
    } finally {
      setPingRunning(false);
    }
  };

  const handleStopPing = () => {
    pingAbortRef.current = true;
    setPingRunning(false);
  };

  const handleStartTraceroute = async () => {
    const validHost = getValidatedHost();
    if (!validHost) return;

    traceAbortRef.current = false;
    setTraceRunning(true);
    setTraceHops([]);
    setTraceResult(null);
    setTraceStatusText(`Đang bắt đầu dò tuyến đến ${validHost}...`);

    try {
      const result = await executeTraceroute({
        host: validHost,
        maxHops: 30,
        timeoutSec: 2,
        probesPerHop: 3,
        shouldAbort: () => traceAbortRef.current,
        onHop: (hop) => {
          setTraceHops((prev) => [...prev, hop]);
          setTraceStatusText(
            hop.reachedDestination
              ? `Đã đến đích ${hop.ip} ở Hop ${hop.hop}!`
              : `Đang kiểm tra Hop ${hop.hop + 1} / 30...`
          );
        },
      });

      setTraceResult(result);
      if (result.aborted) {
        setTraceStatusText('Đã dừng bởi người dùng.');
      } else if (result.reachedDestination) {
        setTraceStatusText(`Hoàn tất: Đã đến đích ${result.targetIp}!`);
      } else {
        setTraceStatusText(`Đã dừng dò đường sau ${result.hops.length} hop.`);
      }

      await saveNetToolResult('TRACEROUTE', validHost, { traceroute: result });
      loadHistory();
    } catch (err: any) {
      Alert.alert('Lỗi Traceroute', err?.message || 'Không thể thực hiện traceroute.');
      setTraceStatusText('Quá trình dò bị gián đoạn.');
    } finally {
      setTraceRunning(false);
    }
  };

  const handleStopTraceroute = () => {
    traceAbortRef.current = true;
    setTraceRunning(false);
    setTraceStatusText('Đang dừng traceroute...');
  };

  const handleStartNslookup = async () => {
    const validHost = getValidatedHost();
    if (!validHost) return;

    setDnsRunning(true);
    setDnsResult(null);

    try {
      const result = await queryDns({
        host: validHost,
        type: dnsType,
        resolver: dnsResolver,
      });

      setDnsResult(result);
      await saveNetToolResult('NSLOOKUP', validHost, { nslookup: result });
      loadHistory();
    } catch (err: any) {
      Alert.alert('Lỗi Tra Cứu DNS', err?.message || 'Không thể truy vấn DoH.');
    } finally {
      setDnsRunning(false);
    }
  };

  const handleExport = (format: 'CSV' | 'JSON' | 'TXT') => {
    const filtered =
      historyFilter === 'ALL'
        ? historyList
        : historyList.filter((item) => item.type === historyFilter);

    if (filtered.length === 0) {
      Alert.alert('Thông báo', 'Không có dữ liệu trong lịch sử để xuất.');
      return;
    }

    let content = '';
    let title = '';

    if (format === 'CSV') {
      content = exportToCsv(filtered);
      title = 'Dữ liệu CSV (Ping / Traceroute / Nslookup)';
    } else if (format === 'JSON') {
      content = exportToJson(filtered);
      title = 'Dữ liệu JSON có cấu trúc';
    } else {
      content = exportToTxt(filtered);
      title = 'Báo cáo chẩn đoán mạng (Dạng văn bản TXT)';
    }

    setExportContent(content);
    setExportTitle(title);
    setExportModalVisible(true);
    setCopiedNotice('');
  };

  const handleCopyExport = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(exportContent);
      }
      setCopiedNotice('Đã sao chép vào bộ nhớ tạm (Clipboard)!');
      setTimeout(() => setCopiedNotice(''), 3000);
    } catch {
      setCopiedNotice('Vui lòng chọn toàn bộ văn bản để sao chép.');
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa toàn bộ lịch sử đo chẩn đoán mạng không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            await clearNetToolHistory();
            setHistoryList([]);
          },
        },
      ]
    );
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <View style={styles.container}>
      {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color="#0072FF" />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Bộ Công Cụ Mạng (NetTools)</Text>
          <Text style={styles.headerSubtitle}>Ping • Traceroute • Nslookup • Xuất ảnh CMD</Text>
        </View>

        {/* NÚT CHUYỂN ĐỔI CHẾ ĐỘ: CMD vs THẺ */}
        <View style={styles.modeToggleGroup}>
          <TouchableOpacity
            style={[styles.modeToggleBtn, viewMode === 'CMD' && styles.modeToggleBtnActive]}
            onPress={() => setViewMode('CMD')}
          >
            <Ionicons
              name="terminal"
              size={14}
              color={viewMode === 'CMD' ? '#FFFFFF' : '#475569'}
            />
            <Text
              style={[
                styles.modeToggleBtnText,
                viewMode === 'CMD' && styles.modeToggleBtnTextActive,
              ]}
            >
              CMD
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeToggleBtn, viewMode === 'MODERN' && styles.modeToggleBtnActive]}
            onPress={() => setViewMode('MODERN')}
          >
            <Ionicons
              name="grid"
              size={14}
              color={viewMode === 'MODERN' ? '#FFFFFF' : '#475569'}
            />
            <Text
              style={[
                styles.modeToggleBtnText,
                viewMode === 'MODERN' && styles.modeToggleBtnTextActive,
              ]}
            >
              Thẻ
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* THANH BANNER HIỂN THỊ LOGO VÀ TÊN WI-FI RÕ RÀNG                           */}
      {/* ========================================================================= */}
      <View style={styles.wifiBannerCard}>
        <View style={styles.wifiLogoCircle}>
          <Ionicons name="wifi" size={22} color="#0072FF" />
          <View style={styles.wifiGreenPulse} />
        </View>
        <View style={styles.wifiTextWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.wifiTitleLabel}>WI-FI ĐANG BẮT: </Text>
            <Text style={styles.wifiNameHighlight}>{wifiSsid}</Text>
            <TouchableOpacity
              onPress={() => {
                setEditWifiInput(wifiSsid);
                setShowEditWifiModal(true);
              }}
              style={styles.editWifiIconBtn}
            >
              <Ionicons name="pencil" size={13} color="#0072FF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.wifiSubDetails}>
            IP Thiết Bị: {networkInfo?.ipAddress || '192.168.1.7'}  •  Gateway Modem: {networkInfo?.gateway || '192.168.1.1'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshWifiButton} onPress={refreshNetworkInfo}>
          <Ionicons name="refresh" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 1. CHẾ ĐỘ GIAO DIỆN CMD (WINDOWS TERMINAL)                                */}
      {/* ========================================================================= */}
      {viewMode === 'CMD' ? (
        <View style={styles.cmdWindowContainer}>
          {/* TITLE BAR CHUẨN WINDOWS TERMINAL */}
          <View style={styles.cmdTitleBar}>
            <View style={styles.cmdTab}>
              <Ionicons name="terminal" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.cmdTabText}>Command Prompt</Text>
              <Ionicons name="close" size={12} color="#94A3B8" style={{ marginLeft: 8 }} />
            </View>

            <View style={styles.cmdActionIcons}>
              {/* NÚT XUẤT ẢNH CHỤP CMD */}
              <TouchableOpacity style={styles.cmdExportImageBtn} onPress={handleExportCmdImage}>
                <Ionicons name="camera" size={13} color="#FFFFFF" />
                <Text style={styles.cmdExportImageBtnText}>Xuất Ảnh CMD</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cmdHeaderAction}
                onPress={() => {
                  setCmdLogs([
                    ...CMD_BANNER,
                    `[📶 MẠNG ĐANG BẮT: Wi-Fi: ${wifiSsid} | IP: ${networkInfo?.ipAddress || '192.168.1.7'} | Gateway: ${networkInfo?.gateway || '192.168.1.1'}]`,
                    '',
                  ]);
                }}
              >
                <Ionicons name="trash" size={13} color="#94A3B8" />
                <Text style={styles.cmdHeaderActionText}>CLS</Text>
              </TouchableOpacity>

              <View style={styles.cmdWindowControls}>
                <Text style={styles.winControlBtn}>─</Text>
                <Text style={styles.winControlBtn}>□</Text>
                <Text style={[styles.winControlBtn, { color: '#F87171' }]}>✕</Text>
              </View>
            </View>
          </View>

          {/* CHIP LỆNH NHANH CHO ĐIỆN THOẠI */}
          <View style={styles.cmdQuickChipsBar}>
            <Text style={styles.cmdQuickLabel}>Gợi ý:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cmdQuickScroll}>
              <TouchableOpacity
                style={styles.cmdPresetChip}
                onPress={() => {
                  setCmdInput('ping 8.8.8.8');
                  handleExecuteCmd('ping 8.8.8.8');
                }}
              >
                <Text style={styles.cmdPresetText}>ping 8.8.8.8</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cmdPresetChip}
                onPress={() => {
                  setCmdInput('ping google.com');
                  handleExecuteCmd('ping google.com');
                }}
              >
                <Text style={styles.cmdPresetText}>ping google.com</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cmdPresetChip}
                onPress={() => {
                  setCmdInput('tracert google.com');
                  handleExecuteCmd('tracert google.com');
                }}
              >
                <Text style={styles.cmdPresetText}>tracert google.com</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cmdPresetChip}
                onPress={() => {
                  setCmdInput('nslookup google.com');
                  handleExecuteCmd('nslookup google.com');
                }}
              >
                <Text style={styles.cmdPresetText}>nslookup google.com</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cmdPresetChip, { borderColor: '#475569' }]}
                onPress={() => handleExecuteCmd('cls')}
              >
                <Text style={[styles.cmdPresetText, { color: '#F59E0B' }]}>cls</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* MÀN HÌNH TERMINAL ĐEN CHUẨN WINDOWS */}
          <ScrollView
            ref={cmdScrollRef}
            style={styles.cmdConsoleScroll}
            contentContainerStyle={styles.cmdConsoleContent}
          >
            {cmdLogs.map((line, index) => {
              const isCommand = line.startsWith(CMD_PROMPT_PREFIX);
              const isWifiHeader = line.includes('📶 MẠNG');
              const isError =
                line.includes('timed out') ||
                line.includes('100% loss') ||
                line.includes('Lỗi') ||
                line.includes('can\'t find');
              const isSuccess =
                line.includes('Reply from') || line.includes('Trace complete');

              return (
                <Text
                  key={index}
                  style={[
                    styles.cmdText,
                    isCommand && styles.cmdTextCommand,
                    isWifiHeader && styles.cmdTextWifiHeader,
                    isError && styles.cmdTextError,
                    isSuccess && styles.cmdTextSuccess,
                  ]}
                  selectable
                >
                  {line || ' '}
                </Text>
              );
            })}

            {isCmdRunning && (
              <View style={styles.cmdRunningRow}>
                <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 8 }} />
                <Text style={styles.cmdRunningText}>Đang thực thi lệnh... (Bấm Dừng bên dưới nếu cần)</Text>
              </View>
            )}
          </ScrollView>

          {/* DÒNG NHẬP LỆNH DƯỚI CÙNG */}
          <View style={styles.cmdInputBottomBar}>
            <Text style={styles.cmdPromptLabel}>{CMD_PROMPT_PREFIX}</Text>
            <TextInput
              style={styles.cmdTextInput}
              value={cmdInput}
              onChangeText={setCmdInput}
              onSubmitEditing={() => handleExecuteCmd()}
              placeholder="ping 8.8.8.8, tracert google.com, cls..."
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
            />
            {isCmdRunning ? (
              <TouchableOpacity style={styles.cmdStopButton} onPress={handleStopCmd}>
                <Ionicons name="stop" size={14} color="#FFFFFF" />
                <Text style={styles.cmdStopButtonText}>Dừng</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.cmdRunButton}
                onPress={() => handleExecuteCmd()}
              >
                <Ionicons name="play" size={14} color="#FFFFFF" />
                <Text style={styles.cmdRunButtonText}>Chạy</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        /* ========================================================================= */
        /* 2. CHẾ ĐỘ THẺ (MODERN)                                                   */
        /* ========================================================================= */
        <View style={{ flex: 1 }}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'PING' && styles.tabItemActive]}
              onPress={() => setActiveTab('PING')}
            >
              <Ionicons
                name="pulse"
                size={16}
                color={activeTab === 'PING' ? '#0072FF' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'PING' && styles.tabTextActive]}>Ping</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'TRACEROUTE' && styles.tabItemActive]}
              onPress={() => setActiveTab('TRACEROUTE')}
            >
              <Ionicons
                name="git-network"
                size={16}
                color={activeTab === 'TRACEROUTE' ? '#0072FF' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'TRACEROUTE' && styles.tabTextActive]}>
                Traceroute
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'NSLOOKUP' && styles.tabItemActive]}
              onPress={() => setActiveTab('NSLOOKUP')}
            >
              <Ionicons
                name="globe"
                size={16}
                color={activeTab === 'NSLOOKUP' ? '#0072FF' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'NSLOOKUP' && styles.tabTextActive]}>
                Nslookup
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'HISTORY' && styles.tabItemActive]}
              onPress={() => setActiveTab('HISTORY')}
            >
              <Ionicons
                name="time"
                size={16}
                color={activeTab === 'HISTORY' ? '#0072FF' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.tabTextActive]}>
                Lịch Sử ({historyList.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollContent}>
            {activeTab !== 'HISTORY' && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>MỤC TIÊU NHANH:</Text>
                <View style={styles.quickChipsWrap}>
                  {QUICK_HOSTS.map((item) => {
                    const isSelected = targetHost.toLowerCase() === item.host.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={item.host}
                        style={[styles.quickChip, isSelected && styles.quickChipActive]}
                        onPress={() => selectQuickHost(item.host)}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={15}
                          color={isSelected ? '#FFFFFF' : '#2563EB'}
                        />
                        <Text
                          style={[styles.quickChipText, isSelected && styles.quickChipTextActive]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.cardLabel, { marginTop: 12 }]}>HOẶC NHẬP HOST / ĐỊA CHỈ IP:</Text>
                <View style={[styles.inputRow, inputError ? styles.inputRowError : null]}>
                  <Ionicons name="link" size={18} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.hostInput}
                    value={targetHost}
                    onChangeText={(val) => {
                      setTargetHost(val);
                      setInputError('');
                    }}
                    placeholder="Ví dụ: google.com, 8.8.8.8, fpt.vn"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {targetHost.length > 0 && (
                    <TouchableOpacity onPress={() => setTargetHost('')}>
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
                {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}
              </View>
            )}

            {/* TAB PING */}
            {activeTab === 'PING' && (
              <View>
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardLabel}>SỐ GÓI TIN (COUNT):</Text>
                    <View style={styles.countSelector}>
                      {[4, 8, 10].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[styles.countBtn, pingCount === num && styles.countBtnActive]}
                          onPress={() => setPingCount(num)}
                        >
                          <Text
                            style={[
                              styles.countBtnText,
                              pingCount === num && styles.countBtnTextActive,
                            ]}
                          >
                            {num} gói
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginTop: 14 }}>
                    {pingRunning ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.stopBtn]}
                        onPress={handleStopPing}
                      >
                        <Ionicons name="stop-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Dừng Ping</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.actionBtn} onPress={handleStartPing}>
                        <Ionicons name="play" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Bắt Đầu Ping</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {pingResult && (
                  <View style={styles.resultCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.resultTitle}>KẾT QUẢ ĐO PING</Text>
                      <View
                        style={[
                          styles.protocolBadge,
                          pingResult.isTcpFallback
                            ? styles.protocolBadgeTcp
                            : styles.protocolBadgeIcmp,
                        ]}
                      >
                        <Text
                          style={[
                            styles.protocolBadgeText,
                            pingResult.isTcpFallback ? { color: '#B45309' } : { color: '#047857' },
                          ]}
                        >
                          {pingResult.isTcpFallback ? 'Đo bằng TCP (cổng 443)' : 'ICMP Ping'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metricsGrid}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricVal}>
                          {pingResult.received} / {pingResult.sent}
                        </Text>
                        <Text style={styles.metricLabel}>Nhận / Gửi</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text
                          style={[
                            styles.metricVal,
                            pingResult.lossPercent > 0 ? { color: '#DC2626' } : { color: '#16A34A' },
                          ]}
                        >
                          {pingResult.lossPercent}%
                        </Text>
                        <Text style={styles.metricLabel}>Mất gói</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricVal}>{pingResult.avgMs} ms</Text>
                        <Text style={styles.metricLabel}>Trung bình (Avg)</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricVal}>{pingResult.jitterMs} ms</Text>
                        <Text style={styles.metricLabel}>Jitter</Text>
                      </View>
                    </View>

                    <View style={styles.rttDetailRow}>
                      <Text style={styles.rttDetailText}>
                        Min: <Text style={{ fontWeight: '700' }}>{pingResult.minMs} ms</Text>
                      </Text>
                      <Text style={styles.rttDetailText}>
                        Avg: <Text style={{ fontWeight: '700' }}>{pingResult.avgMs} ms</Text>
                      </Text>
                      <Text style={styles.rttDetailText}>
                        Max: <Text style={{ fontWeight: '700' }}>{pingResult.maxMs} ms</Text>
                      </Text>
                    </View>
                  </View>
                )}

                {/* TERMINAL MINI DẠNG CMD */}
                {(pingPackets.length > 0 || pingRunning) && (
                  <View style={styles.terminalBox}>
                    <View style={styles.terminalHeader}>
                      <View style={styles.terminalDots}>
                        <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                        <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                        <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                      </View>
                      <Text style={styles.terminalTitle}>Command Output (CMD Style)</Text>
                      {pingRunning && <ActivityIndicator size="small" color="#38BDF8" />}
                    </View>

                    <View style={styles.terminalContent}>
                      <Text style={styles.cmdTextMini}>
                        {CMD_PROMPT_PREFIX}ping {targetHost}
                      </Text>
                      <Text style={styles.cmdTextMini}>
                        [Wi-Fi: {wifiSsid} | Gateway: {networkInfo?.gateway || '192.168.1.1'}]
                      </Text>
                      <Text style={styles.cmdTextMini}>
                        Pinging {targetHost} with 32 bytes of data:
                      </Text>
                      {pingPackets.map((pkt) => (
                        <Text key={pkt.seq} style={styles.cmdTextMini}>
                          {formatPingPacket(pkt, pingResult?.targetIp || targetHost)}
                        </Text>
                      ))}
                      {pingResult && (
                        <>
                          <Text style={styles.cmdTextMini}> </Text>
                          <Text style={styles.cmdTextMini}>
                            Ping statistics for {pingResult.targetIp || targetHost}:
                          </Text>
                          <Text style={styles.cmdTextMini}>
                            {'    '}Packets: Sent = {pingResult.sent}, Received = {pingResult.received}, Lost ={' '}
                            {pingResult.sent - pingResult.received} ({pingResult.lossPercent}% loss),
                          </Text>
                          <Text style={styles.cmdTextMini}>
                            {'    '}Minimum = {Math.round(pingResult.minMs)}ms, Maximum ={' '}
                            {Math.round(pingResult.maxMs)}ms, Average = {Math.round(pingResult.avgMs)}ms
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* TAB TRACEROUTE */}
            {activeTab === 'TRACEROUTE' && (
              <View>
                <View style={styles.card}>
                  <Text style={styles.helperText}>
                    Traceroute dò tuyến đường mạng từ Modem Wi-Fi ({wifiSsid}) qua các hop ISP tới đích.
                  </Text>

                  <View style={{ marginTop: 12 }}>
                    {traceRunning ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.stopBtn]}
                        onPress={handleStopTraceroute}
                      >
                        <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Hủy Traceroute</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.actionBtn} onPress={handleStartTraceroute}>
                        <Ionicons name="navigate" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Bắt Đầu Traceroute</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {traceStatusText ? (
                    <View style={styles.statusBanner}>
                      {traceRunning && (
                        <ActivityIndicator size="small" color="#0072FF" style={{ marginRight: 8 }} />
                      )}
                      <Text style={styles.statusBannerText}>{traceStatusText}</Text>
                    </View>
                  ) : null}
                </View>

                {traceHops.length > 0 && (
                  <View style={styles.traceTableCard}>
                    <View style={styles.traceTableHeader}>
                      <Text style={[styles.colHop, styles.colHeader]}>Hop</Text>
                      <Text style={[styles.colIp, styles.colHeader]}>Địa Chỉ IP</Text>
                      <Text style={[styles.colRtt, styles.colHeader]}>RTT 1</Text>
                      <Text style={[styles.colRtt, styles.colHeader]}>RTT 2</Text>
                      <Text style={[styles.colRtt, styles.colHeader]}>RTT 3</Text>
                    </View>

                    {traceHops.map((h) => {
                      const isDestination = h.reachedDestination;
                      return (
                        <View
                          key={h.hop}
                          style={[
                            styles.traceTableRow,
                            isDestination && styles.traceTableRowDestination,
                          ]}
                        >
                          <View style={[styles.colHop, { flexDirection: 'row', alignItems: 'center' }]}>
                            <Text
                              style={[
                                styles.colHopText,
                                isDestination && { color: '#059669', fontWeight: '700' },
                              ]}
                            >
                              {h.hop}
                            </Text>
                            {isDestination && (
                              <Ionicons
                                name="flag"
                                size={12}
                                color="#059669"
                                style={{ marginLeft: 3 }}
                              />
                            )}
                          </View>

                          <Text
                            style={[
                              styles.colIp,
                              styles.colIpText,
                              isDestination && { color: '#059669', fontWeight: '700' },
                            ]}
                            numberOfLines={1}
                          >
                            {h.ip}
                          </Text>

                          <Text style={[styles.colRtt, styles.colRttText]}>
                            {h.times[0] !== null ? `${h.times[0]} ms` : '*'}
                          </Text>
                          <Text style={[styles.colRtt, styles.colRttText]}>
                            {h.times[1] !== null ? `${h.times[1]} ms` : '*'}
                          </Text>
                          <Text style={[styles.colRtt, styles.colRttText]}>
                            {h.times[2] !== null ? `${h.times[2]} ms` : '*'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* TAB NSLOOKUP */}
            {activeTab === 'NSLOOKUP' && (
              <View>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>CHỌN MÁY CHỦ DNS (RESOLVER):</Text>
                  <View style={styles.quickChipsWrap}>
                    <TouchableOpacity
                      style={[
                        styles.quickChip,
                        dnsResolver === 'google' && styles.quickChipActive,
                      ]}
                      onPress={() => setDnsResolver('google')}
                    >
                      <Ionicons
                        name="logo-google"
                        size={14}
                        color={dnsResolver === 'google' ? '#FFF' : '#2563EB'}
                      />
                      <Text
                        style={[
                          styles.quickChipText,
                          dnsResolver === 'google' && styles.quickChipTextActive,
                        ]}
                      >
                        Google DNS (8.8.8.8)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.quickChip,
                        dnsResolver === 'cloudflare' && styles.quickChipActive,
                      ]}
                      onPress={() => setDnsResolver('cloudflare')}
                    >
                      <Ionicons
                        name="shield-checkmark"
                        size={14}
                        color={dnsResolver === 'cloudflare' ? '#FFF' : '#2563EB'}
                      />
                      <Text
                        style={[
                          styles.quickChipText,
                          dnsResolver === 'cloudflare' && styles.quickChipTextActive,
                        ]}
                      >
                        Cloudflare (1.1.1.1)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.cardLabel, { marginTop: 12 }]}>LOẠI BẢN GHI (RECORD TYPE):</Text>
                  <View style={styles.dnsTypeWrap}>
                    {(['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'] as DnsRecordType[]).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.dnsTypeChip, dnsType === t && styles.dnsTypeChipActive]}
                        onPress={() => setDnsType(t)}
                      >
                        <Text
                          style={[
                            styles.dnsTypeChipText,
                            dnsType === t && styles.dnsTypeChipTextActive,
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ marginTop: 14 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, dnsRunning && styles.actionBtnDisabled]}
                      onPress={handleStartNslookup}
                      disabled={dnsRunning}
                    >
                      {dnsRunning ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="search" size={18} color="#FFFFFF" />
                          <Text style={styles.actionBtnText}>Tra Cứu DNS ({dnsType})</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.noticeBox}>
                    <Ionicons name="information-circle" size={16} color="#B45309" />
                    <Text style={styles.noticeBoxText}>{DNS_NOTE}</Text>
                  </View>
                </View>

                {dnsResult && (
                  <View style={styles.resultCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.resultTitle}>KẾT QUẢ TRUY VẤN DNS</Text>
                      <View style={styles.latencyBadge}>
                        <Ionicons name="time" size={12} color="#059669" />
                        <Text style={styles.latencyText}>{dnsResult.queryTimeMs} ms</Text>
                      </View>
                    </View>

                    <Text style={styles.resultMeta}>
                      Máy chủ: <Text style={{ fontWeight: '600' }}>{dnsResult.resolverName}</Text> • Trạng
                      thái: <Text style={{ fontWeight: '600' }}>{dnsResult.statusText}</Text>
                    </Text>

                    {dnsResult.records.length === 0 ? (
                      <View style={styles.emptyRecordBox}>
                        <Text style={styles.emptyRecordText}>
                          Không tìm thấy bản ghi {dnsType} cho tên miền này.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ marginTop: 8 }}>
                        {dnsResult.records.map((rec, idx) => (
                          <View key={idx} style={styles.dnsRecordCard}>
                            <View style={styles.rowBetween}>
                              <View style={styles.dnsRecordTag}>
                                <Text style={styles.dnsRecordTagText}>{rec.typeName}</Text>
                              </View>
                              <Text style={styles.dnsTtlText}>TTL: {rec.TTL}s</Text>
                            </View>
                            <Text style={styles.dnsRecordName} numberOfLines={1}>
                              {rec.name}
                            </Text>
                            <Text style={styles.dnsRecordData} selectable>
                              {rec.data}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* TAB LỊCH SỬ & XUẤT */}
            {activeTab === 'HISTORY' && (
              <View>
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardLabel}>LỌC LOẠI ĐO:</Text>
                    {historyList.length > 0 && (
                      <TouchableOpacity onPress={handleClearHistory}>
                        <Text style={styles.clearHistoryText}>Xóa lịch sử</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.filterRow}>
                    {(['ALL', 'PING', 'TRACEROUTE', 'NSLOOKUP'] as const).map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[
                          styles.filterChip,
                          historyFilter === filter && styles.filterChipActive,
                        ]}
                        onPress={() => setHistoryFilter(filter)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            historyFilter === filter && styles.filterChipTextActive,
                          ]}
                        >
                          {filter === 'ALL'
                            ? 'Tất cả'
                            : filter === 'PING'
                            ? 'Ping'
                            : filter === 'TRACEROUTE'
                            ? 'Traceroute'
                            : 'Nslookup'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.cardLabel, { marginTop: 14 }]}>XUẤT BÁO CÁO:</Text>
                  <View style={styles.exportBtnRow}>
                    <TouchableOpacity
                      style={[styles.exportBtn, { backgroundColor: '#059669' }]}
                      onPress={() => handleExport('CSV')}
                    >
                      <Ionicons name="document-text" size={15} color="#FFF" />
                      <Text style={styles.exportBtnText}>Xuất CSV</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.exportBtn, { backgroundColor: '#7C3AED' }]}
                      onPress={() => handleExport('JSON')}
                    >
                      <Ionicons name="code-slash" size={15} color="#FFF" />
                      <Text style={styles.exportBtnText}>Xuất JSON</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.exportBtn, { backgroundColor: '#0284C7' }]}
                      onPress={() => handleExport('TXT')}
                    >
                      <Ionicons name="copy" size={15} color="#FFF" />
                      <Text style={styles.exportBtnText}>Bản TXT</Text>
                    </TouchableOpacity>
                  </View>

                  {/* NÚT XUẤT ẢNH CHỤP CMD */}
                  <TouchableOpacity
                    style={[styles.exportBtn, { backgroundColor: '#0F172A', marginTop: 10 }]}
                    onPress={handleExportCmdImage}
                  >
                    <Ionicons name="camera" size={16} color="#38BDF8" />
                    <Text style={[styles.exportBtnText, { color: '#38BDF8' }]}>
                      📸 Xuất Hình Ảnh Chụp CMD (PNG)
                    </Text>
                  </TouchableOpacity>
                </View>

                {historyList.length === 0 ? (
                  <View style={styles.emptyHistoryBox}>
                    <Ionicons name="file-tray" size={40} color="#94A3B8" />
                    <Text style={styles.emptyHistoryText}>Chưa có lịch sử kiểm tra mạng.</Text>
                    <Text style={styles.emptyHistorySub}>
                      Hãy thực hiện một lần kiểm tra Ping, Traceroute hoặc Nslookup để lưu kết quả.
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 6 }}>
                    {historyList
                      .filter((item) =>
                        historyFilter === 'ALL' ? true : item.type === historyFilter
                      )
                      .map((item) => {
                        const d = new Date(item.timestamp);
                        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d
                          .getMinutes()
                          .toString()
                          .padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}`;

                        return (
                          <View key={item.id} style={styles.historyCard}>
                            <View style={styles.rowBetween}>
                              <View style={styles.historyTagWrap}>
                                <View
                                  style={[
                                    styles.historyTypeBadge,
                                    item.type === 'PING'
                                      ? { backgroundColor: '#DBEAFE' }
                                      : item.type === 'TRACEROUTE'
                                      ? { backgroundColor: '#F3E8FF' }
                                      : { backgroundColor: '#DCFCE7' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.historyTypeBadgeText,
                                      item.type === 'PING'
                                        ? { color: '#1D4ED8' }
                                        : item.type === 'TRACEROUTE'
                                        ? { color: '#7E22CE' }
                                        : { color: '#15803D' },
                                    ]}
                                  >
                                    {item.type}
                                  </Text>
                                </View>
                                <Text style={styles.historyHost}>{item.host}</Text>
                              </View>
                              <Text style={styles.historyTime}>{timeStr}</Text>
                            </View>

                            <View style={styles.historyNetworkRow}>
                              <Ionicons name="wifi" size={12} color="#64748B" />
                              <Text style={styles.historyNetworkText}>
                                Mạng: {wifiSsid} (IP: {item.network?.ipAddress || '192.168.1.7'})
                              </Text>
                            </View>

                            {item.type === 'PING' && item.pingData && (
                              <Text style={styles.historySummaryText}>
                                Avg: {item.pingData.avgMs} ms • Mất gói: {item.pingData.lossPercent}% •
                                Giao thức: {item.pingData.protocol}
                              </Text>
                            )}

                            {item.type === 'TRACEROUTE' && item.tracerouteData && (
                              <Text style={styles.historySummaryText}>
                                {item.tracerouteData.hops.length} hop • Đích:{' '}
                                {item.tracerouteData.reachedDestination ? 'Đã đến' : 'Chưa đến'}
                              </Text>
                            )}

                            {item.type === 'NSLOOKUP' && item.nslookupData && (
                              <Text style={styles.historySummaryText}>
                                Loại: {item.nslookupData.type} • {item.nslookupData.records.length} bản
                                ghi • Độ trễ: {item.nslookupData.queryTimeMs} ms
                              </Text>
                            )}
                          </View>
                        );
                      })}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODAL XEM VÀ TẢI ẢNH CHỤP MÀN HÌNH CMD (PNG SNAPSHOT)                     */}
      {/* ========================================================================= */}
      <Modal
        visible={cmdImageModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCmdImageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="camera" size={18} color="#0072FF" style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>Ảnh Chụp Màn Hình Báo Cáo CMD</Text>
              </View>
              <TouchableOpacity onPress={() => setCmdImageModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalSnapshotContainer}>
              {cmdImageUrl ? (
                <Image
                  source={{ uri: cmdImageUrl }}
                  style={{ width: '100%', height: 380, resizeMode: 'contain' }}
                />
              ) : (
                /* Thẻ xem trước trực tiếp trên điện thoại */
                <View style={styles.snapshotCardView}>
                  <View style={styles.snapshotHeaderBar}>
                    <Text style={styles.snapshotHeaderText}>{'>'}_ Command Prompt (Admin)</Text>
                    <Text style={styles.snapshotWinIcons}>─  □  ✕</Text>
                  </View>

                  <View style={styles.snapshotWifiBanner}>
                    <Ionicons name="wifi" size={14} color="#10B981" />
                    <Text style={styles.snapshotWifiText}>
                      Wi-Fi: {wifiSsid} | IP: {networkInfo?.ipAddress || '192.168.1.7'} | Gateway: {networkInfo?.gateway || '192.168.1.1'}
                    </Text>
                  </View>

                  <View style={{ padding: 10 }}>
                    {cmdLogs.slice(-20).map((l, idx) => (
                      <Text key={idx} style={styles.snapshotLogLine}>{l || ' '}</Text>
                    ))}
                  </View>

                  <View style={styles.snapshotFooterBar}>
                    <Text style={styles.snapshotFooterText}>
                      NextSu AI • FPT Telecom Diagnostic Snapshot
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              {Platform.OS === 'web' && cmdImageUrl ? (
                <TouchableOpacity
                  style={[styles.modalCopyBtn, { backgroundColor: '#059669' }]}
                  onPress={() => downloadCmdImage(cmdImageUrl, `BaoCao-CMD-${Date.now()}.png`)}
                >
                  <Ionicons name="download" size={16} color="#FFF" />
                  <Text style={styles.modalCopyBtnText}>Tải Ảnh PNG</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.modalCopyBtn} onPress={handleShareReport}>
                <Ionicons name="share-social" size={16} color="#FFF" />
                <Text style={styles.modalCopyBtnText}>Chia Sẻ Báo Cáo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCmdImageModalVisible(false)}
              >
                <Text style={styles.modalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL ĐẶT / ĐỔI TÊN MẠNG WI-FI THỦ CÔNG                                  */}
      {/* ========================================================================= */}
      <Modal
        visible={showEditWifiModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditWifiModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: 250 }]}>
            <Text style={styles.modalTitle}>Tên Mạng Wi-Fi Đang Kết Nối</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
              Nhập tên Wi-Fi (SSID) bạn đang bắt để hiển thị trên tiêu đề và báo cáo CMD:
            </Text>

            <TextInput
              style={[styles.hostInput, { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 10, marginTop: 12 }]}
              value={editWifiInput}
              onChangeText={setEditWifiInput}
              placeholder="Ví dụ: FPT_Telecom_5G, Nha_Phong..."
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.modalCopyBtn, { backgroundColor: '#0072FF' }]}
                onPress={handleSaveCustomWifi}
              >
                <Text style={styles.modalCopyBtnText}>Lưu Tên Wi-Fi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowEditWifiModal(false)}
              >
                <Text style={styles.modalCloseBtnText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL XUẤT CSV / JSON / TXT */}
      <Modal
        visible={exportModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {exportTitle}
              </Text>
              <TouchableOpacity onPress={() => setExportModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContentScroll}>
              <Text style={styles.modalText} selectable>
                {exportContent}
              </Text>
            </ScrollView>

            {copiedNotice ? (
              <View style={styles.copiedBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.copiedBannerText}>{copiedNotice}</Text>
              </View>
            ) : null}

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCopyBtn} onPress={handleCopyExport}>
                <Ionicons name="copy" size={16} color="#FFF" />
                <Text style={styles.modalCopyBtnText}>Sao Chép Toàn Bộ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setExportModalVisible(false)}
              >
                <Text style={styles.modalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C0C',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 8,
    padding: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  modeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  modeToggleBtnActive: {
    backgroundColor: '#0F172A',
  },
  modeToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  modeToggleBtnTextActive: {
    color: '#FFFFFF',
  },

  // =========================================================================
  // BANNER WI-FI NỔI BẬT
  // =========================================================================
  wifiBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  wifiLogoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  wifiGreenPulse: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  wifiTextWrap: {
    flex: 1,
  },
  wifiTitleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  wifiNameHighlight: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0072FF',
  },
  editWifiIconBtn: {
    marginLeft: 6,
    padding: 3,
  },
  wifiSubDetails: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  refreshWifiButton: {
    padding: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },

  // =========================================================================
  // STYLES CHẾ ĐỘ CMD WINDOWS
  // =========================================================================
  cmdWindowContainer: {
    flex: 1,
    backgroundColor: '#0C0C0C',
  },
  cmdTitleBar: {
    height: 36,
    backgroundColor: '#1F1F1F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  cmdTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D2D2D',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cmdTabText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cmdActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cmdExportImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0072FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  cmdExportImageBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  cmdHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#2D2D2D',
    gap: 4,
  },
  cmdHeaderActionText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  cmdWindowControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 4,
  },
  winControlBtn: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  cmdQuickChipsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  cmdQuickLabel: {
    color: '#64748B',
    fontSize: 11,
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cmdQuickScroll: {
    gap: 6,
  },
  cmdPresetChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cmdPresetText: {
    color: '#38BDF8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  cmdConsoleScroll: {
    flex: 1,
    backgroundColor: '#0C0C0C',
  },
  cmdConsoleContent: {
    padding: 12,
    paddingBottom: 20,
  },
  cmdText: {
    color: '#CCCCCC',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 18,
  },
  cmdTextMini: {
    color: '#CCCCCC',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  cmdTextCommand: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cmdTextWifiHeader: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  cmdTextError: {
    color: '#F87171',
  },
  cmdTextSuccess: {
    color: '#4ADE80',
  },
  cmdRunningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  cmdRunningText: {
    color: '#38BDF8',
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cmdInputBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  cmdPromptLabel: {
    color: '#38BDF8',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    marginRight: 6,
  },
  cmdTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
  },
  cmdRunButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    marginLeft: 6,
  },
  cmdRunButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cmdStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    marginLeft: 6,
  },
  cmdStopButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // =========================================================================
  // STYLES CHẾ ĐỘ THẺ (MODERN)
  // =========================================================================
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0072FF',
  },
  tabText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginLeft: 4,
  },
  tabTextActive: {
    color: '#0072FF',
  },
  contentScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickChipActive: {
    backgroundColor: '#0072FF',
    borderColor: '#0072FF',
  },
  quickChipText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
    marginLeft: 6,
  },
  quickChipTextActive: {
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  inputRowError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  hostInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  errorText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  countBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  countBtnActive: {
    backgroundColor: '#0072FF',
    borderColor: '#0072FF',
  },
  countBtnText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  countBtnTextActive: {
    color: '#FFFFFF',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0072FF',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  stopBtn: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  protocolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  protocolBadgeIcmp: {
    backgroundColor: '#D1FAE5',
  },
  protocolBadgeTcp: {
    backgroundColor: '#FEF3C7',
  },
  protocolBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  rttDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rttDetailText: {
    fontSize: 11,
    color: '#475569',
  },
  terminalBox: {
    backgroundColor: '#0C0C0C',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 12,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  terminalDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  terminalTitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  terminalContent: {
    padding: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  statusBannerText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
    flex: 1,
  },
  traceTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  traceTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  colHop: {
    width: 44,
  },
  colIp: {
    flex: 1,
  },
  colRtt: {
    width: 52,
    textAlign: 'right',
  },
  colHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  traceTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  traceTableRowDestination: {
    backgroundColor: '#ECFDF5',
  },
  colHopText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  colIpText: {
    fontSize: 11,
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  colRttText: {
    fontSize: 11,
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'right',
  },
  dnsTypeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  dnsTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dnsTypeChipActive: {
    backgroundColor: '#0072FF',
    borderColor: '#0072FF',
  },
  dnsTypeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  dnsTypeChipTextActive: {
    color: '#FFFFFF',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noticeBoxText: {
    fontSize: 11,
    color: '#92400E',
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  latencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  latencyText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '700',
    marginLeft: 4,
  },
  resultMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 8,
  },
  emptyRecordBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyRecordText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  dnsRecordCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dnsRecordTag: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dnsRecordTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3730A3',
  },
  dnsTtlText: {
    fontSize: 10,
    color: '#64748B',
  },
  dnsRecordName: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  dnsRecordData: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterChipActive: {
    backgroundColor: '#0072FF',
    borderColor: '#0072FF',
  },
  filterChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  clearHistoryText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  exportBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 5,
  },
  exportBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyHistoryBox: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
  },
  emptyHistoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
  },
  emptyHistorySub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  historyTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyHost: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  historyNetworkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  historyNetworkText: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
  historySummaryText: {
    fontSize: 11,
    color: '#334155',
    marginTop: 4,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxHeight: '85%',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 10,
  },
  modalSnapshotContainer: {
    backgroundColor: '#0C0C0C',
    borderRadius: 10,
    marginTop: 10,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: '#333333',
    overflow: 'hidden',
  },
  snapshotCardView: {
    backgroundColor: '#0C0C0C',
  },
  snapshotHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  snapshotHeaderText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  snapshotWinIcons: {
    color: '#94A3B8',
    fontSize: 12,
  },
  snapshotWifiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  snapshotWifiText: {
    color: '#38BDF8',
    fontSize: 10,
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  snapshotLogLine: {
    color: '#CCCCCC',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 14,
  },
  snapshotFooterBar: {
    backgroundColor: '#141414',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#262626',
  },
  snapshotFooterText: {
    color: '#64748B',
    fontSize: 9,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalContentScroll: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    maxHeight: 350,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalText: {
    fontSize: 11,
    color: '#1E293B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  copiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    justifyContent: 'center',
  },
  copiedBannerText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    marginLeft: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modalCopyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0072FF',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  modalCopyBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
});
