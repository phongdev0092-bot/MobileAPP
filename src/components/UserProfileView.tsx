import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppIcon, Key, LogOut, Pencil, Save, X } from './AppIcon';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Divider,
  HelperText,
  List,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import {
  callAppsScriptJsonApi,
  EmployeeProfile,
  fetchFullEmployeeProfile,
  FullEmployeeProfile,
} from '../services/sheetAuthService';

interface Props {
  token: string;
  profile: EmployeeProfile;
  onChangePassword: () => void;
  onLogout: () => void;
}

/**
 * Tab "User": hiển thị hồ sơ nhân sự.
 * - Thông tin cơ bản & đơn vị: chỉ đọc
 * - Thông tin cá nhân (CCCD, Địa chỉ, SĐT, Ngày vô công ty): cho phép chỉnh sửa và lưu về Sheet
 */
export const UserProfileView: React.FC<Props> = ({ token, profile, onChangePassword, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FullEmployeeProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState('');
  const [form, setForm] = useState({ cccd: '', address: '', phone: '', startDate: '' });

  const customKey = `@nextsu_ai_custom_profile_${profile.email.trim().toLowerCase()}`;

  const load = useCallback(async () => {
    setLoading(true);
    let loaded: FullEmployeeProfile | null = null;

    // 1. Thử gọi API từ Apps Script trước
    try {
      const res = await callAppsScriptJsonApi<any>({
        action: 'getMyProfile',
        token,
        email: profile.email,
      });
      if (res?.ok && res.profile) {
        loaded = res.profile;
      }
    } catch {}

    // 2. Tự động fallback đọc trực tiếp từ Google Sheet CSV nếu Apps Script chưa deploy bản mới
    if (!loaded) {
      try {
        loaded = await fetchFullEmployeeProfile(profile.email);
      } catch (e) {
        console.warn('Fallback fetchFullEmployeeProfile failed:', e);
      }
    }

    // 3. Kết hợp với dữ liệu đã lưu tạm trên thiết bị (nếu có)
    let localCustom: Record<string, string> = {};
    try {
      const raw = await AsyncStorage.getItem(customKey);
      if (raw) localCustom = JSON.parse(raw);
    } catch {}

    if (loaded) {
      const merged: FullEmployeeProfile = {
        ...loaded,
        cccd: localCustom.cccd || loaded.cccd || '',
        address: localCustom.address || loaded.address || '',
        phone: localCustom.phone || loaded.phone || '',
        startDate: localCustom.startDate || loaded.startDate || '',
      };
      setData(merged);
      setForm({
        cccd: merged.cccd,
        address: merged.address,
        phone: merged.phone,
        startDate: merged.startDate,
      });
    } else {
      setSnack('Không tải được hồ sơ nhân viên. Vui lòng thử lại.');
    }
    setLoading(false);
  }, [token, profile.email, customKey]);

  useEffect(() => {
    load();
  }, [load]);

  const cccdError = form.cccd !== '' && !/^\d{12}$/.test(form.cccd);
  const phoneError = form.phone !== '' && !/^0?\d{9,10}$/.test(form.phone);
  const dateError = form.startDate !== '' && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(form.startDate);

  const save = async () => {
    if (cccdError || phoneError || dateError) {
      setSnack('Vui lòng kiểm tra lại các ô báo lỗi.');
      return;
    }
    setSaving(true);

    // Luôn lưu vào AsyncStorage để máy người dùng có dữ liệu tức thì
    try {
      await AsyncStorage.setItem(customKey, JSON.stringify(form));
    } catch {}

    const res = await callAppsScriptJsonApi<any>({
      action: 'updateMyProfile',
      token,
      email: profile.email,
      data: form,
    });
    setSaving(false);

    if (res?.ok) {
      setEditing(false);
      setSnack('Đã cập nhật thông tin cá nhân lên Google Sheet.');
      load();
    } else {
      setEditing(false);
      if (res?.msg?.includes('Action không hợp lệ')) {
        setSnack('Đã lưu thông tin trên máy. Hãy cập nhật Code.gs lên Apps Script để đồng bộ vào ô trên Sheet.');
      } else {
        setSnack(res?.msg || 'Đã lưu thông tin trên thiết bị.');
      }
      load();
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Đang tải hồ sơ...</Text>
      </View>
    );
  }

  const ro = (label: string, value?: string, iconName = 'information-outline') => (
    <List.Item
      title={value || '—'}
      description={label}
      titleStyle={styles.roValue}
      descriptionStyle={styles.roLabel}
      left={() => (
        <View style={styles.roIconCircle}>
          <AppIcon name={iconName} size={18} color="#0072FF" strokeWidth={2.2} />
        </View>
      )}
    />
  );

  const avatarUri = data?.avatar || profile.avatar;
  const displayName = data?.name || profile.name;
  const isActive = String(data?.status || '').toLowerCase() === 'active';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.headerCard} mode="elevated">
          <Card.Content style={styles.headerContent}>
            {avatarUri ? (
              <Avatar.Image size={76} source={{ uri: avatarUri }} />
            ) : (
              <Avatar.Text size={76} label={(displayName || '?').charAt(0).toUpperCase()} />
            )}
            <Text variant="titleLarge" style={styles.headerName}>
              {displayName}
            </Text>
            <Text variant="bodyMedium" style={{ color: isActive ? '#15803D' : '#B91C1C', fontWeight: '700', marginTop: 2 }}>
              {data?.status || '—'}
            </Text>

            {/* 2 nút Đổi Mật Khẩu và Đăng Xuất đưa lên ngay dưới tên */}
            <View style={styles.headerBtnRow}>
              <Button
                mode="outlined"
                icon={() => <Key size={15} color="#0072FF" strokeWidth={2.2} />}
                onPress={onChangePassword}
                style={styles.headerHalfBtn}
                contentStyle={{ height: 38 }}
                labelStyle={{ fontSize: 13, fontWeight: '700' }}
              >
                Đổi mật khẩu
              </Button>
              <Button
                mode="contained-tonal"
                icon={() => <LogOut size={15} color="#B91C1C" strokeWidth={2.2} />}
                onPress={onLogout}
                style={styles.headerHalfBtn}
                contentStyle={{ height: 38 }}
                textColor="#B91C1C"
                labelStyle={{ fontSize: 13, fontWeight: '700' }}
              >
                Đăng xuất
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card} mode="outlined">
          <Card.Title title="Thông tin cơ bản" titleVariant="titleMedium" />
          {ro('Mã NV', data?.code, 'card-account-details-outline')}
          {ro('Họ Tên NV', data?.name, 'account-outline')}
          {ro('Tình trạng tài khoản', data?.status, 'shield-check-outline')}
          {ro('Email', data?.email, 'email-outline')}
          {ro('Vị trí phụ trách', data?.area, 'map-marker-outline')}
        </Card>

        <Card style={styles.card} mode="outlined">
          <Card.Title title="Thông tin đơn vị" titleVariant="titleMedium" />
          {ro('Đối tác', data?.partner, 'domain')}
          {ro('Block', data?.block, 'view-grid-outline')}
          {ro('Inside Account', data?.inside, 'badge-account-outline')}
          {ro('Mobisale', data?.mobisale, 'cellphone')}
        </Card>

        <Card style={styles.card} mode="outlined">
          <Card.Title
            title="Thông tin cá nhân"
            titleVariant="titleMedium"
            right={() =>
              !editing ? (
                <Button
                  icon={() => <Pencil size={14} color="#0072FF" strokeWidth={2.2} />}
                  onPress={() => setEditing(true)}
                >
                  Sửa
                </Button>
              ) : null
            }
          />
          <Card.Content>
            <TextInput
              mode="outlined"
              label="CCCD (12 số)"
              value={form.cccd}
              editable={editing}
              keyboardType="number-pad"
              maxLength={12}
              onChangeText={(t) => setForm({ ...form, cccd: t.replace(/\D/g, '') })}
              error={cccdError}
            />
            <HelperText type="error" visible={cccdError}>
              CCCD phải gồm đúng 12 chữ số.
            </HelperText>

            <TextInput
              mode="outlined"
              label="Địa chỉ thường trú"
              value={form.address}
              editable={editing}
              multiline
              onChangeText={(t) => setForm({ ...form, address: t })}
            />
            <HelperText type="info" visible={false}> </HelperText>

            <TextInput
              mode="outlined"
              label="SĐT cá nhân"
              value={form.phone}
              editable={editing}
              keyboardType="phone-pad"
              maxLength={11}
              onChangeText={(t) => setForm({ ...form, phone: t.replace(/\D/g, '') })}
              error={phoneError}
            />
            <HelperText type="error" visible={phoneError}>
              Số điện thoại không hợp lệ.
            </HelperText>

            <TextInput
              mode="outlined"
              label="Ngày vô công ty (dd/MM/yyyy)"
              value={form.startDate}
              editable={editing}
              placeholder="01/01/2024"
              onChangeText={(t) => setForm({ ...form, startDate: t })}
              error={dateError}
            />
            <HelperText type="error" visible={dateError}>
              Định dạng ngày: dd/MM/yyyy
            </HelperText>

            {editing && (
              <View style={styles.editActions}>
                <Button
                  mode="outlined"
                  icon={() => <X size={15} color="#64748B" strokeWidth={2.2} />}
                  onPress={() => {
                    setEditing(false);
                    if (data) {
                      setForm({ cccd: data.cccd, address: data.address, phone: data.phone, startDate: data.startDate });
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  Hủy
                </Button>
                <Button
                  mode="contained"
                  icon={() => <Save size={15} color="#FFFFFF" strokeWidth={2.2} />}
                  onPress={save}
                  loading={saving}
                  disabled={saving}
                  style={{ flex: 1 }}
                >
                  Lưu
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  headerCard: { marginBottom: 12, backgroundColor: '#FFFFFF' },
  headerContent: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12 },
  headerName: { marginTop: 10, fontWeight: '800', textAlign: 'center', fontSize: 20 },
  headerBtnRow: { flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' },
  headerHalfBtn: { flex: 1, borderRadius: 12 },
  card: { marginBottom: 12, backgroundColor: '#FFFFFF' },
  roIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    marginRight: 8,
    alignSelf: 'center',
  },
  roLabel: { fontSize: 12, color: '#64748B' },
  roValue: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
