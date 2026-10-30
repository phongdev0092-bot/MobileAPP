import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  BlockScheduleData,
  checkDayConflictFromBlockData,
  EmployeeProfile,
  fetchBlockSchedule,
  fetchScheduleSuggestions,
  getDaysInMonth,
  submitScheduleRegistration,
  SuggestEmployeeItem,
} from '../services/sheetAuthService';

interface ScheduleViewProps {
  profile: EmployeeProfile;
  onBack: () => void;
}

function removeVietnameseTones(str: string): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/**
 * Giao diện Đăng Ký Lịch Trực / Off theo Block.
 * - Tự động tra cứu theo tài khoản đang đăng nhập ngay khi mở (hoặc tìm kiếm nhân sự khác).
 * - Hiển thị Thông tin nhân sự + Số nhân sự trong Block.
 * - Chọn Tháng / Năm -> Xem bảng Lịch trực / Off của toàn bộ nhân sự cùng Block (1..31).
 * - Chọn Ngày + CA1 / O (Off cả ngày) -> Kiểm tra trùng OFF trong Block -> Lưu đăng ký.
 */
export const ScheduleView: React.FC<ScheduleViewProps> = ({
  profile,
  onBack,
}) => {
  const now = new Date();
  const [searchInput, setSearchInput] = useState<string>(profile.email);
  const [suggestions, setSuggestions] = useState<SuggestEmployeeItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const [thang, setThang] = useState<string>(String(now.getMonth() + 1));
  const [nam, setNam] = useState<string>(String(now.getFullYear()));

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [blockData, setBlockData] = useState<BlockScheduleData | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());
  const [selectedValue, setSelectedValue] = useState<'CA1' | 'O'>('CA1');
  const [bypassPassword, setBypassPassword] = useState<string>('');
  const [showDayPickerModal, setShowDayPickerModal] = useState<boolean>(false);

  // Tải danh sách gợi ý tìm kiếm và tự động tra cứu lịch của nhân viên đang đăng nhập
  useEffect(() => {
    fetchScheduleSuggestions().then((ds) => setSuggestions(ds));
    handleLookup(profile.email, now.getMonth() + 1, now.getFullYear());
  }, [profile.email]);

  const handleLookup = useCallback(
    async (targetEmail?: string, targetMonth?: number, targetYear?: number) => {
      const mailToQuery = (targetEmail ?? searchInput).trim();
      const m = Number(targetMonth ?? thang) || now.getMonth() + 1;
      const y = Number(targetYear ?? nam) || now.getFullYear();

      if (!mailToQuery) {
        setErrorText('Vui lòng nhập email nhân viên.');
        return;
      }

      setErrorText(null);
      setShowSuggestions(false);
      setLoading(true);
      const data = await fetchBlockSchedule(mailToQuery, m, y);
      setLoading(false);

      if (!data.found) {
        setErrorText(
          data.message ||
            'Không tìm thấy nhân viên với email này trong danh sách Nhân Sự.'
        );
        setBlockData(null);
        return;
      }

      setBlockData(data);
      const maxD = getDaysInMonth(m, y);
      if (selectedDay > maxD) {
        setSelectedDay(maxD);
      }
    },
    [searchInput, thang, nam, selectedDay]
  );

  // Kiểm tra xung đột ngày đang chọn
  const conflictInfo = blockData
    ? checkDayConflictFromBlockData(blockData, selectedDay)
    : { coRangBuoc: false, allowO: true, nguoiDaOff: null };

  const hasConflict = Boolean(
    conflictInfo.coRangBuoc && !conflictInfo.allowO && conflictInfo.nguoiDaOff
  );

  const daysCountInMonth = getDaysInMonth(
    Number(thang) || now.getMonth() + 1,
    Number(nam) || now.getFullYear()
  );

  // Lưu đăng ký ngày CA1 / O
  const handleSaveSchedule = async () => {
    if (!blockData) return;
    const m = Number(thang) || now.getMonth() + 1;
    const y = Number(nam) || now.getFullYear();

    setSaving(true);
    const res = await submitScheduleRegistration(
      blockData.mail,
      m,
      y,
      selectedDay,
      selectedValue,
      hasConflict && selectedValue === 'O' ? bypassPassword : '',
      blockData
    );
    setSaving(false);

    if (!res.success) {
      Alert.alert('Không thể lưu', res.message);
      return;
    }

    setBypassPassword('');
    Alert.alert('Thành công', res.message);
    handleLookup(blockData.mail, m, y);
  };

  // Gợi ý tự động khi gõ tên hoặc email
  const filteredSuggestions = searchInput.trim()
    ? suggestions
        .filter((nv) => {
          const key = removeVietnameseTones(searchInput.trim());
          return (
            removeVietnameseTones(nv.mail).includes(key) ||
            removeVietnameseTones(nv.hoTen).includes(key)
          );
        })
        .slice(0, 6)
    : [];

  return (
    <View style={styles.container}>
      {/* Nút quay lại */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color="#0066FF" />
        <Text style={styles.backBtnText}>Quay lại danh mục tác vụ</Text>
      </TouchableOpacity>

      {/* Tiêu đề */}
      <Text style={styles.pageTitle}>📅 Đăng Ký Lịch Trực / Off</Text>
      <Text style={styles.pageSub}>
        Tra cứu thông tin nhân viên và đăng ký ngày CA1 / OFF trong Block của bạn.
      </Text>

      {/* KHỐI 1: TRA CỨU NHÂN VIÊN */}
      <LinearGradient
        colors={['#2563EB', '#1E40AF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.searchCard}
      >
        <Text style={styles.searchLabel}>🔎 Tra cứu nhân viên</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons
              name="search-outline"
              size={18}
              color="#64748B"
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Nhập tên hoặc email nhân viên..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              value={searchInput}
              onFocus={() => setShowSuggestions(true)}
              onChangeText={(t) => {
                setSearchInput(t);
                setShowSuggestions(true);
              }}
              onSubmitEditing={() => handleLookup()}
            />
            {searchInput.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchInput('');
                  setShowSuggestions(false);
                }}
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.lookupBtn}
            disabled={loading}
            onPress={() => handleLookup()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#1D4ED8" />
            ) : (
              <Text style={styles.lookupBtnText}>Tra cứu</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Gợi ý tự động */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <View style={styles.suggestBox}>
            {filteredSuggestions.map((item, i) => (
              <TouchableOpacity
                key={`${item.mail}_${i}`}
                style={styles.suggestItem}
                onPress={() => {
                  setSearchInput(item.mail);
                  setShowSuggestions(false);
                  handleLookup(item.mail);
                }}
              >
                <View style={styles.suggestAvatar}>
                  <Text style={styles.suggestAvatarText}>
                    {(item.hoTen || item.mail).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestName} numberOfLines={1}>
                    {item.hoTen}
                  </Text>
                  <Text style={styles.suggestMeta} numberOfLines={1}>
                    {item.mail} · {item.block}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.searchHint}>
          Gõ vài ký tự tên hoặc email để hệ thống gợi ý.
        </Text>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorText}</Text>
          </View>
        )}
      </LinearGradient>

      {/* KHỐI 2: THÔNG TIN NHÂN VIÊN & BLOCK */}
      {blockData && (
        <>
          <View style={styles.card}>
            <View style={styles.infoGrid}>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>MSNV</Text>
                <Text style={styles.infoValue}>{blockData.msnv || '-'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Họ và tên</Text>
                <Text style={styles.infoValue}>{blockData.hoTen || '-'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Block</Text>
                <Text style={styles.infoValue}>{blockData.block || '-'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Số nhân sự trong Block</Text>
                <Text style={styles.infoValue}>
                  {blockData.soLuongNhanSuTrongBlock}
                </Text>
              </View>
            </View>
          </View>

          {/* KHỐI 3: CHỌN THÁNG / NĂM */}
          <View style={styles.card}>
            <View style={styles.monthYearRow}>
              <View style={styles.monthYearCol}>
                <Text style={styles.fieldLabel}>Tháng</Text>
                <TextInput
                  style={styles.numberInput}
                  keyboardType="number-pad"
                  value={thang}
                  onChangeText={setThang}
                  maxLength={2}
                />
              </View>
              <View style={styles.monthYearCol}>
                <Text style={styles.fieldLabel}>Năm</Text>
                <TextInput
                  style={styles.numberInput}
                  keyboardType="number-pad"
                  value={nam}
                  onChangeText={setNam}
                  maxLength={4}
                />
              </View>
              <TouchableOpacity
                style={styles.viewBlockBtn}
                disabled={loading}
                onPress={() =>
                  handleLookup(blockData.mail, Number(thang), Number(nam))
                }
              >
                <Text style={styles.viewBlockBtnText}>Xem lịch Block</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* KHỐI 4: BẢNG LỊCH TRỰC / OFF CỦA BLOCK */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              Lịch trực / off của Block "{blockData.block}" (Tháng {thang}/{nam})
            </Text>

            {blockData.lichBlock.length === 0 ? (
              <View style={styles.emptyTableBox}>
                <Text style={styles.emptyTableText}>
                  Chưa có nhân sự nào trong Block "{blockData.block}" đăng ký lịch
                  tháng {thang}/{nam}. Hãy chọn ngày bên dưới và bấm Lưu để khởi tạo!
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={styles.tableScroll}
              >
                <View>
                  {/* Dòng tiêu đề bảng */}
                  <View style={styles.tableHeaderRow}>
                    <View style={[styles.cell, styles.nameColHeader]}>
                      <Text style={styles.headerCellText}>Họ và tên</Text>
                    </View>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.cell,
                          styles.dayCol,
                          selectedDay === d && styles.selectedDayHeader,
                        ]}
                        onPress={() => setSelectedDay(d)}
                      >
                        <Text
                          style={[
                            styles.headerCellText,
                            selectedDay === d && { color: '#2563EB' },
                          ]}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Các dòng nhân viên trong Block */}
                  {blockData.lichBlock.map((nv, rIdx) => (
                    <View
                      key={`${nv.mail}_${rIdx}`}
                      style={[styles.tableRow, nv.isMe && styles.tableRowMe]}
                    >
                      <View style={[styles.cell, styles.nameCol]}>
                        <Text
                          style={[
                            styles.nameCellText,
                            nv.isMe && styles.nameCellTextMe,
                          ]}
                          numberOfLines={1}
                        >
                          {nv.hoTen} {nv.isMe ? '(Bạn)' : ''}
                        </Text>
                      </View>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                        const v = nv.days[d] || '';
                        const isOff = v === 'O';
                        const isCa1 = v === 'CA1';
                        return (
                          <TouchableOpacity
                            key={d}
                            style={[
                              styles.cell,
                              styles.dayCol,
                              isOff && styles.cellOff,
                              isCa1 && styles.cellCa1,
                            ]}
                            onPress={() => setSelectedDay(d)}
                          >
                            <Text
                              style={[
                                styles.dayCellText,
                                isOff && styles.dayCellTextOff,
                                isCa1 && styles.dayCellTextCa1,
                              ]}
                            >
                              {v}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          {/* KHỐI 5: ĐĂNG KÝ NGÀY CA1 / O */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Đăng ký ngày</Text>

            <TouchableOpacity
              style={styles.daySelectorBtn}
              onPress={() => setShowDayPickerModal(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#2563EB" />
              <Text style={styles.daySelectorBtnText}>
                Ngày {selectedDay} (Tháng {thang}/{nam})
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>

            <View style={styles.radioRow}>
              <TouchableOpacity
                style={[
                  styles.radioChoice,
                  selectedValue === 'CA1' && styles.radioChoiceActiveCa1,
                ]}
                onPress={() => setSelectedValue('CA1')}
              >
                <Ionicons
                  name={
                    selectedValue === 'CA1'
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  size={20}
                  color={selectedValue === 'CA1' ? '#B45309' : '#64748B'}
                />
                <Text style={styles.radioChoiceText}>CA1</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioChoice,
                  selectedValue === 'O' && styles.radioChoiceActiveOff,
                ]}
                onPress={() => setSelectedValue('O')}
              >
                <Ionicons
                  name={
                    selectedValue === 'O'
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  size={20}
                  color={selectedValue === 'O' ? '#DC2626' : '#64748B'}
                />
                <Text style={styles.radioChoiceText}>O (Off cả ngày)</Text>
              </TouchableOpacity>
            </View>

            {/* Cảnh báo xung đột OFF trong cùng Block */}
            {hasConflict && (
              <Text style={styles.conflictNote}>
                ⚠️ Đã có nhân sự "{conflictInfo.nguoiDaOff}" đăng ký OFF ngày{' '}
                {selectedDay}. Bạn có thể chọn CA1, hoặc chọn O và nhập mật khẩu
                CBQL bên dưới để cho phép trùng OFF.
              </Text>
            )}

            {/* Khối nhập mật khẩu CBQL khi trùng ngày OFF */}
            {hasConflict && selectedValue === 'O' && (
              <View style={styles.bypassBox}>
                <Text style={styles.bypassLabel}>
                  🔐 Mật khẩu CBQL (để cho phép trùng ngày OFF)
                </Text>
                <TextInput
                  style={styles.bypassInput}
                  placeholder="Nhập mật khẩu CBQL..."
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  value={bypassPassword}
                  onChangeText={setBypassPassword}
                />
                <Text style={styles.bypassHint}>
                  Chỉ Trưởng ca / CBQL mới nên nhập mục này. Nếu không có mật
                  khẩu, vui lòng chọn CA1.
                </Text>
              </View>
            )}

            {/* Ghi chú hướng dẫn */}
            <View style={styles.guideBox}>
              <Text style={styles.guideTitle}>📌 Ghi chú:</Text>
              <Text style={styles.guideText}>
                1. Chỉ chọn <Text style={styles.bold}>O (Off cả ngày)</Text> cho
                những ngày bạn thực sự nghỉ trọn ngày. Các ngày còn lại hệ thống
                sẽ mặc định là <Text style={styles.bold}>CA1</Text>.
              </Text>
              <Text style={styles.guideText}>
                2. Nếu đã đăng ký <Text style={styles.bold}>OFF</Text> nhưng sau
                đó muốn đổi sang đi làm lại, hãy chọn{' '}
                <Text style={styles.bold}>CA1</Text> cho đúng ngày đó để cập nhật
                lại.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              disabled={saving}
              onPress={handleSaveSchedule}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Lưu đăng ký</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Modal chọn Ngày (1..soNgayTrongThang) */}
      <Modal visible={showDayPickerModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Chọn ngày trong tháng {thang}/{nam}
              </Text>
              <TouchableOpacity onPress={() => setShowDayPickerModal(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <View style={styles.daysGrid}>
              {Array.from({ length: daysCountInMonth }, (_, i) => i + 1).map(
                (d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.dayGridBtn,
                      selectedDay === d && styles.dayGridBtnActive,
                    ]}
                    onPress={() => {
                      setSelectedDay(d);
                      setShowDayPickerModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dayGridBtnText,
                        selectedDay === d && styles.dayGridBtnTextActive,
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backBtnText: {
    color: '#0066FF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  pageSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  searchCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  searchLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  lookupBtn: {
    height: 44,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupBtnText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 14,
  },
  suggestBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  suggestAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  suggestName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  suggestMeta: {
    fontSize: 11.5,
    color: '#64748B',
  },
  searchHint: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    marginTop: 8,
  },
  errorBox: {
    marginTop: 8,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 12.5,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  infoCol: {
    minWidth: '45%',
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  monthYearRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  monthYearCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  viewBlockBtn: {
    height: 42,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBlockBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
  emptyTableBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
  },
  emptyTableText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  tableScroll: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  tableRowMe: {
    backgroundColor: '#EFF6FF',
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameColHeader: {
    width: 150,
    alignItems: 'flex-start',
    paddingHorizontal: 10,
  },
  nameCol: {
    width: 150,
    alignItems: 'flex-start',
    paddingHorizontal: 10,
  },
  dayCol: {
    width: 38,
  },
  selectedDayHeader: {
    backgroundColor: '#DBEAFE',
  },
  headerCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  nameCellText: {
    fontSize: 12.5,
    color: '#1E293B',
    fontWeight: '500',
  },
  nameCellTextMe: {
    color: '#2563EB',
    fontWeight: '800',
  },
  cellOff: {
    backgroundColor: '#FEE2E2',
  },
  cellCa1: {
    backgroundColor: '#FEF3C7',
  },
  dayCellText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  dayCellTextOff: {
    color: '#991B1B',
    fontWeight: '800',
  },
  dayCellTextCa1: {
    color: '#92400E',
    fontWeight: '700',
  },
  daySelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
    marginBottom: 12,
  },
  daySelectorBtnText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  radioRow: {
    flexDirection: 'row',
    gap: 12,
  },
  radioChoice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  radioChoiceActiveCa1: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  radioChoiceActiveOff: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  radioChoiceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  conflictNote: {
    marginTop: 10,
    fontSize: 12.5,
    color: '#DC2626',
    fontWeight: '600',
    lineHeight: 18,
  },
  bypassBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
  },
  bypassLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 6,
  },
  bypassInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 14,
    color: '#0F172A',
  },
  bypassHint: {
    fontSize: 11.5,
    color: '#B45309',
    marginTop: 6,
  },
  guideBox: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  guideTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  guideText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  saveBtn: {
    marginTop: 14,
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  dayGridBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  dayGridBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  dayGridBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  dayGridBtnTextActive: {
    color: '#FFFFFF',
  },
});
