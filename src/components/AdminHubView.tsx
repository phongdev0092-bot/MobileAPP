import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
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
import {
  Ionicons,
  Users,
  ShieldCheck,
  Zap,
  Cpu,
  Search,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  User,
  CheckCircle2,
  AlertCircle,
  X,
} from './AppIcon';
import { CONFIG } from '../config';
import { AdminUserItem } from '../services/sheetAuthService';
import { Alert } from '../utils/alert';

interface AdminHubViewProps {
  token: string;
  currentUserEmail: string;
  adminUsers: AdminUserItem[];
  loadingAdminUsers: boolean;
  onRefreshUsers: () => void;
  onSaveUser: (data: {
    row?: number;
    email: string;
    name?: string;
    code?: string;
    title?: string;
    partner?: string;
    block?: string;
    phone?: string;
    inside?: string;
    role?: 'Admin' | 'User';
    password?: string;
  }) => Promise<{ ok: boolean; msg: string; row?: number }>;
  onDeleteUser: (email: string, row?: number) => Promise<{ ok: boolean; msg: string }>;
  shd: string;
  setShd: (s: string) => void;
  ospActionType: string;
  setOspActionType: (t: string) => void;
  otherCauseText: string;
  setOtherCauseText: (t: string) => void;
  selectedCause: string;
  setSelectedCause: (c: string) => void;
  onSubmitOsp: () => void;
  onSubmitClearCls: () => void;
  submitting: boolean;
}

