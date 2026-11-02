import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Ionicons,
  Zap,
  Camera,
  Users,
  Rocket,
  RefreshCw,
  Network,
  Cpu,
  Search,
  Activity,
  ShieldCheck,
  Briefcase,
  FileCheck,
  Calendar,
  User,
} from './AppIcon';
import * as ImagePicker from 'expo-image-picker';
import { CONFIG } from '../config';
import { Alert } from '../utils/alert';
import {
  callAppsScriptJsonApi,
  changeEmployeePassword,
  EmployeeProfile,
  fetchActiveStaffList,
  StaffOption,
} from '../services/sheetAuthService';
import { ScheduleView } from './ScheduleView';
import { UserProfileView } from './UserProfileView';
import { BottomNavigation } from 'react-native-paper';
import { PortalWebView } from './PortalWebView';
import { NetToolsView } from './NetToolsView';

const hasVietnameseDiacritics = (str: string): boolean => {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(
    str
  );
};

interface HomeScreenProps {
  token: string;
  profile: EmployeeProfile;
  password?: string;
  onLogout: () => void;
}

type ActiveTab =
  | 'HOME'
  | 'SCHEDULE'
  | 'BYPASS'
  | 'CLEAR'
  | 'MYBAE'
  | 'MANUAL'
  | 'SPAM'
  | 'RESETMAC'
  | 'RECALL_PORT'
  | 'OSP'
  | 'SEARCH_360'
  | 'WEBVIEW'
  | 'NET_TOOLS';

export interface TrackedRequest {
  id: string;
  taskType: 'BYPASS' | 'CLEAR' | 'MYBAE' | 'MANUAL' | 'SPAM' | 'RESETMAC' | 'RECALL_PORT' | 'OSP' | 'SEARCH_360';
  taskName: string;
  shd: string;
  status: string;
  note?: string;
  pending: boolean;
  createdAt: string;
  updatedAt?: string;
  timestamp?: number;
  dateStr?: string;
}

