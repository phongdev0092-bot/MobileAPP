import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CONFIG } from '../config';
import {
  callAppsScriptJsonApi,
  changeEmployeePassword,
  EmployeeProfile,
  fetchActiveStaffList,
  StaffOption,
} from '../services/sheetAuthService';
import { ScheduleView } from './ScheduleView';
import { PortalWebView } from './PortalWebView';

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
  | 'WEBVIEW';

interface TrackedRequest {
  id: string;
  taskName: string;
  shd: string;
  status: string;
  note?: string;
  pending: boolean;
  createdAt: string;
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
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [history, setHistory] = useState<TrackedRequest[]>([]);

  // Form states dùng chung
  const [shd, setShd] = useState<string>('');
  const [selectedCause, setSelectedCause] = useState<string>('');
  const [otherCauseText, setOtherCauseText] = useState<string>('');
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
  }, [activeTab]);

  // Chọn tab tác vụ và khởi tạo giá trị mặc định
  const openTaskTab = (tab: ActiveTab) => {
    setShd('');
    setOtherCauseText('');
    setAttachedImageBase64(null);
    setAttachedImageUri(null);
    if (tab === 'BYPASS') setSelectedCause(CONFIG.BYPASS_CAUSE2_OPTIONS[0]);
    if (tab === 'CLEAR') setSelectedCause(CONFIG.CLEAR_CAUSE1_OPTIONS[0]);
    if (tab === 'MYBAE') setSelectedCause(CONFIG.MYBAE_CAUSE1_OPTIONS[0]);
    if (tab === 'SPAM') setSelectedCause(CONFIG.SPAM_CAUSE_OPTIONS[0]);
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
        'Vui lòng chụp ảnh hoặc chọn ảnh minh chứng trước khi gửi Bypass MyBAE.'
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

    if (
      activeTab === 'SPAM' &&
      selectedCause === 'Khác' &&
      otherCauseText.trim().length < 3
    ) {
      Alert.alert(
        'Thiếu nội dung',
        'Vui lòng nhập mô tả nguyên nhân khác (tối thiểu 3 ký tự).'
      );
      return;
    }

    setSubmitting(true);

    let payload: Record<string, any> = { token, email: profile.email };
    let taskLabel = '';

    switch (activeTab) {
      case 'BYPASS':
        taskLabel = 'Bypass (Bo Gong)';
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
        taskLabel = 'Bypass MyBAE';
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
      case 'SPAM':
        taskLabel = 'SpamPool Ưu Tiên';
        payload = {
          ...payload,
          action: 'spamSubmit',
          shd: cleanShd,
          cause: selectedCause,
          other: otherCauseText.trim(),
        };
        break;
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

    if (res && res.ok === false) {
      Alert.alert('Thông báo', res.msg || 'Yêu cầu không thành công.');
      return;
    }

    const newReq: TrackedRequest = {
      id: String(res?.id || Math.floor(1000 + Math.random() * 9000)),
      taskName: taskLabel,
      shd: cleanShd,
      status: res?.resumed ? 'Đang theo dõi tiếp' : 'Chưa cập nhật (Đang xử lý)',
      pending: true,
      createdAt: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    setHistory((prev) => [newReq, ...prev]);
    setShd('');
    setAttachedImageBase64(null);
    setAttachedImageUri(null);

    Alert.alert(
      'Đã gửi yêu cầu thành công',
      `Tác vụ: ${taskLabel}\nSố HĐ: ${cleanShd}\nMã theo dõi: #${newReq.id}`,
      [{ text: 'Đóng', onPress: () => setActiveTab('HOME') }]
    );
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

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.changePassBtn}
              onPress={() => {
                setOldPassInput('');
                setNewPassInput('');
                setConfirmPassInput('');
                setShowChangePassModal(true);
              }}
            >
              <Ionicons name="key-outline" size={16} color="#E0F2FE" />
              <Text style={styles.changePassBtnText}>Đổi MK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                Alert.alert(
                  'Đăng xuất',
                  'Bạn có chắc chắn muốn đăng xuất tài khoản?',
                  [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Đăng xuất', style: 'destructive', onPress: onLogout },
                  ]
                );
              }}
            >
              <Ionicons name="log-out-outline" size={18} color="#FFE4E6" />
              <Text style={styles.logoutBtnText}>Thoát</Text>
            </TouchableOpacity>
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
              <Text style={styles.profileName} numberOfLines={1}>
                Xin chào, {profile.name || profile.email}
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
            <Text style={styles.profileMeta} numberOfLines={1}>
              {profile.email}
            </Text>
          </View>
        </View>
      </LinearGradient>

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
              <TouchableOpacity
                style={styles.taskCard}
                activeOpacity={0.85}
                onPress={() => openTaskTab('SCHEDULE')}
              >
                <View style={[styles.taskIconBox, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="calendar-outline" size={24} color="#2563EB" />
                </View>
                <Text style={styles.taskCardTitle}>Lịch Trực / Off</Text>
                <Text style={styles.taskCardDesc}>
                  Tra cứu & đăng ký ngày CA1 / OFF theo Block
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.taskCard}
                activeOpacity={0.85}
                onPress={() => openTaskTab('BYPASS')}
              >
                <View style={[styles.taskIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="flash-outline" size={24} color="#0284C7" />
                </View>
                <Text style={styles.taskCardTitle}>Bypass</Text>
                <Text style={styles.taskCardDesc}>
                  Bỏ gông hạ tầng đối tác & dây âm tường
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.taskCard}
                activeOpacity={0.85}
                onPress={() => openTaskTab('MYBAE')}
              >
                <View style={[styles.taskIconBox, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="camera-outline" size={24} color="#7C3AED" />
                </View>
                <Text style={styles.taskCardTitle}>Bypass MyBAE</Text>
                <Text style={styles.taskCardDesc}>
                  Đính kèm ảnh minh chứng hệ thống Mỹ Bảo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.taskCard}
                activeOpacity={0.85}
                onPress={() => openTaskTab('MANUAL')}
              >
                <View style={[styles.taskIconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="people-outline" size={24} color="#16A34A" />
                </View>
                <Text style={styles.taskCardTitle}>Phân Công Tay</Text>
                <Text style={styles.taskCardDesc}>
                  Phân công Triển khai / Bảo trì theo NS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.taskCard}
                activeOpacity={0.85}
                onPress={() => openTaskTab('SPAM')}
              >
                <View style={[styles.taskIconBox, { backgroundColor: '#FFE4E6' }]}>
                  <Ionicons name="rocket-outline" size={24} color="#E11D48" />
                </View>
                <Text style={styles.taskCardTitle}>SpamPool Ưu Tiên</Text>
                <Text style={styles.taskCardDesc}>
                  Chuyển luồng mạng ưu tiên quốc tế/VPN
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.taskCard}
                activeOpacity={0.85}
                onPress={() => openTaskTab('RESETMAC')}
              >
                <View style={[styles.taskIconBox, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="refresh-circle-outline" size={24} color="#4F46E5" />
                </View>
                <Text style={styles.taskCardTitle}>Reset MAC</Text>
                <Text style={styles.taskCardDesc}>
                  Gửi yêu cầu xóa/cập nhật địa chỉ MAC
                </Text>
              </TouchableOpacity>
            </View>

            {/* Lịch sử yêu cầu vừa gửi */}
            <Text style={[styles.sectionTitle, { marginTop: 22 }]}>
              YÊU CẦU VỪA GỬI TRONG PHIÊN ({history.length})
            </Text>
            {history.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <Ionicons name="time-outline" size={28} color="#94A3B8" />
                <Text style={styles.emptyHistoryText}>
                  Chưa có yêu cầu nào được gửi trong phiên làm việc này.
                </Text>
              </View>
            ) : (
              history.map((item, idx) => (
                <View key={`${item.id}_${idx}`} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyTask}>
                      {item.taskName} • #{item.id}
                    </Text>
                    <Text style={styles.historyShd}>SHD: {item.shd}</Text>
                    <Text style={styles.historyTime}>Lúc {item.createdAt}</Text>
                  </View>
                  <View style={styles.historyStatusBadge}>
                    <Text style={styles.historyStatusText}>{item.status}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        ) : activeTab === 'SCHEDULE' ? (
          <ScheduleView
            profile={profile}
            onBack={() => setActiveTab('HOME')}
          />
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
              {activeTab === 'BYPASS' && 'Yêu cầu Bypass (Bo Gong)'}
              {activeTab === 'CLEAR' && 'Yêu cầu Clear Cls có SR'}
              {activeTab === 'MYBAE' && 'Yêu cầu Bypass MyBAE (Mỹ Bảo)'}
              {activeTab === 'MANUAL' && 'Yêu cầu Phân Công Tay'}
              {activeTab === 'SPAM' && 'Yêu cầu SpamPool Ưu Tiên'}
              {activeTab === 'RESETMAC' && 'Yêu cầu Reset MAC'}
            </Text>

            {/* Ô nhập Số Hợp Đồng (SHD) */}
            <Text style={styles.fieldLabel}>SỐ HỢP ĐỒNG (SHD) *</Text>
            <TextInput
              style={styles.textInputField}
              placeholder="Nhập mã hợp đồng (VD: SGH123456)..."
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

            {/* Lựa chọn cho SPAMPOOL */}
            {activeTab === 'SPAM' && (
              <>
                <Text style={styles.fieldLabel}>CHỌN NGUYÊN NHÂN *</Text>
                {CONFIG.SPAM_CAUSE_OPTIONS.map((opt) => (
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
                      NỘI DUNG NGUYÊN NHÂN KHÁC (3 - 200 KÝ TỰ) *
                    </Text>
                    <TextInput
                      style={styles.textInputField}
                      placeholder="Nhập chi tiết nguyên nhân..."
                      placeholderTextColor="#94A3B8"
                      value={otherCauseText}
                      onChangeText={setOtherCauseText}
                    />
                  </>
                )}
              </>
            )}

            {/* Nút Gửi Yêu Cầu */}
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
          </View>
        )}
      </ScrollView>

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
    gap: 8,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    flexShrink: 1,
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
  emptyHistoryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emptyHistoryText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyLeft: {
    flex: 1,
  },
  historyTask: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyShd: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0072FF',
    marginTop: 2,
  },
  historyTime: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  historyStatusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  historyStatusText: {
    color: '#B45309',
    fontSize: 11.5,
    fontWeight: '700',
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
});