export const AdminHubView: React.FC<AdminHubViewProps> = ({
  token,
  currentUserEmail,
  adminUsers,
  loadingAdminUsers,
  onRefreshUsers,
  onSaveUser,
  onDeleteUser,
  shd,
  setShd,
  ospActionType,
  setOspActionType,
  otherCauseText,
  setOtherCauseText,
  selectedCause,
  setSelectedCause,
  onSubmitOsp,
  onSubmitClearCls,
  submitting,
}) => {
  const [adminSubTab, setAdminSubTab] = useState<'USER_MGMT' | 'OSP' | 'CLEAR_CLS'>('USER_MGMT');

  // Search & Filter state for User Management
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'HAS_PASS' | 'ADMIN' | 'USER'>('ALL');
  const [showPassMap, setShowPassMap] = useState<Record<string, boolean>>({});

  // Edit Modal State
  const [userToEdit, setUserToEdit] = useState<AdminUserItem | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editCode, setEditCode] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editPartner, setEditPartner] = useState<string>('');
  const [editBlock, setEditBlock] = useState<string>('');
  const [editInside, setEditInside] = useState<string>('');
  const [editRole, setEditRole] = useState<'Admin' | 'User'>('User');
  const [editPassword, setEditPassword] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newCode, setNewCode] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newPartner, setNewPartner] = useState<string>('TIN');
  const [newBlock, setNewBlock] = useState<string>('');
  const [newInside, setNewInside] = useState<string>('');
  const [newRole, setNewRole] = useState<'Admin' | 'User'>('User');
  const [newPassword, setNewPassword] = useState<string>('123456');
  const [addingNew, setAddingNew] = useState<boolean>(false);

  // Delete Confirm Modal State
  const [userToDelete, setUserToDelete] = useState<AdminUserItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Filtered User List
  const filteredUsers = useMemo(() => {
    let list = [...adminUsers];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.code.toLowerCase().includes(q) ||
          u.block.toLowerCase().includes(q) ||
          u.partner.toLowerCase().includes(q) ||
          u.phone.includes(q)
      );
    }
    if (roleFilter === 'HAS_PASS') {
      list = list.filter((u) => u.hasPassword);
    } else if (roleFilter === 'ADMIN') {
      list = list.filter((u) => u.role === 'Admin');
    } else if (roleFilter === 'USER') {
      list = list.filter((u) => u.role === 'User');
    }
    return list;
  }, [adminUsers, searchQuery, roleFilter]);

  // Statistics
  const totalCount = adminUsers.length;
  const withPassCount = useMemo(() => adminUsers.filter((u) => u.hasPassword).length, [adminUsers]);
  const adminCount = useMemo(() => adminUsers.filter((u) => u.role === 'Admin').length, [adminUsers]);

  // Handle Edit Click
  const handleOpenEdit = (user: AdminUserItem) => {
    setUserToEdit(user);
    setEditName(user.name);
    setEditCode(user.code);
    setEditPhone(user.phone);
    setEditPartner(user.partner);
    setEditBlock(user.block);
    setEditInside(user.inside);
    setEditRole(user.role);
    setEditPassword('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!userToEdit) return;
    if (!editName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Họ và Tên nhân viên.');
      return;
    }
    setSavingEdit(true);
    const res = await onSaveUser({
      row: userToEdit.row,
      email: userToEdit.email,
      name: editName.trim(),
      code: editCode.trim(),
      phone: editPhone.trim(),
      partner: editPartner.trim(),
      block: editBlock.trim(),
      inside: editInside.trim(),
      role: editRole,
      password: editPassword.trim() || undefined,
    });
    setSavingEdit(false);
    if (res.ok) {
      Alert.alert('Thành công', res.msg || 'Cập nhật nhân sự thành công!');
      setShowEditModal(false);
      onRefreshUsers();
    } else {
      Alert.alert('Lỗi lưu nhân sự', res.msg || 'Không thể lưu thông tin.');
    }
  };

  // Handle Add Click
  const handleOpenAdd = () => {
    setNewName('');
    setNewEmail('');
    setNewCode('');
    setNewPhone('');
    setNewPartner('TIN');
    setNewBlock('');
    setNewInside('');
    setNewRole('User');
    setNewPassword('123456');
    setShowAddModal(true);
  };

  const handleSaveAdd = async () => {
    const cleanMail = newEmail.trim().toLowerCase();
    if (!cleanMail || !cleanMail.includes('@')) {
      Alert.alert('Email không hợp lệ', 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (!newName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Họ và Tên nhân sự.');
      return;
    }
    setAddingNew(true);
    const res = await onSaveUser({
      email: cleanMail,
      name: newName.trim(),
      code: newCode.trim(),
      phone: newPhone.trim(),
      partner: newPartner.trim(),
      block: newBlock.trim(),
      inside: newInside.trim(),
      role: newRole,
      password: newPassword.trim() || '123456',
    });
    setAddingNew(false);
    if (res.ok) {
      Alert.alert('Thành công', res.msg || 'Thêm nhân sự mới thành công!');
      setShowAddModal(false);
      onRefreshUsers();
    } else {
      Alert.alert('Lỗi thêm nhân sự', res.msg || 'Không thể thêm nhân sự mới.');
    }
  };

  // Handle Delete Click
  const handleOpenDelete = (user: AdminUserItem) => {
    if (user.isDefaultAdmin || user.email === CONFIG.DEFAULT_ADMIN_EMAIL) {
      Alert.alert('Bảo vệ tài khoản', 'Không thể xóa tài khoản Quản trị viên mặc định hệ thống!');
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    const res = await onDeleteUser(userToDelete.email, userToDelete.row);
    setDeleting(false);
    setUserToDelete(null);
    if (res.ok) {
      Alert.alert('Thành công', res.msg || 'Đã xóa tài khoản nhân sự.');
      onRefreshUsers();
    } else {
      Alert.alert('Lỗi xóa nhân sự', res.msg || 'Không thể xóa tài khoản.');
    }
  };

  const toggleShowPass = (email: string) => {
    setShowPassMap((prev) => ({
      ...prev,
      [email]: !prev[email],
    }));
  };

  return (
    <View style={styles.container}>
      {/* 3 Sub-tabs Navigation */}
      <View style={styles.tabNavRow}>
        <TouchableOpacity
          style={[
            styles.tabNavBtn,
            adminSubTab === 'USER_MGMT' && styles.tabNavBtnActive,
          ]}
          onPress={() => setAdminSubTab('USER_MGMT')}
          activeOpacity={0.8}
        >
          <Users size={16} color={adminSubTab === 'USER_MGMT' ? '#DC2626' : '#64748B'} />
          <Text
            style={[
              styles.tabNavText,
              adminSubTab === 'USER_MGMT' && styles.tabNavTextActive,
            ]}
          >
            Quản Lý User
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabNavBtn,
            adminSubTab === 'OSP' && styles.tabNavBtnActive,
          ]}
          onPress={() => setAdminSubTab('OSP')}
          activeOpacity={0.8}
        >
          <Cpu size={16} color={adminSubTab === 'OSP' ? '#DC2626' : '#64748B'} />
          <Text
            style={[
              styles.tabNavText,
              adminSubTab === 'OSP' && styles.tabNavTextActive,
            ]}
          >
            Tác Vụ OSP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabNavBtn,
            adminSubTab === 'CLEAR_CLS' && styles.tabNavBtnActive,
          ]}
          onPress={() => setAdminSubTab('CLEAR_CLS')}
          activeOpacity={0.8}
        >
          <Zap size={16} color={adminSubTab === 'CLEAR_CLS' ? '#DC2626' : '#64748B'} />
          <Text
            style={[
              styles.tabNavText,
              adminSubTab === 'CLEAR_CLS' && styles.tabNavTextActive,
            ]}
          >
            Clear Cls
          </Text>
        </TouchableOpacity>
      </View>

      {/* ===================== SUBTAB 1: QUẢN LÝ USER ===================== */}
      {adminSubTab === 'USER_MGMT' && (
        <View style={styles.sectionWrap}>
          {/* Header Action Bar */}
          <View style={styles.actionBar}>
            <View>
              <Text style={styles.actionTitle}>TÀI KHOẢN ĐÃ ĐĂNG KÝ</Text>
              <Text style={styles.actionSubtitle}>
                {totalCount} nhân sự • {withPassCount} có mật khẩu • {adminCount} Admin
              </Text>
            </View>
            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={onRefreshUsers}
                disabled={loadingAdminUsers}
              >
                {loadingAdminUsers ? (
                  <ActivityIndicator size="small" color="#0284C7" />
                ) : (
                  <RefreshCw size={16} color="#0284C7" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addUserBtn}
                onPress={handleOpenAdd}
                activeOpacity={0.85}
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.addUserBtnText}>Thêm User</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <Search size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo Tên, Email, MSNV, Block..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Chips */}
          <View style={styles.filterChipRow}>
            {(
              [
                { id: 'ALL', label: `Tất cả (${totalCount})` },
                { id: 'HAS_PASS', label: `Có mật khẩu (${withPassCount})` },
                { id: 'ADMIN', label: `Admin (${adminCount})` },
                { id: 'USER', label: `User (${totalCount - adminCount})` },
              ] as const
            ).map((chip) => (
              <TouchableOpacity
                key={chip.id}
                style={[
                  styles.filterChip,
                  roleFilter === chip.id && styles.filterChipActive,
                ]}
                onPress={() => setRoleFilter(chip.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    roleFilter === chip.id && styles.filterChipTextActive,
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* User List */}
          {loadingAdminUsers && adminUsers.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#0072FF" />
              <Text style={styles.loadingText}>Đang tải dữ liệu nhân sự từ Sheet...</Text>
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Users size={36} color="#CBD5E1" />
              <Text style={styles.emptyText}>Không tìm thấy tài khoản nhân sự phù hợp.</Text>
            </View>
          ) : (
            <View style={styles.userList}>
              {filteredUsers.map((item) => {
                const isViewingPass = !!showPassMap[item.email];
                return (
                  <View key={`${item.email}_${item.row}`} style={styles.userCard}>
                    {/* User Info Header */}
                    <View style={styles.userCardHeader}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {(item.name || item.email).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.userHeaderInfo}>
                        <View style={styles.userNameRow}>
                          <Text style={styles.userNameText} numberOfLines={1}>
                            {item.name || '(Chưa có tên)'}
                          </Text>
                          <View
                            style={[
                              styles.roleBadge,
                              item.role === 'Admin'
                                ? styles.roleBadgeAdmin
                                : styles.roleBadgeUser,
                            ]}
                          >
                            <ShieldCheck
                              size={11}
                              color={item.role === 'Admin' ? '#DC2626' : '#0284C7'}
                              strokeWidth={2.5}
                            />
                            <Text
                              style={[
                                styles.roleBadgeText,
                                item.role === 'Admin'
                                  ? styles.roleBadgeTextAdmin
                                  : styles.roleBadgeTextUser,
                              ]}
                            >
                              {item.role}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.userEmailText}>{item.email}</Text>
                      </View>
                    </View>

                    {/* Metadata Tags */}
                    <View style={styles.userMetaRow}>
                      {item.code ? (
                        <View style={styles.metaTag}>
                          <Text style={styles.metaTagText}>MSNV: {item.code}</Text>
                        </View>
                      ) : null}
                      {item.partner ? (
                        <View style={styles.metaTag}>
                          <Text style={styles.metaTagText}>{item.partner}</Text>
                        </View>
                      ) : null}
                      {item.block ? (
                        <View style={styles.metaTag}>
                          <Text style={styles.metaTagText}>Block {item.block}</Text>
                        </View>
                      ) : null}
                      {item.phone ? (
                        <View style={styles.metaTag}>
                          <Text style={styles.metaTagText}>SĐT: {item.phone}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Password Status & Preview */}
                    <View style={styles.passRow}>
                      <View style={styles.passStatusLeft}>
                        <View
                          style={[
                            styles.passIndicatorDot,
                            { backgroundColor: item.hasPassword ? '#10B981' : '#94A3B8' },
                          ]}
                        />
                        <Text style={styles.passStatusText}>
                          {item.hasPassword
                            ? 'Mật khẩu: Đã tạo trên Sheet (Cột H)'
                            : 'Mật khẩu: Chưa khởi tạo'}
                        </Text>
                      </View>
                      {item.hasPassword && item.storedPass ? (
                        <TouchableOpacity
                          style={styles.togglePassBtn}
                          onPress={() => toggleShowPass(item.email)}
                        >
                          {isViewingPass ? (
                            <EyeOff size={14} color="#64748B" />
                          ) : (
                            <Eye size={14} color="#64748B" />
                          )}
                          <Text style={styles.togglePassBtnText}>
                            {isViewingPass ? 'Ẩn' : 'Xem'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {isViewingPass && item.storedPass ? (
                      <View style={styles.passBox}>
                        <Text style={styles.passBoxLabel}>Chuỗi lưu trên Sheet:</Text>
                        <Text style={styles.passBoxValue} selectable>
                          {item.storedPass}
                        </Text>
                      </View>
                    ) : null}

                    {/* Action Buttons Row */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => handleOpenEdit(item)}
                        activeOpacity={0.8}
                      >
                        <Pencil size={14} color="#0284C7" />
                        <Text style={styles.editBtnText}>Chỉnh sửa</Text>
                      </TouchableOpacity>

                      {!item.isDefaultAdmin && item.email !== CONFIG.DEFAULT_ADMIN_EMAIL && (
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleOpenDelete(item)}
                          activeOpacity={0.8}
                        >
                          <Trash2 size={14} color="#EF4444" />
                          <Text style={styles.deleteBtnText}>Xóa</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ===================== SUBTAB 2: TÁC VỤ OSP ===================== */}
      {adminSubTab === 'OSP' && (
        <View style={styles.sectionWrap}>
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

          <Text style={styles.fieldLabel}>MÃ OSP / SỐ HỢP ĐỒNG (SHD) *</Text>
          <TextInput
            style={styles.textInputField}
            placeholder="Nhập mã OSP hoặc Số HĐ (VD: SGH123456)..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            value={shd}
            onChangeText={(text) => setShd(text.toUpperCase())}
          />

          <Text style={styles.fieldLabel}>GHI CHÚ / THÔNG TIN BỔ SUNG</Text>
          <TextInput
            style={styles.textInputField}
            placeholder="Nhập thông tin tủ, splitter hoặc lưu ý OSP..."
            placeholderTextColor="#94A3B8"
            value={otherCauseText}
            onChangeText={setOtherCauseText}
          />

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={submitting}
            onPress={onSubmitOsp}
            style={[styles.submitTaskBtn, { marginTop: 16 }]}
          >
            <LinearGradient
              colors={['#DC2626', '#B91C1C', '#991B1B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitTaskGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Cpu size={19} color="#FFF" />
                  <Text style={styles.submitTaskBtnText}>Thực hiện tác vụ OSP</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ===================== SUBTAB 3: CLEAR CLS CÓ SR ===================== */}
      {adminSubTab === 'CLEAR_CLS' && (
        <View style={styles.sectionWrap}>
          <Text style={styles.fieldLabel}>SỐ HỢP ĐỒNG (SHD) CẦN CLEAR CLS *</Text>
          <TextInput
            style={styles.textInputField}
            placeholder="Nhập mã hợp đồng (VD: SGH123456)..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            value={shd}
            onChangeText={(text) => setShd(text.toUpperCase())}
          />

          <Text style={styles.fieldLabel}>NGUYÊN NHÂN CLEAR CLS *</Text>
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

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={submitting}
            onPress={onSubmitClearCls}
            style={[styles.submitTaskBtn, { marginTop: 16 }]}
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
                  <Zap size={19} color="#FFF" />
                  <Text style={styles.submitTaskBtnText}>Gửi yêu cầu Clear Cls</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ===================== MODAL SỬA USER ===================== */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chỉnh Sửa Nhân Sự</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalFieldLabel}>Email (Cố định theo Sheet)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: '#F1F5F9', color: '#64748B' }]}
                value={userToEdit?.email || ''}
                editable={false}
              />

              <Text style={styles.modalFieldLabel}>Họ và Tên NV *</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nhập họ và tên..."
              />

              <View style={styles.modalRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalFieldLabel}>Mã NV</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCode}
                    onChangeText={setEditCode}
                    placeholder="VD: 01234567"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>Số điện thoại</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="VD: 0987654321"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.modalRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalFieldLabel}>Đối tác</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editPartner}
                    onChangeText={setEditPartner}
                    placeholder="VD: TIN, FPT..."
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>Block</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editBlock}
                    onChangeText={setEditBlock}
                    placeholder="VD: B1, B2..."
                  />
                </View>
              </View>

              <Text style={styles.modalFieldLabel}>Inside Account</Text>
              <TextInput
                style={styles.modalInput}
                value={editInside}
                onChangeText={setEditInside}
                placeholder="Account Inside FPT..."
              />

              <Text style={styles.modalFieldLabel}>Phân quyền (Role) *</Text>
              <View style={styles.roleSelectRow}>
                <TouchableOpacity
                  style={[
                    styles.roleSelectBtn,
                    editRole === 'User' && styles.roleSelectBtnActiveUser,
                  ]}
                  onPress={() => setEditRole('User')}
                  disabled={userToEdit?.isDefaultAdmin}
                >
                  <Text
                    style={[
                      styles.roleSelectText,
                      editRole === 'User' && styles.roleSelectTextActive,
                    ]}
                  >
                    User (Kỹ thuật viên)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleSelectBtn,
                    editRole === 'Admin' && styles.roleSelectBtnActiveAdmin,
                  ]}
                  onPress={() => setEditRole('Admin')}
                >
                  <Text
                    style={[
                      styles.roleSelectText,
                      editRole === 'Admin' && styles.roleSelectTextActive,
                    ]}
                  >
                    Admin (Quản trị viên)
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalFieldLabel}>Đặt lại Mật khẩu (Để trống nếu giữ nguyên)</Text>
              <TextInput
                style={styles.modalInput}
                value={editPassword}
                onChangeText={setEditPassword}
                placeholder="Nhập mật khẩu mới..."
                secureTextEntry
              />
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Lưu Thay Đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================== MODAL THÊM USER MỚI ===================== */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm Nhân Sự Mới Vào Sheet</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalFieldLabel}>Email đăng nhập *</Text>
              <TextInput
                style={styles.modalInput}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="VD: nhanvien@fpt.net..."
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.modalFieldLabel}>Họ và Tên NV *</Text>
              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Nhập họ và tên..."
              />

              <View style={styles.modalRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalFieldLabel}>Mã NV</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newCode}
                    onChangeText={setNewCode}
                    placeholder="VD: 01234567"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>Số điện thoại</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="VD: 0987654321"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.modalRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalFieldLabel}>Đối tác</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newPartner}
                    onChangeText={setNewPartner}
                    placeholder="VD: TIN, FPT..."
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>Block</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newBlock}
                    onChangeText={setNewBlock}
                    placeholder="VD: B1, B2..."
                  />
                </View>
              </View>

              <Text style={styles.modalFieldLabel}>Inside Account</Text>
              <TextInput
                style={styles.modalInput}
                value={newInside}
                onChangeText={setNewInside}
                placeholder="Account Inside FPT..."
              />

              <Text style={styles.modalFieldLabel}>Phân quyền Role *</Text>
              <View style={styles.roleSelectRow}>
                <TouchableOpacity
                  style={[
                    styles.roleSelectBtn,
                    newRole === 'User' && styles.roleSelectBtnActiveUser,
                  ]}
                  onPress={() => setNewRole('User')}
                >
                  <Text
                    style={[
                      styles.roleSelectText,
                      newRole === 'User' && styles.roleSelectTextActive,
                    ]}
                  >
                    User
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleSelectBtn,
                    newRole === 'Admin' && styles.roleSelectBtnActiveAdmin,
                  ]}
                  onPress={() => setNewRole('Admin')}
                >
                  <Text
                    style={[
                      styles.roleSelectText,
                      newRole === 'Admin' && styles.roleSelectTextActive,
                    ]}
                  >
                    Admin
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalFieldLabel}>Mật khẩu ban đầu *</Text>
              <TextInput
                style={styles.modalInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Tối thiểu 6 ký tự..."
                secureTextEntry
              />
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveAdd}
                disabled={addingNew}
              >
                {addingNew ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>+ Thêm Nhân Sự</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================== MODAL XÁC NHẬN XÓA ===================== */}
      <Modal visible={!!userToDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.deleteDialogIcon}>
              <Trash2 size={26} color="#DC2626" />
            </View>
            <Text style={styles.deleteDialogTitle}>Xác nhận xóa tài khoản?</Text>
            <Text style={styles.deleteDialogDesc}>
              Bạn có chắc chắn muốn xóa nhân sự{' '}
              <Text style={{ fontWeight: '800', color: '#0F172A' }}>
                {userToDelete?.name} ({userToDelete?.email})
              </Text>{' '}
              khỏi Sheet Nhân sự? Thao tác này sẽ xóa dòng của nhân sự và không thể hoàn tác.
            </Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setUserToDelete(null)}
              >
                <Text style={styles.modalCancelBtnText}>Ở lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#EF4444' }]}
                onPress={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Xóa Vĩnh Viễn</Text>
                )}
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
    width: '100%',
  },
  tabNavRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabNavBtnActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabNavText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabNavTextActive: {
    color: '#DC2626',
  },
  sectionWrap: {
    width: '100%',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  actionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addUserBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    marginLeft: 8,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#DC2626',
    fontWeight: '800',
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 13,
    color: '#94A3B8',
  },
  userList: {
    gap: 10,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  userHeaderInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userNameText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeAdmin: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  roleBadgeUser: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  roleBadgeTextAdmin: {
    color: '#DC2626',
  },
  roleBadgeTextUser: {
    color: '#0284C7',
  },
  userEmailText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  userMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  metaTag: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  passStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  passIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  passStatusText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  togglePassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  togglePassBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  passBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  passBoxLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  passBoxValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#0F172A',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  textInputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  segmentBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#DC2626',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  radioOptionSelected: {
    borderColor: '#0072FF',
    backgroundColor: '#EFF6FF',
  },
  radioOptionText: {
    marginLeft: 10,
    fontSize: 13.5,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
  },
  submitTaskBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  submitTaskGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  submitTaskBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    color: '#0F172A',
  },
  modalRow: {
    flexDirection: 'row',
  },
  roleSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  roleSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  roleSelectBtnActiveUser: {
    borderColor: '#0284C7',
    backgroundColor: '#E0F2FE',
  },
  roleSelectBtnActiveAdmin: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  roleSelectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  roleSelectTextActive: {
    color: '#0F172A',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0072FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteDialogIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  deleteDialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  deleteDialogDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
});