/**
 * Màn hình Chính Native của ứng dụng Nextsu AI - FPT Telecom.
 * Cung cấp đầy đủ các tác vụ:
 * 1. Bypass (Bo Gong)
 * 2. Clear Cls có SR
 * 3. Bypass MyBAE (kèm chụp ảnh Camera / chọn ảnh từ thư viện)
 * 4. Phân Công Tay (tự động điền Đối tác & Block khi chọn Nhân viên)
 * 5. SpamPool Ưu Tiên
 * 6. Reset MAC
 * 7. Chế độ Cổng Web (mở trực tiếp Web App kèm phiên đã đăng nhập)
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({
  token,
  profile,
  password,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('HOME');
  const [mainTab, setMainTab] = useState<number>(0); // 0=Công việc, 1=Yêu cầu, 2=Lịch trực, 3=User
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [history, setHistory] = useState<TrackedRequest[]>([]);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState<boolean>(false);
  const historyRef = useRef<TrackedRequest[]>([]);
  historyRef.current = history;

  // Banner thông báo kết quả gửi yêu cầu thành công ở tab "Yêu cầu"
  const [successBanner, setSuccessBanner] = useState<{
    id: string;
    shd: string;
    task: string;
  } | null>(null);

  // Modals xác nhận xóa lịch sử yêu cầu (không phụ thuộc window.confirm của trình duyệt)
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; shd: string } | null>(null);

  // Bộ lọc ngày, Tìm kiếm & Phân trang cho tab "Yêu cầu"
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 6;

  // Ngày giờ thực tế và Thời tiết khu vực
  const [currentDateTimeStr, setCurrentDateTimeStr] = useState<string>('');
  const [weatherInfo, setWeatherInfo] = useState<string>('');

  // Tự động cập nhật Ngày / Giờ thực tế mỗi 30 giây
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = days[now.getDay()];
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentDateTimeStr(`${dayName}, ${day}/${month}/${year} • ${hours}:${minutes}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  // Tải dữ liệu thời tiết trực tiếp từ Open-Meteo API
  useEffect(() => {
    let active = true;
    const loadWeather = async () => {
      try {
        const isHanoi =
          profile.email.toLowerCase().includes('hn') ||
          profile.email.toLowerCase().includes('hanoi') ||
          (profile.block && profile.block.toLowerCase().includes('hn'));
        const lat = isHanoi ? 21.0285 : 10.8231;
        const lon = isHanoi ? 105.8542 : 106.6297;
        const cityName = isHanoi ? 'Hà Nội' : 'TP.HCM';

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Asia%2FHo_Chi_Minh`
        );
        if (!res.ok) return;
        const data = await res.json();
        const cw = data.current_weather;
        if (!cw || !active) return;

        const temp = Math.round(cw.temperature);
        const code = cw.weathercode;
        let desc = 'Trời quang';
        let icon = '☀️';

        if (code === 0) {
          desc = cw.is_day ? 'Nắng đẹp' : 'Trời quang';
          icon = cw.is_day ? '☀️' : '🌙';
        } else if (code <= 3) {
          desc = 'Có mây';
          icon = '⛅';
        } else if (code <= 48) {
          desc = 'Sương mù';
          icon = '🌫️';
        } else if (code <= 67) {
          desc = 'Mưa nhẹ';
          icon = '🌦️';
        } else if (code <= 82) {
          desc = 'Mưa rào';
          icon = '🌧️';
        } else if (code >= 95) {
          desc = 'Có dông';
          icon = '⛈️';
        }

        setWeatherInfo(`${icon} ${temp}°C • ${desc} (${cityName})`);
      } catch (err) {
        console.warn('Lỗi lấy thời tiết:', err);
      }
    };

    loadWeather();
    const weatherTimer = setInterval(loadWeather, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(weatherTimer);
    };
  }, [profile.email, profile.block]);

  // Tự động ẩn banner thành công sau 5 giây
  useEffect(() => {
    if (!successBanner) return;
    const t = setTimeout(() => setSuccessBanner(null), 5000);
    return () => clearTimeout(t);
  }, [successBanner]);

  const storageKey = `@nextsu_ai_history_${profile.email.trim().toLowerCase()}`;

  // Hàm chuyển loại tác vụ thành action kiểm tra trạng thái tương ứng trên Google Apps Script
  const getStatusActionForTask = (taskType: string): string => {
    switch (taskType) {
      case 'BYPASS':
        return 'bypassStatus';
      case 'CLEAR':
        return 'clearStatus';
      case 'MYBAE':
        return 'myBaeStatus';
      case 'MANUAL':
        return 'manualStatus';
      case 'SPAM':
        return 'spamStatus';
      case 'RESETMAC':
        return 'resetMacStatus';
      case 'RECALL_PORT':
        return 'recallPortStatus';
      case 'OSP':
        return 'ospStatus';
      case 'SEARCH_360':
        return 'search360Status';
      default:
        return 'bypassStatus';
    }
  };

  // Cấu hình giao diện badge trạng thái (màu sắc, icon, văn bản ngắn gọn + chi tiết)
  const getStatusBadgeConfig = (item: TrackedRequest) => {
    const raw = String(item.status || '').trim();
    const s = raw.toLowerCase();

    // 1. Nhóm LỖI / THẤT BẠI / TỪ CHỐI / CHƯA GỬI THÀNH CÔNG -> Luôn hiển thị MÀU ĐỎ
    const isFail =
      s.includes('không thành công') ||
      s.includes('chưa gửi') ||
      s.includes('chưa vào sheet') ||
      s.includes('từ chối') ||
      s.includes('không hợp lệ') ||
      s.includes('thất bại') ||
      s.includes('hủy') ||
      s.includes('lỗi');

    if (isFail) {
      let label = 'Không thành công';
      if (s.includes('chưa gửi') || s.includes('chưa vào sheet')) {
        label = 'Chưa vào Sheet';
      } else if (s.includes('từ chối')) {
        label = 'Từ chối';
      } else if (s.includes('không hợp lệ')) {
        label = 'Không hợp lệ';
      }

      // Trích xuất chi tiết giải thích lỗi (bỏ bớt tiền tố "Không thành công : ")
      let detail = raw;
      if (/^không thành công\s*[:\-]\s*/i.test(detail)) {
        detail = detail.replace(/^không thành công\s*[:\-]\s*/i, '');
      }
      if (label === 'Chưa vào Sheet' && !item.note) {
        detail = 'Hệ thống Google Sheet chưa ghi nhận yêu cầu này. Vui lòng gửi lại hoặc xóa thẻ.';
      }

      return {
        bg: '#FEE2E2',
        border: '#FCA5A5',
        text: '#DC2626',
        icon: 'close-circle' as const,
        label,
        detail: detail !== label ? detail : '',
        isFail: true,
      };
    }

    // 2. Nhóm ĐÃ HOÀN TẤT / THÀNH CÔNG -> Luôn hiển thị MÀU XANH LÁ
    const isDone =
      s.includes('đã xử lý') ||
      s.includes('hoàn tất') ||
      s.includes('thành công') ||
      s.includes('xong') ||
      s.includes('chấp nhận') ||
      s.includes('đã gửi') ||
      s.includes('đã duyệt') ||
      (!item.pending && s !== 'chưa cập nhật' && s !== 'chưa xử lý' && s !== '');

    if (isDone) {
      let label = 'Đã xử lý';
      if (s.includes('cập nhật thành công')) {
        label = 'Cập nhật thành công';
      } else if (s.includes('đã duyệt')) {
        label = 'Đã duyệt';
      } else if (s.includes('đã gửi')) {
        label = 'Đã ghi nhận';
      }

      const detail = raw.length > 25 ? raw : '';
      return {
        bg: '#DCFCE7',
        border: '#86EFAC',
        text: '#15803D',
        icon: 'checkmark-circle' as const,
        label,
        detail,
        isFail: false,
      };
    }

    // 3. Nhóm ĐANG XỬ LÝ / CHỜ CẬP NHẬT -> Luôn hiển thị MÀU VÀNG CAM
    return {
      bg: '#FEF3C7',
      border: '#FCD34D',
      text: '#B45309',
      icon: 'hourglass-outline' as const,
      label: raw.length > 20 ? 'Đang xử lý' : raw || 'Chưa cập nhật',
      detail: raw.length > 20 ? raw : '',
      isFail: false,
    };
  };

  // Kiểm tra trạng thái của một yêu cầu cụ thể trực tiếp từ Sheet
  const checkSingleStatus = async (item: TrackedRequest): Promise<TrackedRequest> => {
    try {
      const action = getStatusActionForTask(item.taskType);
      const res = await callAppsScriptJsonApi<any>({
        action,
        token,
        id: item.id,
        email: profile.email,
      });

      if (res && res.ok) {
        const newStatus = String(res.status || '').trim();
        const newNote = String(res.note || '').trim();
        const newPending = typeof res.pending === 'boolean' ? res.pending : false;

        return {
          ...item,
          status: newStatus || item.status,
          note: newNote,
          pending: newPending,
          updatedAt: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };
      }

      // Mã yêu cầu không tồn tại trên Sheet -> yêu cầu chưa từng gửi lên hệ thống thành công
      if (
        res &&
        (res.notFound ||
          (res.ok === false &&
            (String(res.msg || '').toLowerCase().includes('không tìm thấy') ||
              String(res.msg || '').toLowerCase().includes('không hợp lệ'))))
      ) {
        return {
          ...item,
          status: 'Chưa gửi lên hệ thống',
          note: `Không tìm thấy mã #${item.id} trên Sheet (chưa gửi thành công). Vui lòng gửi lại hoặc xóa thẻ.`,
          pending: false,
          updatedAt: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra trạng thái yêu cầu #' + item.id, e);
    }
    return item;
  };

  // Làm mới trạng thái của danh sách yêu cầu
  const reloadAllStatuses = useCallback(
    async (forceAll: boolean = false) => {
      const currentList = historyRef.current;
      if (currentList.length === 0) return;

      setIsRefreshingStatus(true);
      try {
        let hasChanges = false;
        const updatedList = await Promise.all(
          currentList.map(async (item) => {
            if (!forceAll && !item.pending) return item;
            const updated = await checkSingleStatus(item);
            if (
              updated.status !== item.status ||
              updated.pending !== item.pending ||
              updated.note !== item.note
            ) {
              hasChanges = true;
            }
            return updated;
          })
        );

        if (hasChanges || forceAll) {
          setHistory(updatedList);
          await AsyncStorage.setItem(storageKey, JSON.stringify(updatedList));
        }
      } catch (err) {
        console.warn('Lỗi cập nhật danh sách yêu cầu:', err);
      } finally {
        setIsRefreshingStatus(false);
      }
    },
    [token, profile.email, storageKey]
  );

  // Helper lấy ngày DD/MM/YYYY và timestamp của một yêu cầu để lọc và sắp xếp
  const getItemDate = (item: TrackedRequest): { dateStr: string; timestamp: number } => {
    if (item.timestamp && item.dateStr) {
      return { dateStr: item.dateStr, timestamp: item.timestamp };
    }
    const match = String(item.createdAt || '').match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (match) {
      const parts = match[1].split('/');
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      return { dateStr: match[1], timestamp: dt.getTime() };
    }
    // Nếu chỉ có giờ lưu, tính là ngày hiện tại
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    return { dateStr: todayStr, timestamp: today.getTime() };
  };

  // Lọc và sắp xếp danh sách yêu cầu (Mới nhất ở trang 1)
  const filteredAndSortedHistory = React.useMemo(() => {
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    const yesterdayStr = `${String(yest.getDate()).padStart(2, '0')}/${String(yest.getMonth() + 1).padStart(2, '0')}/${yest.getFullYear()}`;

    const sevenDaysAgoTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const cleanSearch = searchQuery.trim().toLowerCase();

    return [...history]
      .filter((item) => {
        // 1. Lọc theo tìm kiếm (SHD, Mã #ID, Tên tác vụ, Trạng thái, Ghi chú)
        if (cleanSearch) {
          const matchSearch =
            item.shd.toLowerCase().includes(cleanSearch) ||
            item.id.toLowerCase().includes(cleanSearch) ||
            item.taskName.toLowerCase().includes(cleanSearch) ||
            item.status.toLowerCase().includes(cleanSearch) ||
            (item.note && item.note.toLowerCase().includes(cleanSearch));
          if (!matchSearch) return false;
        }

        // 2. Lọc theo ngày
        if (dateFilter !== 'all') {
          const { dateStr, timestamp } = getItemDate(item);
          if (dateFilter === 'today') {
            return dateStr === todayStr;
          }
          if (dateFilter === 'yesterday') {
            return dateStr === yesterdayStr;
          }
          if (dateFilter === 'week') {
            return timestamp >= sevenDaysAgoTime;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sắp xếp ngày mới nhất lên đầu (trang 1)
        const timeA = a.timestamp || getItemDate(a).timestamp || (parseInt(a.id, 10) || 0);
        const timeB = b.timestamp || getItemDate(b).timestamp || (parseInt(b.id, 10) || 0);
        return timeB - timeA;
      });
  }, [history, searchQuery, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedHistory.length / PAGE_SIZE));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedHistory = filteredAndSortedHistory.slice(
    (validCurrentPage - 1) * PAGE_SIZE,
    validCurrentPage * PAGE_SIZE
  );

  // Tải danh sách yêu cầu đã lưu từ AsyncStorage khi mở màn hình và tự làm mới ngay
  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw && active) {
          const list: TrackedRequest[] = JSON.parse(raw);
          setHistory(list);
          historyRef.current = list;
          // Ngay khi mở app, tự động kiểm tra lại trạng thái các yêu cầu
          setTimeout(() => {
            reloadAllStatuses(true);
          }, 600);
        }
      } catch {}
    };
    loadHistory();
    return () => {
      active = false;
    };
  }, [storageKey, reloadAllStatuses]);

  // Tự động kiểm tra định kỳ mỗi 5 giây khi có yêu cầu đang xử lý (pending = true)
  useEffect(() => {
    const hasPending = history.some((item) => item.pending);
    if (!hasPending) return;

    const interval = setInterval(() => {
      reloadAllStatuses(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [history, reloadAllStatuses]);

  // Form states dùng chung
  const [shd, setShd] = useState<string>('');
  const [selectedCause, setSelectedCause] = useState<string>('');
  const [otherCauseText, setOtherCauseText] = useState<string>('');
  const [optimizeChannelType, setOptimizeChannelType] = useState<
    'POOL' | 'BYPASS_IPNAT' | 'DEACTIVE_IP'
  >('POOL');
  const [attachedImageBase64, setAttachedImageBase64] = useState<string | null>(
    null
  );
  const [attachedImageUri, setAttachedImageUri] = useState<string | null>(null);

  // States cho Phân Công Tay
  const [manualType, setManualType] = useState<string>('TRIỂN KHAI');
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [showStaffModal, setShowStaffModal] = useState<boolean>(false);

  // Modal đổi mật khẩu
  const [showChangePassModal, setShowChangePassModal] = useState<boolean>(false);
  const [oldPassInput, setOldPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [confirmPassInput, setConfirmPassInput] = useState<string>('');
  const [changingPass, setChangingPass] = useState<boolean>(false);
  const [avatarLoadError, setAvatarLoadError] = useState<boolean>(false);

  // States cho Thu Hồi Port, OSP và Tra Cứu 360 (UI-only)
  const [ospActionType, setOspActionType] = useState<string>('Điều chuyển OSP');
  const [search360Type, setSearch360Type] = useState<'Hợp đồng' | 'TSTC'>('Hợp đồng');
  const [search360Result, setSearch360Result] = useState<any>(null);
  const [searching360, setSearching360] = useState<boolean>(false);

  // Tải danh sách nhân viên Active khi vào màn hình
  useEffect(() => {
    fetchActiveStaffList().then((list) => setStaffList(list));
  }, []);

  // Xử lý nút Back vật lý trên Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTab !== 'HOME') {
        setActiveTab('HOME');
        return true;
      }
      if (mainTab !== 0) {
        setMainTab(0);
        return true;
      }
      Alert.alert(
        'Thoát ứng dụng?',
        'Bạn có chắc chắn muốn đóng ứng dụng Nextsu AI - FPT Telecom không?',
        [
          { text: 'Ở lại', style: 'cancel' },
          {
            text: 'Thoát',
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ]
      );
      return true;
    });
    return () => sub.remove();
  }, [activeTab, mainTab]);

  // Chọn tab tác vụ và khởi tạo giá trị mặc định
  const openTaskTab = (tab: ActiveTab) => {
    // Chỉ riêng tác vụ OSP yêu cầu quyền Admin
    if (tab === 'OSP' && profile.role !== 'Admin') {
      Alert.alert(
        'Quyền truy cập Admin',
        'Tác vụ "OSP" chỉ dành riêng cho tài khoản có quyền Quản trị viên (Admin).'
      );
      return;
    }
    setShd('');
    setOtherCauseText('');
    setAttachedImageBase64(null);
    setAttachedImageUri(null);
    setSearch360Result(null);
    if (tab === 'BYPASS') setSelectedCause(CONFIG.BYPASS_CAUSE2_OPTIONS[0]);
    if (tab === 'CLEAR') setSelectedCause(CONFIG.CLEAR_CAUSE1_OPTIONS[0]);
    if (tab === 'MYBAE') setSelectedCause(CONFIG.MYBAE_CAUSE1_OPTIONS[0]);
    if (tab === 'SPAM') {
      setSelectedCause(CONFIG.OPTIMIZE_CAUSE_OPTIONS[0]);
      setOptimizeChannelType('POOL');
    }
    if (tab === 'OSP') setOspActionType('Điều chuyển OSP');
    setActiveTab(tab);
  };

  // Chụp ảnh từ Camera hoặc chọn từ Thư viện cho Bypass MyBAE
  const handlePickImage = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Cần cấp quyền Camera',
            'Vui lòng cho phép ứng dụng sử dụng Camera để chụp ảnh minh chứng.'
          );
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Cần cấp quyền Thư viện',
            'Vui lòng cho phép ứng dụng truy cập Thư viện ảnh.'
          );
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.6,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.6,
            base64: true,
          });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setAttachedImageUri(asset.uri);
        if (asset.base64) {
          setAttachedImageBase64(`data:image/jpeg;base64,${asset.base64}`);
        }
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở trình chọn ảnh trên thiết bị.');
    }
  };

  // Tra cứu 360 (TSTC / Hợp đồng) - UI only
  const handleSearch360 = async () => {
    const cleanKw = shd.trim().toUpperCase();
    if (cleanKw.length < 3) {
      Alert.alert(
        'Từ khóa không hợp lệ',
        `Vui lòng nhập mã ${search360Type} hợp lệ (tối thiểu 3 ký tự).`
      );
      return;
    }
    setSearching360(true);
    setTimeout(() => {
      setSearch360Result({
        type: search360Type,
        code: cleanKw,
        status: 'Đang hoạt động (Online)',
        port: 'PON-01/02/08 - OSP Tủ T04.C12',
        customer: `Khách hàng FPT Telecom - Khu vực Block ${profile.block || 'Chính'}`,
        time:
          new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
          ' ' +
          new Date().toLocaleDateString('vi-VN'),
      });
      setSearching360(false);
    }, 400);
  };

  // Xóa toàn bộ lịch sử yêu cầu trên máy
  const handleClearAllHistory = async () => {
    setHistory([]);
    historyRef.current = [];
    setShowClearModal(false);
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch {}
  };

  // Xóa 1 thẻ yêu cầu cụ thể
  const handleDeleteSingleItem = async (id: string) => {
    const next = historyRef.current.filter((h) => h.id !== id);
    setHistory(next);
    historyRef.current = next;
    setItemToDelete(null);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  // Gửi yêu cầu nghiệp vụ
  const handleSubmitTask = async () => {
    const cleanShd = shd.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._\-\/]{3,29}$/.test(cleanShd)) {
      Alert.alert(
        'SHD không hợp lệ',
        'Vui lòng nhập Số Hợp Đồng (SHD) hợp lệ (từ 4 đến 30 ký tự chữ/số).'
      );
      return;
    }

    if (activeTab === 'MYBAE' && !attachedImageBase64) {
      Alert.alert(
        'Thiếu hình ảnh',
        'Vui lòng chụp ảnh hoặc chọn ảnh minh chứng trước khi gửi Bypass NT Mỹ Bảo.'
      );
      return;
    }

    if (activeTab === 'MANUAL' && !selectedStaff) {
      Alert.alert(
        'Chưa chọn nhân sự',
        'Vui lòng chọn Nhân viên đến để hệ thống điền Đối tác và Block.'
      );
      return;
    }

    if (activeTab === 'SPAM' && selectedCause === 'Khác') {
      const trimmedOther = otherCauseText.trim();
      if (trimmedOther.length < 1) {
        Alert.alert(
          'Thiếu nội dung',
          'Vui lòng nhập mô tả nguyên nhân khác.'
        );
        return;
      }
      if (hasVietnameseDiacritics(trimmedOther)) {
        Alert.alert(
          'Lỗi định dạng nguyên nhân',
          'Quy định hệ thống yêu cầu nhập nguyên nhân KHÔNG DẤU.\nVui lòng xóa dấu tiếng Việt và thử lại!'
        );
        return;
      }
    }

    // Tác vụ Thu Hồi Port (UI-only)
    if (activeTab === 'RECALL_PORT') {
      const assignedId = String(Date.now()).slice(-4);
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      const newReq: TrackedRequest = {
        id: assignedId,
        taskType: 'RECALL_PORT',
        taskName: 'Thu Hồi Port',
        shd: cleanShd,
        status: 'Đã gửi yêu cầu',
        note: otherCauseText.trim() || undefined,
        pending: false,
        createdAt: `${timeStr} • ${dateStr}`,
        dateStr,
        timestamp: now.getTime(),
      };
      const updated = [newReq, ...historyRef.current];
      setHistory(updated);
      historyRef.current = updated;
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}

      setShd('');
      setOtherCauseText('');
      // Tự động chuyển ngay lập tức sang tab "Yêu cầu"
      setActiveTab('HOME');
      setMainTab(1);
      setCurrentPage(1);
      setSuccessBanner({
        id: assignedId,
        shd: cleanShd,
        task: 'Thu Hồi Port',
      });
      return;
    }

    // Tác vụ OSP (UI-only dành riêng cho Admin)
    if (activeTab === 'OSP') {
      const assignedId = String(Date.now()).slice(-4);
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      const newReq: TrackedRequest = {
        id: assignedId,
        taskType: 'OSP',
        taskName: `OSP (${ospActionType})`,
        shd: cleanShd,
        status: 'Đã duyệt (Admin)',
        note: otherCauseText.trim() || undefined,
        pending: false,
        createdAt: `${timeStr} • ${dateStr}`,
        dateStr,
        timestamp: now.getTime(),
      };
      const updated = [newReq, ...historyRef.current];
      setHistory(updated);
      historyRef.current = updated;
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}

      setShd('');
      setOtherCauseText('');
      // Tự động chuyển ngay lập tức sang tab "Yêu cầu"
      setActiveTab('HOME');
      setMainTab(1);
      setCurrentPage(1);
      setSuccessBanner({
        id: assignedId,
        shd: cleanShd,
        task: `OSP (${ospActionType})`,
      });
      return;
    }

    setSubmitting(true);

    let payload: Record<string, any> = { token, email: profile.email };
    let taskLabel = '';

    switch (activeTab) {
      case 'BYPASS':
        taskLabel = 'Bypass Công Suất';
        payload = {
          ...payload,
          action: 'bypassSubmit',
          shd: cleanShd,
          cause2: selectedCause,
        };
        break;
      case 'CLEAR':
        taskLabel = 'Clear Cls có SR';
        payload = {
          ...payload,
          action: 'clearSubmit',
          shd: cleanShd,
          cause1: selectedCause,
        };
        break;
      case 'MYBAE':
        taskLabel = 'Bypass NT Mỹ Bảo';
        payload = {
          ...payload,
          action: 'myBaeSubmit',
          shd: cleanShd,
          cause1: selectedCause,
          image: attachedImageBase64,
        };
        break;
      case 'MANUAL':
        taskLabel = `Phân Công Tay (${manualType})`;
        payload = {
          ...payload,
          action: 'manualSubmit',
          items: [
            {
              shd: cleanShd,
              type: manualType,
              partner: selectedStaff?.partner,
              block: selectedStaff?.block,
              staff: selectedStaff?.name,
            },
          ],
        };
        break;
      case 'SPAM': {
        const targetOpt =
          CONFIG.OPTIMIZE_TARGET_OPTIONS.find((o) => o.id === optimizeChannelType) ||
          CONFIG.OPTIMIZE_TARGET_OPTIONS[0];
        taskLabel = `Tối Ưu Kênh Truyền (${targetOpt.label})`;
        const finalCause =
          selectedCause === 'Khác'
            ? `Khác: ${otherCauseText.trim()}`
            : selectedCause;
        payload = {
          ...payload,
          action: 'spamSubmit',
          shd: cleanShd,
          cause: finalCause,
          other: otherCauseText.trim(),
          taskName: targetOpt.sheetTask,
          targetType: optimizeChannelType,
          gid: targetOpt.gid,
        };
        break;
      }
      case 'RESETMAC':
        taskLabel = 'Reset MAC';
        payload = {
          ...payload,
          action: 'resetMacSubmit',
          shd: cleanShd,
        };
        break;
    }

    const res = await callAppsScriptJsonApi<any>(payload);
    setSubmitting(false);

    if (!res || res.ok === false) {
      Alert.alert(
        'Lỗi gửi yêu cầu lên Sheet',
        res?.msg ||
          'Không nhận được phản hồi xác nhận từ Google Sheet. Vui lòng kiểm tra kết nối mạng hoặc thử lại.'
      );
      return;
    }

    // Phân Công Tay: máy chủ trả ok nhưng từng hợp đồng có thể bị từ chối (đã PTC, trùng...)
    if (Array.isArray(res.results) && res.results.length > 0) {
      const first = res.results[0];
      if (!first?.ok) {
        Alert.alert(
          'Chưa gửi được lên hệ thống',
          first?.msg || 'Yêu cầu bị hệ thống từ chối, vui lòng kiểm tra lại thông tin.'
        );
        return;
      }
    }

    const serverId = String(
      res?.id || (Array.isArray(res?.results) && res.results[0]?.id) || ''
    ).trim();
    if (!serverId) {
      Alert.alert(
        'Chưa gửi lên hệ thống',
        'Hệ thống Google Sheet chưa tạo được mã yêu cầu (chưa ghi nhận thành công). Vui lòng thử lại.'
      );
      return;
    }
    const assignedId = serverId;

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newReq: TrackedRequest = {
      id: assignedId,
      taskType: activeTab as any,
      taskName: taskLabel,
      shd: cleanShd,
      status: res?.resumed ? 'Đang theo dõi tiếp' : 'Chưa cập nhật',
      pending: true,
      createdAt: `${timeStr} • ${dateStr}`,
      dateStr,
      timestamp: now.getTime(),
    };

    const nextHistory = [newReq, ...historyRef.current];
    setHistory(nextHistory);
    historyRef.current = nextHistory;

    setShd('');
    setOtherCauseText('');
    setAttachedImageBase64(null);
    setAttachedImageUri(null);

    // Gửi thành công -> Tự chuyển ngay lập tức sang tab "Yêu cầu đã gửi"
    setActiveTab('HOME');
    setMainTab(1);
    setCurrentPage(1);

    // Hiển thị banner thành công ở đầu tab "Yêu cầu"
    setSuccessBanner({
      id: assignedId,
      shd: cleanShd,
      task: taskLabel,
    });

    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextHistory));
    } catch {}

    // Kích hoạt kiểm tra trạng thái sau 1.5 giây
    setTimeout(() => {
      reloadAllStatuses(false);
    }, 1500);
  };

  // Nếu người dùng chọn mở giao diện WebView đồng bộ
  if (activeTab === 'WEBVIEW') {
    return (
      <View style={styles.flexOne}>
        <View style={styles.webviewHeader}>
          <TouchableOpacity
            style={styles.backHeaderBtn}
            onPress={() => setActiveTab('HOME')}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            <Text style={styles.backHeaderText}>Quay lại App Native</Text>
          </TouchableOpacity>
          <Text style={styles.webviewHeaderTitle} numberOfLines={1}>
            Cổng Web Đồng Bộ
          </Text>
        </View>
        <PortalWebView autoLoginEmail={profile.email} autoLoginPassword={password} />
      </View>
    );
  }

  // Nếu người dùng chọn mở Bộ Công Cụ Mạng (NetTools: Ping, Traceroute, Nslookup)
  if (activeTab === 'NET_TOOLS') {
    return (
      <View style={styles.flexOne}>
        <NetToolsView onBack={() => setActiveTab('HOME')} />
      </View>
    );
  }

  const filteredStaff = staffList
    .filter(
      (s) =>
        s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.block.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.partner.toLowerCase().includes(staffSearch.toLowerCase())
    )
    .slice(0, 40);

  return (
    <View style={styles.container}>
      {/* Thanh Header Gradient mang thương hiệu Nextsu AI */}
      <LinearGradient
        colors={['#070F26', '#0D235A', '#1E1B5E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerBrandRow}>
            <View style={styles.miniLogoBadge}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.miniLogoImg}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.headerAppTitle}>NextSu AI</Text>
              <Text style={styles.headerAppSub}>FPT TELECOM PORTAL</Text>
            </View>
          </View>
        </View>

        {/* Thẻ chào mừng hiển thị Ảnh nhân viên (cột V) và "Xin chào, Họ và tên Nhân viên" (cột E) */}
        <View style={styles.profileCard}>
          {profile.avatar && !avatarLoadError ? (
            <Image
              source={{ uri: profile.avatar }}
              style={styles.profileAvatarImg}
              onError={() => setAvatarLoadError(true)}
            />
          ) : (
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {profile.name
                  ? profile.name.charAt(0).toUpperCase()
                  : profile.email.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <View style={styles.nameRoleRow}>
              <Text style={styles.profileName}>
                Xin chào, <Text style={styles.profileNameBold}>{profile.name || profile.email}</Text>
              </Text>
              <View
                style={[
                  styles.roleBadge,
                  profile.role === 'Admin' && styles.roleBadgeAdmin,
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    profile.role === 'Admin' && styles.roleBadgeTextAdmin,
                  ]}
                >
                  {profile.role}
                </Text>
              </View>
            </View>

            {/* Dòng Ngày/Giờ thực tế & Thời tiết (thay thế dòng email theo yêu cầu) */}
            <View style={styles.headerMetaBox}>
              <View style={styles.headerTimeRow}>
                <Ionicons name="calendar-outline" size={13} color="#38BDF8" />
                <Text style={styles.headerTimeText}>
                  {currentDateTimeStr || 'Đang cập nhật...'}
                </Text>
              </View>
              {Boolean(weatherInfo) && (
                <View style={styles.headerWeatherRow}>
                  <Text style={styles.headerWeatherText}>{weatherInfo}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ===== Nội dung theo Tab dưới ===== */}
      {mainTab === 0 && (
        <>
          {/* Nội dung chính */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'HOME' ? (
              <>
                <Text style={styles.sectionTitle}>DANH MỤC TÁC VỤ VẬN HÀNH</Text>

                <View style={styles.gridContainer}>
                  {/* 1. Bypass Công Suất */}
                  <TouchableOpacity
                    style={styles.taskCard}
                    activeOpacity={0.85}
                    onPress={() => openTaskTab('BYPASS')}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#E0F2FE' }]}>
                      <Zap size={26} color="#0284C7" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.taskCardTitle}>Bypass Công Suất</Text>
                  </TouchableOpacity>

                  {/* 2. Bypass NT Mỹ Bảo */}
                  <TouchableOpacity
                    style={styles.taskCard}
                    activeOpacity={0.85}
                    onPress={() => openTaskTab('MYBAE')}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#F3E8FF' }]}>
                      <Camera size={26} color="#7C3AED" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.taskCardTitle}>Bypass NT Mỹ Bảo</Text>
                    <Text style={styles.taskCardDesc}>
                      Hệ thống tự đóng KTV chọn trường sẵn
                    </Text>
                  </TouchableOpacity>

                  {/* 3. Phân Công Tay */}
                  <TouchableOpacity
                    style={styles.taskCard}
                    activeOpacity={0.85}
                    onPress={() => openTaskTab('MANUAL')}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#DCFCE7' }]}>
                      <Users size={26} color="#16A34A" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.taskCardTitle}>Phân Công Tay</Text>
                  </TouchableOpacity>

                  {/* 4. Tối Ưu Kênh Truyền */}
                  <TouchableOpacity
                    style={styles.taskCard}
                    activeOpacity={0.85}
                    onPress={() => openTaskTab('SPAM')}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#FFE4E6' }]}>
                      <Rocket size={26} color="#E11D48" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.taskCardTitle}>Tối Ưu Kênh Truyền</Text>
                    <Text style={styles.taskCardDesc}>
                      Pool / Bypass IPNAT / Deactive IP
                    </Text>
                  </TouchableOpacity>

                  {/* 5. Reset MAC */}
                  <TouchableOpacity
                    style={styles.taskCard}
                    activeOpacity={0.85}
                    onPress={() => openTaskTab('RESETMAC')}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#E0E7FF' }]}>
                      <RefreshCw size={26} color="#4F46E5" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.taskCardTitle}>Reset MAC</Text>
                  </TouchableOpacity>

                  {/* 6. Thu Hồi Port (Bình thường cho mọi nhân viên) */}
                  <TouchableOpacity
                    style={styles.taskCard}
                    activeOpacity={0.85}
                    onPress={() => openTaskTab('RECALL_PORT')}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#FEF3C7' }]}>
                      <Network size={26} color="#D97706" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.taskCardTitle}>Thu Hồi Port</Text>
                  </TouchableOpacity>

                  {/* 7. OSP (Quyền Admin có logo Admin nhỏ góc trên card) */}
                  <TouchableOpacity
                    style={styles.taskCard}
                    activeOpacity={0.85}
                    onPress={() => openTaskTab('OSP')}
                  >
                    <View style={styles.adminCardBadge}>
                      <ShieldCheck size={11} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.adminCardBadgeText}>Admin</Text>
                    </View>
                    <View style={[styles.taskIconBox, { backgroundColor: '#FEE2E2' }]}>
                      <Cpu size={26} color="#DC2626" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.taskCardTitle}>OSP</Text>
                  </TouchableOpacity>

                  {/* 8. Tra Cứu 360 */}
                  <TouchableOpacity
                    style={styles.taskCard}
                    activeOpacity={0.85}
                    onPress={() => openTaskTab('SEARCH_360')}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#CCFBF1' }]}>
                      <Search size={26} color="#0F766E" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.taskCardTitle}>Tra Cứu 360</Text>
                    <Text style={styles.taskCardDesc}>
                      TSTC / Hợp đồng
                    </Text>
                  </TouchableOpacity>

                  {/* 9. Đo Mạng NetTools (Ping, Traceroute, Nslookup) */}
                  <TouchableOpacity
                    style={styles.taskCard}
                    activeOpacity={0.85}
                    onPress={() => openTaskTab('NET_TOOLS')}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#EFF6FF' }]}>
                      <Activity size={26} color="#0072FF" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.taskCardTitle}>Kiểm Tra Mạng</Text>
                    <Text style={styles.taskCardDesc}>
                      Ping / Trace / DNS
                    </Text>
                  </TouchableOpacity>
                </View>


              </>
            ) : (
              /* FORM CHI TIẾT TỪNG TÁC VỤ */
              <View style={styles.taskFormCard}>
                <TouchableOpacity
                  style={styles.backToGridBtn}
                  onPress={() => setActiveTab('HOME')}
                >
                  <Ionicons name="arrow-back" size={18} color="#0072FF" />
                  <Text style={styles.backToGridText}>Quay lại danh mục tác vụ</Text>
                </TouchableOpacity>

                <Text style={styles.formHeaderTitle}>
                  {activeTab === 'BYPASS' && 'Yêu cầu Bypass Công Suất'}
                  {activeTab === 'CLEAR' && 'Yêu cầu Clear Cls có SR'}
                  {activeTab === 'MYBAE' && 'Yêu cầu Bypass NT Mỹ Bảo'}
                  {activeTab === 'MANUAL' && 'Yêu cầu Phân Công Tay'}
                  {activeTab === 'SPAM' && 'Yêu cầu Tối Ưu Kênh Truyền'}
                  {activeTab === 'RESETMAC' && 'Yêu cầu Reset MAC'}
                  {activeTab === 'RECALL_PORT' && 'Yêu cầu Thu Hồi Port'}
                  {activeTab === 'OSP' && 'Tác vụ OSP (Quyền Admin)'}
                  {activeTab === 'SEARCH_360' && 'Tra Cứu 360 (TSTC / Hợp Đồng)'}
                </Text>

                {/* Ô nhập Số Hợp Đồng (SHD) / Port / TSTC */}
                <Text style={styles.fieldLabel}>
                  {activeTab === 'SEARCH_360'
                    ? search360Type === 'TSTC'
                      ? 'MÃ TSTC *'
                      : 'SỐ HỢP ĐỒNG (SHD) *'
                    : activeTab === 'RECALL_PORT'
                    ? 'SỐ HỢP ĐỒNG / SỐ PORT *'
                    : activeTab === 'OSP'
                    ? 'MÃ OSP / SỐ HỢP ĐỒNG *'
                    : 'SỐ HỢP ĐỒNG (SHD) *'}
                </Text>
                <TextInput
                  style={styles.textInputField}
                  placeholder={
                    activeTab === 'SEARCH_360'
                      ? search360Type === 'TSTC'
                        ? 'Nhập mã TSTC...'
                        : 'Nhập mã hợp đồng (VD: SGH123456)...'
                      : activeTab === 'RECALL_PORT'
                      ? 'Nhập mã HĐ hoặc số Port cần thu hồi...'
                      : activeTab === 'OSP'
                      ? 'Nhập mã OSP hoặc số HĐ...'
                      : 'Nhập mã hợp đồng (VD: SGH123456)...'
                  }
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  value={shd}
                  onChangeText={setShd}
                />

                {/* Lựa chọn cho BYPASS */}
                {activeTab === 'BYPASS' && (
                  <>
                    <Text style={styles.fieldLabel}>NGUYÊN NHÂN 1 (MẶC ĐỊNH)</Text>
                    <View style={styles.readonlyBox}>
                      <Text style={styles.readonlyText}>Bo Gong</Text>
                    </View>

                    <Text style={styles.fieldLabel}>CHỌN NGUYÊN NHÂN 2 *</Text>
                    {CONFIG.BYPASS_CAUSE2_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.radioOption,
                          selectedCause === opt && styles.radioOptionSelected,
                        ]}
                        onPress={() => setSelectedCause(opt)}
                      >
                        <Ionicons
                          name={
                            selectedCause === opt
                              ? 'radio-button-on'
                              : 'radio-button-off'
                          }
                          size={20}
                          color={selectedCause === opt ? '#0072FF' : '#94A3B8'}
                        />
                        <Text style={styles.radioOptionText}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Lựa chọn cho CLEAR CLS */}
                {activeTab === 'CLEAR' && (
                  <>
                    <Text style={styles.fieldLabel}>CHỌN NGUYÊN NHÂN 1 *</Text>
                    {CONFIG.CLEAR_CAUSE1_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.radioOption,
                          selectedCause === opt && styles.radioOptionSelected,
                        ]}
                        onPress={() => setSelectedCause(opt)}
                      >
                        <Ionicons
                          name={
                            selectedCause === opt
                              ? 'radio-button-on'
                              : 'radio-button-off'
                          }
                          size={20}
                          color={selectedCause === opt ? '#0072FF' : '#94A3B8'}
                        />
                        <Text style={styles.radioOptionText}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Lựa chọn cho BYPASS MYBAE (Có chụp ảnh / chọn ảnh) */}
                {activeTab === 'MYBAE' && (
                  <>
                    <Text style={styles.fieldLabel}>CHỌN NGUYÊN NHÂN 1 *</Text>
                    {CONFIG.MYBAE_CAUSE1_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.radioOption,
                          selectedCause === opt && styles.radioOptionSelected,
                        ]}
                        onPress={() => setSelectedCause(opt)}
                      >
                        <Ionicons
                          name={
                            selectedCause === opt
                              ? 'radio-button-on'
                              : 'radio-button-off'
                          }
                          size={20}
                          color={selectedCause === opt ? '#0072FF' : '#94A3B8'}
                        />
                        <Text style={styles.radioOptionText}>{opt}</Text>
                      </TouchableOpacity>
                    ))}

                    <Text style={styles.fieldLabel}>HÌNH ẢNH MINH CHỨNG *</Text>
                    <View style={styles.imageActionRow}>
                      <TouchableOpacity
                        style={styles.imagePickBtn}
                        onPress={() => handlePickImage(true)}
                      >
                        <Ionicons name="camera" size={20} color="#0072FF" />
                        <Text style={styles.imagePickBtnText}>Chụp ảnh</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.imagePickBtn}
                        onPress={() => handlePickImage(false)}
                      >
                        <Ionicons name="images" size={20} color="#6C3CE9" />
                        <Text style={[styles.imagePickBtnText, { color: '#6C3CE9' }]}>
                          Thư viện
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {attachedImageUri && (
                      <View style={styles.previewImageContainer}>
                        <Image
                          source={{ uri: attachedImageUri }}
                          style={styles.previewImage}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.removeImgBtn}
                          onPress={() => {
                            setAttachedImageUri(null);
                            setAttachedImageBase64(null);
                          }}
                        >
                          <Ionicons name="close-circle" size={24} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                {/* Lựa chọn cho PHÂN CÔNG TAY */}
                {activeTab === 'MANUAL' && (
                  <>
                    <Text style={styles.fieldLabel}>LOẠI TÁC VỤ *</Text>
                    <View style={styles.segmentRow}>
                      {CONFIG.MANUAL_TYPE_OPTIONS.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.segmentBtn,
                            manualType === t && styles.segmentBtnActive,
                          ]}
                          onPress={() => setManualType(t)}
                        >
                          <Text
                            style={[
                              styles.segmentBtnText,
                              manualType === t && styles.segmentBtnTextActive,
                            ]}
                          >
                            {t}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>NHÂN VIÊN ĐẾN (ACTIVE) *</Text>
                    <TouchableOpacity
                      style={styles.staffPickerTrigger}
                      onPress={() => setShowStaffModal(true)}
                    >
                      <Ionicons name="person-outline" size={20} color="#0072FF" />
                      <Text style={styles.staffPickerTriggerText}>
                        {selectedStaff
                          ? `${selectedStaff.name} (${selectedStaff.block})`
                          : 'Chạm để tìm và chọn nhân sự đến...'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#64748B" />
                    </TouchableOpacity>

                    {selectedStaff && (
                      <View style={styles.autoFilledBox}>
                        <Text style={styles.autoFilledText}>
                          • Đối tác đến: {selectedStaff.partner}
                        </Text>
                        <Text style={styles.autoFilledText}>
                          • Block đến: {selectedStaff.block}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {/* Lựa chọn cho TỐI ƯU KÊNH TRUYỀN */}
                {activeTab === 'SPAM' && (
                  <>
                    <Text style={styles.fieldLabel}>MỤC YÊU CẦU TỐI ƯU *</Text>
                    <View style={styles.segmentRow}>
                      {CONFIG.OPTIMIZE_TARGET_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.segmentBtn,
                            optimizeChannelType === opt.id && styles.segmentBtnActive,
                          ]}
                          onPress={() =>
                            setOptimizeChannelType(
                              opt.id as 'POOL' | 'BYPASS_IPNAT' | 'DEACTIVE_IP'
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.segmentBtnText,
                              optimizeChannelType === opt.id &&
                                styles.segmentBtnTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>CHỌN NGUYÊN NHÂN *</Text>
                    {CONFIG.OPTIMIZE_CAUSE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.radioOption,
                          selectedCause === opt && styles.radioOptionSelected,
                        ]}
                        onPress={() => setSelectedCause(opt)}
                      >
                        <Ionicons
                          name={
                            selectedCause === opt
                              ? 'radio-button-on'
                              : 'radio-button-off'
                          }
                          size={20}
                          color={selectedCause === opt ? '#0072FF' : '#94A3B8'}
                        />
                        <Text style={styles.radioOptionText}>{opt}</Text>
                      </TouchableOpacity>
                    ))}

                    {selectedCause === 'Khác' && (
                      <>
                        <Text style={styles.fieldLabel}>
                          NỘI DUNG NGUYÊN NHÂN KHÁC (BẮT BUỘC KHÔNG DẤU) *
                        </Text>
                        <TextInput
                          style={[
                            styles.textInputField,
                            hasVietnameseDiacritics(otherCauseText) && {
                              borderColor: '#EF4444',
                              backgroundColor: '#FEF2F2',
                            },
                          ]}
                          placeholder="Nhap nguyen nhan khong dau..."
                          placeholderTextColor="#94A3B8"
                          value={otherCauseText}
                          onChangeText={setOtherCauseText}
                        />
                        {hasVietnameseDiacritics(otherCauseText) && (
                          <View style={styles.diacriticWarningBox}>
                            <Ionicons
                              name="alert-circle"
                              size={16}
                              color="#DC2626"
                              style={{ marginRight: 6 }}
                            />
                            <Text style={styles.diacriticWarningText}>
                              Phát hiện ký tự có dấu! Vui lòng xóa dấu tiếng Việt (ví dụ: "mat ket noi", "load cham").
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Lựa chọn cho THU HỒI PORT (Bình thường) */}
                {activeTab === 'RECALL_PORT' && (
                  <>
                    <Text style={styles.fieldLabel}>LÝ DO / GHI CHÚ THU HỒI PORT</Text>
                    <TextInput
                      style={styles.textInputField}
                      placeholder="Nhập lý do thu hồi hoặc số Port chi tiết..."
                      placeholderTextColor="#94A3B8"
                      value={otherCauseText}
                      onChangeText={setOtherCauseText}
                    />
                  </>
                )}

                {/* Lựa chọn cho OSP (Dành riêng cho Admin) */}
                {activeTab === 'OSP' && (
                  <>
                    <Text style={styles.fieldLabel}>THAO TÁC OSP (ADMIN) *</Text>
                    <View style={styles.segmentRow}>
                      {(['Điều chuyển OSP', 'Khởi tạo OSP', 'Hủy OSP'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.segmentBtn,
                            ospActionType === t && styles.segmentBtnActive,
                          ]}
                          onPress={() => setOspActionType(t)}
                        >
                          <Text
                            style={[
                              styles.segmentBtnText,
                              ospActionType === t && styles.segmentBtnTextActive,
                            ]}
                          >
                            {t}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>GHI CHÚ / THÔNG TIN BỔ SUNG</Text>
                    <TextInput
                      style={styles.textInputField}
                      placeholder="Nhập thông tin tủ, splitter hoặc lưu ý OSP..."
                      placeholderTextColor="#94A3B8"
                      value={otherCauseText}
                      onChangeText={setOtherCauseText}
                    />
                  </>
                )}

                {/* Giao diện TRA CỨU 360 */}
                {activeTab === 'SEARCH_360' && (
                  <>
                    <Text style={styles.fieldLabel}>LOẠI TRA CỨU *</Text>
                    <View style={styles.segmentRow}>
                      {(['Hợp đồng', 'TSTC'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.segmentBtn,
                            search360Type === t && styles.segmentBtnActive,
                          ]}
                          onPress={() => {
                            setSearch360Type(t);
                            setSearch360Result(null);
                          }}
                        >
                          <Text
                            style={[
                              styles.segmentBtnText,
                              search360Type === t && styles.segmentBtnTextActive,
                            ]}
                          >
                            {t}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.88}
                      disabled={searching360}
                      onPress={handleSearch360}
                      style={[styles.submitTaskBtn, { marginTop: 14 }]}
                    >
                      <LinearGradient
                        colors={['#0D9488', '#0F766E', '#115E59']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.submitTaskGradient}
                      >
                        {searching360 ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="search" size={19} color="#FFF" />
                            <Text style={styles.submitTaskBtnText}>Tra cứu thông tin 360</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {search360Result && (
                      <View style={styles.searchResultBox}>
                        <View style={styles.searchResultHeader}>
                          <Ionicons name="information-circle" size={20} color="#0F766E" />
                          <Text style={styles.searchResultTitle}>
                            Kết quả tra cứu {search360Result.type}: {search360Result.code}
                          </Text>
                        </View>
                        <View style={styles.searchResultRow}>
                          <Text style={styles.searchResultLabel}>Trạng thái: </Text>
                          <Text style={styles.searchResultValueSuccess}>{search360Result.status}</Text>
                        </View>
                        <View style={styles.searchResultRow}>
                          <Text style={styles.searchResultLabel}>Hạ tầng / Port: </Text>
                          <Text style={styles.searchResultValue}>{search360Result.port}</Text>
                        </View>
                        <View style={styles.searchResultRow}>
                          <Text style={styles.searchResultLabel}>Khách hàng / Vị trí: </Text>
                          <Text style={styles.searchResultValue}>{search360Result.customer}</Text>
                        </View>
                        <View style={styles.searchResultRow}>
                          <Text style={styles.searchResultLabel}>Thời gian tra cứu: </Text>
                          <Text style={styles.searchResultValue}>{search360Result.time}</Text>
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* Nút Gửi Yêu Cầu (Ẩn đối với màn hình tra cứu 360) */}
                {activeTab !== 'SEARCH_360' && (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    disabled={submitting}
                    onPress={handleSubmitTask}
                    style={styles.submitTaskBtn}
                  >
                    <LinearGradient
                      colors={['#00C6FF', '#0072FF', '#6C3CE9']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitTaskGradient}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="paper-plane-outline" size={19} color="#FFF" />
                          <Text style={styles.submitTaskBtnText}>Gửi yêu cầu xử lý</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </>
      )}

      {mainTab === 1 && (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner thông báo kết quả gửi yêu cầu thành công */}
          {successBanner && (
            <View style={styles.successBannerCard}>
              <View style={styles.successBannerIconWrap}>
                <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
              </View>
              <View style={styles.successBannerContent}>
                <Text style={styles.successBannerTitle}>Đã gửi yêu cầu thành công!</Text>
                <Text style={styles.successBannerText}>
                  {successBanner.task} • SHD: {successBanner.shd} (#{successBanner.id})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSuccessBanner(null)}
                style={styles.successBannerClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="#15803D" />
              </TouchableOpacity>
            </View>
          )}

          {/* Lịch sử yêu cầu đã gửi (tự động cập nhật trực tiếp từ Sheet) */}
          <View style={styles.historyHeaderRow}>
            <Text style={styles.sectionTitle}>
              YÊU CẦU ĐÃ GỬI ({filteredAndSortedHistory.length})
            </Text>
            <View style={styles.historyHeaderActions}>
              <TouchableOpacity
                style={styles.refreshHistoryBtn}
                onPress={() => reloadAllStatuses(true)}
                disabled={isRefreshingStatus}
                activeOpacity={0.7}
              >
                {isRefreshingStatus ? (
                  <ActivityIndicator size="small" color="#0072FF" />
                ) : (
                  <Ionicons name="refresh" size={14} color="#0072FF" />
                )}
                <Text style={styles.refreshHistoryBtnText}>
                  {isRefreshingStatus ? 'Đang kiểm tra...' : 'Làm mới'}
                </Text>
              </TouchableOpacity>

              {history.length > 0 && (
                <TouchableOpacity
                  style={styles.clearHistoryBtn}
                  onPress={() => setShowClearModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={styles.clearHistoryBtnText}>Xóa tất cả</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Thanh tìm kiếm yêu cầu */}
          <View style={styles.searchBarBox}>
            <Ionicons name="search" size={17} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo SHD, Mã #ID, Tác vụ, Trạng thái..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setCurrentPage(1);
              }}
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                style={styles.clearSearchBtn}
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Thanh bộ lọc ngày */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.filterScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                dateFilter === 'all' && styles.filterChipActive,
              ]}
              onPress={() => {
                setDateFilter('all');
                setCurrentPage(1);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  dateFilter === 'all' && styles.filterChipTextActive,
                ]}
              >
                Tất cả ({history.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                dateFilter === 'today' && styles.filterChipActive,
              ]}
              onPress={() => {
                setDateFilter('today');
                setCurrentPage(1);
              }}
            >
              <Ionicons
                name="today-outline"
                size={13}
                color={dateFilter === 'today' ? '#FFFFFF' : '#475569'}
              />
              <Text
                style={[
                  styles.filterChipText,
                  dateFilter === 'today' && styles.filterChipTextActive,
                ]}
              >
                Hôm nay
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                dateFilter === 'yesterday' && styles.filterChipActive,
              ]}
              onPress={() => {
                setDateFilter('yesterday');
                setCurrentPage(1);
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color={dateFilter === 'yesterday' ? '#FFFFFF' : '#475569'}
              />
              <Text
                style={[
                  styles.filterChipText,
                  dateFilter === 'yesterday' && styles.filterChipTextActive,
                ]}
              >
                Hôm qua
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                dateFilter === 'week' && styles.filterChipActive,
              ]}
              onPress={() => {
                setDateFilter('week');
                setCurrentPage(1);
              }}
            >
              <Ionicons
                name="time-outline"
                size={13}
                color={dateFilter === 'week' ? '#FFFFFF' : '#475569'}
              />
              <Text
                style={[
                  styles.filterChipText,
                  dateFilter === 'week' && styles.filterChipTextActive,
                ]}
              >
                7 ngày qua
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {paginatedHistory.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Ionicons name="search-outline" size={32} color="#94A3B8" />
              <Text style={styles.emptyHistoryTitle}>
                {searchQuery || dateFilter !== 'all'
                  ? 'Không tìm thấy yêu cầu phù hợp'
                  : 'Chưa có yêu cầu nào'}
              </Text>
              <Text style={styles.emptyHistoryText}>
                {searchQuery || dateFilter !== 'all'
                  ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc ngày khác.'
                  : 'Các yêu cầu nghiệp vụ bạn gửi sẽ được lưu và cập nhật tiến độ tự động tại đây.'}
              </Text>
              {(searchQuery || dateFilter !== 'all') && (
                <TouchableOpacity
                  style={styles.resetFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setDateFilter('all');
                    setCurrentPage(1);
                  }}
                >
                  <Text style={styles.resetFilterBtnText}>Đặt lại bộ lọc</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {paginatedHistory.map((item, idx) => {
                const badge = getStatusBadgeConfig(item);
                return (
                  <View key={`${item.id}_${idx}`} style={styles.historyCard}>
                    {/* Hàng 1: Tên tác vụ + SHD trên cột trái, Badge trạng thái gọn gàng trên cột phải */}
                    <View style={styles.historyCardHeader}>
                      <View style={styles.historyCardTitleCol}>
                        <Text style={styles.historyTaskTitle} numberOfLines={2}>
                          {item.taskName} • #{item.id}
                        </Text>
                        <Text style={styles.historyShdBadge}>SHD: {item.shd}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.historyStatusBadge,
                          {
                            backgroundColor: badge.bg,
                            borderColor: badge.border,
                          },
                        ]}
                        onPress={() => reloadAllStatuses(true)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={badge.icon} size={13} color={badge.text} />
                        <Text
                          style={[
                            styles.historyStatusText,
                            { color: badge.text },
                          ]}
                          numberOfLines={1}
                        >
                          {badge.label}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Hàng 2: Thời gian gửi và nút xóa nhanh thẻ */}
                    <View style={styles.historyMetaRow}>
                      <Text style={styles.historyTimeText}>
                        🕒 Gửi lúc: {item.createdAt}
                        {item.updatedAt ? ` • Cập nhật: ${item.updatedAt}` : ''}
                      </Text>
                      <TouchableOpacity
                        style={styles.cardTrashBtn}
                        onPress={() => setItemToDelete({ id: item.id, shd: item.shd })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={15} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {/* Hàng 3: Hộp thông báo chi tiết (nếu có thông báo lỗi / giải thích) - Chiếm 100% bề ngang, không bao giờ bị bóp chữ */}
                    {Boolean(badge.detail) && (
                      <View
                        style={[
                          styles.historyAlertBox,
                          {
                            backgroundColor: badge.bg,
                            borderColor: badge.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={badge.icon}
                          size={16}
                          color={badge.text}
                          style={{ marginTop: 2 }}
                        />
                        <Text style={[styles.historyAlertText, { color: badge.text }]}>
                          {badge.detail}
                        </Text>
                      </View>
                    )}

                    {/* Hàng 4: Ghi chú phản hồi từ Sheet */}
                    {Boolean(item.note) && item.note !== badge.detail && (
                      <View style={styles.historyNoteBox}>
                        <Ionicons
                          name="information-circle-outline"
                          size={15}
                          color="#0284C7"
                          style={{ marginTop: 1 }}
                        />
                        <Text style={styles.historyNoteText}>
                          {item.note}
                        </Text>
                      </View>
                    )}

                    {/* Hàng 5: Nút Xóa thẻ riêng đối với các thẻ bị lỗi hoặc chưa vào Sheet */}
                    {badge.isFail && (
                      <View style={styles.failActionRow}>
                        <TouchableOpacity
                          style={styles.deleteCardActionBtn}
                          onPress={() => handleDeleteSingleItem(item.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          <Text style={styles.deleteCardActionText}>Xóa thẻ này</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Thanh điều khiển phân trang */}
              {totalPages > 1 && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[
                      styles.pageNavBtn,
                      validCurrentPage === 1 && styles.pageNavBtnDisabled,
                    ]}
                    onPress={() => {
                      if (validCurrentPage > 1) {
                        setCurrentPage(validCurrentPage - 1);
                      }
                    }}
                    disabled={validCurrentPage === 1}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={validCurrentPage === 1 ? '#94A3B8' : '#0072FF'}
                    />
                    <Text
                      style={[
                        styles.pageNavBtnText,
                        validCurrentPage === 1 && styles.pageNavBtnTextDisabled,
                      ]}
                    >
                      Trước
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.pageCenterBox}>
                    <Text style={styles.pageIndicatorText}>
                      Trang <Text style={styles.pageIndicatorBold}>{validCurrentPage}</Text> / {totalPages}
                    </Text>
                    <Text style={styles.pageTotalItemsText}>
                      ({filteredAndSortedHistory.length} kết quả • Mới nhất trang 1)
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.pageNavBtn,
                      validCurrentPage === totalPages && styles.pageNavBtnDisabled,
                    ]}
                    onPress={() => {
                      if (validCurrentPage < totalPages) {
                        setCurrentPage(validCurrentPage + 1);
                      }
                    }}
                    disabled={validCurrentPage === totalPages}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pageNavBtnText,
                        validCurrentPage === totalPages && styles.pageNavBtnTextDisabled,
                      ]}
                    >
                      Sau
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={validCurrentPage === totalPages ? '#94A3B8' : '#0072FF'}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {mainTab === 2 && (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScheduleView profile={profile} />
        </ScrollView>
      )}

      {mainTab === 3 && (
        <UserProfileView
          token={token}
          profile={profile}
          onLogout={onLogout}
          onChangePassword={() => {
            setOldPassInput('');
            setNewPassInput('');
            setConfirmPassInput('');
            setShowChangePassModal(true);
          }}
        />
      )}

      {/* ===== Thanh Tab dưới (Material Design) ===== */}
      <BottomNavigation.Bar
        navigationState={{
          index: mainTab,
          routes: [
            { key: 'work', title: 'Công việc', focusedIcon: 'briefcase', unfocusedIcon: 'briefcase-outline' },
            {
              key: 'requests',
              title: 'Yêu cầu',
              focusedIcon: 'clipboard-text-clock',
              unfocusedIcon: 'clipboard-text-clock-outline',
              badge: history.filter((h) => h.pending).length || undefined,
            },
            { key: 'schedule', title: 'Lịch trực', focusedIcon: 'calendar-month', unfocusedIcon: 'calendar-month-outline' },
            { key: 'user', title: 'User', focusedIcon: 'account-circle', unfocusedIcon: 'account-circle-outline' },
          ],
        }}
        renderIcon={({ route, focused, color }) => {
          if (route.key === 'work') {
            return <Briefcase size={22} color={color} strokeWidth={focused ? 2.5 : 2} />;
          } else if (route.key === 'requests') {
            return <FileCheck size={22} color={color} strokeWidth={focused ? 2.5 : 2} />;
          } else if (route.key === 'schedule') {
            return <Calendar size={22} color={color} strokeWidth={focused ? 2.5 : 2} />;
          } else if (route.key === 'user') {
            return <User size={22} color={color} strokeWidth={focused ? 2.5 : 2} />;
          }
          return <Briefcase size={22} color={color} strokeWidth={2} />;
        }}
        onTabPress={({ route }) => {
          const idx = ['work', 'requests', 'schedule', 'user'].indexOf(route.key);
          if (idx === 0 && mainTab === 0) setActiveTab('HOME');
          setMainTab(idx);
          if (idx === 1) reloadAllStatuses(true);
        }}
        activeColor="#0072FF"
        inactiveColor="#64748B"
        style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' }}
      />

      {/* Modal tìm chọn Nhân viên cho Phân Công Tay */}
      <Modal visible={showStaffModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn Nhân viên đến</Text>
              <TouchableOpacity onPress={() => setShowStaffModal(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Tìm theo mã Inside, Block hoặc Đối tác..."
              placeholderTextColor="#94A3B8"
              value={staffSearch}
              onChangeText={setStaffSearch}
            />
            <ScrollView style={{ maxHeight: 360 }}>
              {filteredStaff.map((st, idx) => (
                <TouchableOpacity
                  key={`${st.name}_${idx}`}
                  style={styles.staffItemRow}
                  onPress={() => {
                    setSelectedStaff(st);
                    setShowStaffModal(false);
                  }}
                >
                  <Text style={styles.staffItemName}>{st.name}</Text>
                  <Text style={styles.staffItemSub}>
                    {st.partner} • {st.block}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Đổi mật khẩu */}
      <Modal visible={showChangePassModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
              <TouchableOpacity onPress={() => setShowChangePassModal(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Mật khẩu hiện tại</Text>
            <TextInput
              style={styles.textInputField}
              placeholder="Nhập mật khẩu cũ..."
              placeholderTextColor="#94A3B8"
              secureTextEntry
              autoCapitalize="none"
              value={oldPassInput}
              onChangeText={setOldPassInput}
            />

            <Text style={styles.fieldLabel}>Mật khẩu mới</Text>
            <TextInput
              style={styles.textInputField}
              placeholder="Tối thiểu 6 ký tự..."
              placeholderTextColor="#94A3B8"
              secureTextEntry
              autoCapitalize="none"
              value={newPassInput}
              onChangeText={setNewPassInput}
            />

            <Text style={styles.fieldLabel}>Xác nhận mật khẩu mới</Text>
            <TextInput
              style={styles.textInputField}
              placeholder="Nhập lại mật khẩu mới..."
              placeholderTextColor="#94A3B8"
              secureTextEntry
              autoCapitalize="none"
              value={confirmPassInput}
              onChangeText={setConfirmPassInput}
            />

            <TouchableOpacity
              activeOpacity={0.88}
              disabled={changingPass}
              onPress={async () => {
                setChangingPass(true);
                const res = await changeEmployeePassword(
                  profile.email,
                  oldPassInput,
                  newPassInput,
                  confirmPassInput
                );
                setChangingPass(false);
                if (!res.ok) {
                  Alert.alert('Lỗi', res.msg || 'Không thể đổi mật khẩu.');
                  return;
                }
                setShowChangePassModal(false);
                Alert.alert(
                  'Thành công',
                  'Mật khẩu của bạn đã được cập nhật thành công lên hệ thống!'
                );
              }}
              style={styles.submitTaskBtn}
            >
              <LinearGradient
                colors={['#00C6FF', '#0072FF', '#6C3CE9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitTaskGradient}
              >
                {changingPass ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitTaskBtnText}>
                    Lưu mật khẩu mới
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal xác nhận Xóa toàn bộ lịch sử */}
      <Modal
        visible={showClearModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowClearModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.confirmDialogCard}>
            <View style={styles.confirmIconCircle}>
              <Ionicons name="trash" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmDialogTitle}>Xóa toàn bộ lịch sử?</Text>
            <Text style={styles.confirmDialogMessage}>
              Tất cả {history.length} yêu cầu hiển thị trên máy này sẽ được xóa khỏi bộ nhớ thiết bị.{'\n\n'}
              Dữ liệu đã gửi thành công lên Google Sheet vẫn được bảo toàn đầy đủ.
            </Text>
            <View style={styles.confirmActionRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowClearModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={handleClearAllHistory}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteBtnText}>Xóa tất cả</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal xác nhận Xóa 1 thẻ yêu cầu */}
      <Modal
        visible={Boolean(itemToDelete)}
        animationType="fade"
        transparent
        onRequestClose={() => setItemToDelete(null)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.confirmDialogCard}>
            <View style={[styles.confirmIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="trash-outline" size={26} color="#DC2626" />
            </View>
            <Text style={styles.confirmDialogTitle}>Xóa thẻ yêu cầu này?</Text>
            <Text style={styles.confirmDialogMessage}>
              Bạn có chắc chắn muốn xóa yêu cầu #{itemToDelete?.id} (SHD: {itemToDelete?.shd}) khỏi danh sách hiển thị trên máy không?
            </Text>
            <View style={styles.confirmActionRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setItemToDelete(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() => {
                  if (itemToDelete) {
                    handleDeleteSingleItem(itemToDelete.id);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteBtnText}>Xóa thẻ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7FE',
  },
  headerGradient: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniLogoBadge: {
    width: 44,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLogoImg: {
    width: '100%',
    height: '100%',
  },
  headerAppTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerAppSub: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changePassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  changePassBtnText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  logoutBtnText: {
    color: '#FFE4E6',
    fontSize: 12.5,
    fontWeight: '700',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00C6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#00C6FF',
    backgroundColor: '#1E293B',
    marginRight: 12,
  },
  profileAvatarText: {
    color: '#070F26',
    fontSize: 20,
    fontWeight: '900',
  },
  profileInfo: {
    flex: 1,
  },
  nameRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  profileName: {
    color: '#E0F2FE',
    fontSize: 15,
    fontWeight: '600',
  },
  profileNameBold: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  roleBadge: {
    backgroundColor: '#00C6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeAdmin: {
    backgroundColor: '#F59E0B',
  },
  roleBadgeText: {
    color: '#070F26',
    fontSize: 10.5,
    fontWeight: '800',
  },
  roleBadgeTextAdmin: {
    color: '#FFFFFF',
  },
  headerMetaBox: {
    marginTop: 5,
    gap: 3,
  },
  headerTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerTimeText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '600',
  },
  headerWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  headerWeatherText: {
    color: '#BAE6FD',
    fontSize: 11.5,
    fontWeight: '700',
  },
  profileMeta: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  profileMetaSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: 18,
    paddingBottom: 36,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  taskCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    minHeight: 112,
    justifyContent: 'flex-start',
    position: 'relative',
  },
  adminCardBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  adminCardBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  taskIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  taskCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  taskCardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  searchResultBox: {
    marginTop: 18,
    padding: 14,
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  searchResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F766E',
  },
  searchResultRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  searchResultLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    minWidth: 120,
  },
  searchResultValue: {
    fontSize: 13,
    color: '#0F172A',
    flex: 1,
  },
  searchResultValueSuccess: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '700',
    flex: 1,
  },
  webPortalBanner: {
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 4,
  },
  webPortalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  webPortalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  webPortalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  webPortalSub: {
    color: '#E0F2FE',
    fontSize: 11.5,
    marginTop: 2,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  historyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  refreshHistoryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0072FF',
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  clearHistoryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  emptyHistoryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    marginTop: 10,
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  emptyHistoryText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Banner thông báo kết quả gửi thành công
  successBannerCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successBannerIconWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBannerContent: {
    flex: 1,
  },
  successBannerTitle: {
    color: '#065F46',
    fontSize: 13.5,
    fontWeight: '700',
  },
  successBannerText: {
    color: '#047857',
    fontSize: 12,
    marginTop: 2,
  },
  successBannerClose: {
    padding: 4,
  },
  // Card yêu cầu đã gửi (được bố trí theo khối cột dọc, không bị co ép chữ ngang)
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyCardTitleCol: {
    flex: 1,
    marginRight: 6,
  },
  historyTaskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 19,
  },
  historyShdBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0072FF',
    marginTop: 3,
  },
  historyStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    maxWidth: 150,
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyTimeText: {
    fontSize: 11.5,
    color: '#94A3B8',
    flex: 1,
  },
  cardTrashBtn: {
    padding: 4,
    marginLeft: 8,
  },
  historyAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    gap: 7,
  },
  historyAlertText: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
  historyNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
    gap: 6,
  },
  historyNoteText: {
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 17,
    flex: 1,
  },
  failActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 6,
  },
  deleteCardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  deleteCardActionText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  // Thanh tìm kiếm
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '600',
    height: '100%',
  },
  clearSearchBtn: {
    padding: 4,
  },
  // Bộ lọc ngày
  filterScrollView: {
    marginBottom: 14,
    maxHeight: 38,
  },
  filterScrollContent: {
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: '#0072FF',
    borderColor: '#0072FF',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resetFilterBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 10,
  },
  resetFilterBtnText: {
    color: '#0072FF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Phân trang
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    gap: 4,
  },
  pageNavBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  pageNavBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0072FF',
  },
  pageNavBtnTextDisabled: {
    color: '#94A3B8',
  },
  pageCenterBox: {
    alignItems: 'center',
  },
  pageIndicatorText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  pageIndicatorBold: {
    color: '#0072FF',
    fontWeight: '800',
  },
  pageTotalItemsText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  taskFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backToGridBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  backToGridText: {
    color: '#0072FF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  formHeaderTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
    marginBottom: 8,
  },
  textInputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  readonlyBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    justifyContent: 'center',
  },
  readonlyText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  radioOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0072FF',
  },
  radioOptionText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    flex: 1,
  },
  imageActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imagePickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  imagePickBtnText: {
    color: '#0072FF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewImageContainer: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    height: 180,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImgBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  segmentBtnActive: {
    backgroundColor: '#0072FF',
    borderColor: '#0072FF',
  },
  segmentBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  staffPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  staffPickerTriggerText: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  autoFilledBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 4,
  },
  autoFilledText: {
    fontSize: 13,
    color: '#0369A1',
    fontWeight: '600',
  },
  targetSheetHintBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  targetSheetHintText: {
    fontSize: 13,
    color: '#0369A1',
  },
  targetSheetHintBold: {
    fontWeight: '700',
    color: '#0284C7',
  },
  diacriticWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  diacriticWarningText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
    fontWeight: '500',
  },
  submitTaskBtn: {
    marginTop: 22,
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitTaskGradient: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitTaskBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
  },
  webviewHeader: {
    height: 52,
    backgroundColor: '#070F26',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  backHeaderText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  webviewHeaderTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSearchInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  staffItemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  staffItemName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffItemSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmDialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  confirmIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmDialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmDialogMessage: {
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  confirmActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  confirmCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmDeleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
