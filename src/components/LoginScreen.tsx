import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import {
  changeEmployeePassword,
  checkEmployeeEmail,
  createFirstPassword,
  EmployeeProfile,
  loginWithPassword,
} from '../services/sheetAuthService';

interface LoginScreenProps {
  onLoginSuccess: (
    token: string,
    profile: EmployeeProfile,
    password?: string
  ) => void;
}

type AuthStep =
  | 'EMAIL'
  | 'LOGIN_PASSWORD'
  | 'CREATE_PASSWORD'
  | 'CHANGE_PASSWORD';

/**
 * Màn hình Đăng nhập thiết kế sang trọng, tối giản theo tông màu Logo Caption Nextsu AI - FPT Telecom.
 * - Không hiển thị bất kỳ dữ liệu cột hay thông tin nội bộ nào của Sheet ra giao diện.
 * - Tích hợp đầy đủ: Xác thực Email -> Nhập mật khẩu / Tạo mật khẩu lần đầu / Đổi mật khẩu.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<AuthStep>('EMAIL');
  const [email, setEmail] = useState<string>('');
  const [oldPassword, setOldPassword] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [showOldPass, setShowOldPass] = useState<boolean>(false);
  const [showPass, setShowPass] = useState<boolean>(false);
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [checkedProfile, setCheckedProfile] = useState<EmployeeProfile | null>(
    null
  );
  const [avatarLoadError, setAvatarLoadError] = useState<boolean>(false);

  const resetMessages = () => {
    if (errorMsg) setErrorMsg(null);
    if (successMsg) setSuccessMsg(null);
  };

  // Bước 1: Kiểm tra tài khoản Email
  const handleCheckEmail = async () => {
    resetMessages();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập địa chỉ Email của bạn.');
      return;
    }

    setLoading(true);
    const res = await checkEmployeeEmail(trimmed);
    setLoading(false);

    if (!res.ok || !res.profile) {
      setErrorMsg(res.msg || 'Tài khoản Email không tồn tại trên hệ thống.');
      return;
    }

    setCheckedProfile(res.profile);
    setAvatarLoadError(false);
    setPassword('');
    setConfirmPassword('');
    setOldPassword('');

    if (res.hasPassword) {
      setStep('LOGIN_PASSWORD');
    } else {
      setStep('CREATE_PASSWORD');
    }
  };

  // Bước 2a: Đăng nhập
  const handleLogin = async () => {
    resetMessages();
    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);
    const res = await loginWithPassword(email, password);
    setLoading(false);

    if (!res.ok) {
      if (res.needCreate) {
        setStep('CREATE_PASSWORD');
        return;
      }
      setErrorMsg(res.msg || 'Mật khẩu không chính xác.');
      return;
    }

    if (res.profile && res.token) {
      onLoginSuccess(res.token, res.profile, password);
    }
  };

  // Bước 2b: Khởi tạo mật khẩu lần đầu
  const handleCreatePassword = async () => {
    resetMessages();
    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setLoading(true);
    const res = await createFirstPassword(email, password, confirmPassword);
    setLoading(false);

    if (!res.ok || !res.profile || !res.token) {
      setErrorMsg(res.msg || 'Không thể thiết lập mật khẩu. Vui lòng thử lại.');
      return;
    }

    onLoginSuccess(res.token, res.profile, password);
  };

  // Bước 2c: Đổi mật khẩu
  const handleChangePassword = async () => {
    resetMessages();
    if (!oldPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }
    if (password === oldPassword) {
      setErrorMsg('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setLoading(true);
    const res = await changeEmployeePassword(
      email,
      oldPassword,
      password,
      confirmPassword
    );
    setLoading(false);

    if (!res.ok) {
      setErrorMsg(res.msg || 'Không thể đổi mật khẩu.');
      return;
    }

    setOldPassword('');
    setConfirmPassword('');
    setSuccessMsg('Đổi mật khẩu thành công! Đang đăng nhập...');

    setTimeout(() => {
      if (res.profile && res.token) {
        onLoginSuccess(res.token, res.profile, password);
      } else {
        setStep('LOGIN_PASSWORD');
      }
    }, 700);
  };

  const handleBackToEmail = () => {
    resetMessages();
    setPassword('');
    setConfirmPassword('');
    setOldPassword('');
    setStep('EMAIL');
  };

  const openChangePasswordStep = () => {
    resetMessages();
    setOldPassword('');
    setPassword('');
    setConfirmPassword('');
    setStep('CHANGE_PASSWORD');
  };

  return (
    <View style={styles.screenRoot}>
      {/* Nền sáng hiện đại với dải màu mềm mại phía trên */}
      <LinearGradient
        colors={['#E0F2FE', '#EEF2FF', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.topDecorCircleLeft} />
      <View style={styles.topDecorCircleRight} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.centerContainer}>
            {/* Khối Logo chính */}
            <View style={styles.logoHeader}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Thẻ Form Đăng nhập tối giản, tinh tế */}
            <View style={styles.card}>
              {/* Tiêu đề từng bước */}
              {step === 'EMAIL' && (
                <View style={styles.headerBlock}>
                  <Text style={styles.titleText}>Chào mừng trở lại</Text>
                  <Text style={styles.subtitleText}>
                    Nhập tài khoản Email của bạn để tiếp tục
                  </Text>
                </View>
              )}

              {step === 'LOGIN_PASSWORD' && (
                <View style={styles.headerBlock}>
                  {checkedProfile?.avatar && !avatarLoadError ? (
                    <Image
                      source={{ uri: checkedProfile.avatar }}
                      style={styles.loginAvatarImg}
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : (
                    <View style={styles.loginAvatarFallback}>
                      <Text style={styles.loginAvatarFallbackText}>
                        {(checkedProfile?.name || email || 'U')
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.welcomeNameText}>
                    Xin chào, {checkedProfile?.name || email.trim().toLowerCase()}
                  </Text>
                  <TouchableOpacity
                    style={styles.emailPill}
                    onPress={handleBackToEmail}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.emailPillText} numberOfLines={1}>
                      {email.trim().toLowerCase()}
                    </Text>
                    <Ionicons name="sync-outline" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>
              )}

              {step === 'CREATE_PASSWORD' && (
                <View style={styles.headerBlock}>
                  {checkedProfile?.avatar && !avatarLoadError ? (
                    <Image
                      source={{ uri: checkedProfile.avatar }}
                      style={styles.loginAvatarImg}
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : (
                    <View style={styles.loginAvatarFallback}>
                      <Text style={styles.loginAvatarFallbackText}>
                        {(checkedProfile?.name || email || 'U')
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.welcomeNameText}>
                    Xin chào, {checkedProfile?.name || email.trim().toLowerCase()}
                  </Text>
                  <Text style={styles.subtitleText}>
                    Thiết lập mật khẩu cho lần đăng nhập đầu tiên của bạn
                  </Text>
                </View>
              )}

              {step === 'CHANGE_PASSWORD' && (
                <View style={styles.headerBlock}>
                  {checkedProfile?.avatar && !avatarLoadError ? (
                    <Image
                      source={{ uri: checkedProfile.avatar }}
                      style={styles.loginAvatarImg}
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : (
                    <View style={styles.loginAvatarFallback}>
                      <Text style={styles.loginAvatarFallbackText}>
                        {(checkedProfile?.name || email || 'U')
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.welcomeNameText}>
                    Xin chào, {checkedProfile?.name || email.trim().toLowerCase()}
                  </Text>
                  <Text style={styles.subtitleText}>
                    Nhập mật khẩu hiện tại và mật khẩu mới để cập nhật
                  </Text>
                </View>
              )}

              {/* Hộp báo lỗi / thành công */}
              {errorMsg && (
                <View style={styles.alertError}>
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{errorMsg}</Text>
                </View>
              )}

              {successMsg && (
                <View style={styles.alertSuccess}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  <Text style={styles.alertSuccessText}>{successMsg}</Text>
                </View>
              )}

              {/* ================= BƯỚC 1: NHẬP EMAIL ================= */}
              {step === 'EMAIL' && (
                <View style={styles.formSection}>
                  <Text style={styles.fieldLabel}>Tài khoản Email</Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedField === 'email' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={focusedField === 'email' ? '#0066FF' : '#94A3B8'}
                      style={styles.leftIcon}
                    />
                    <TextInput
                      style={styles.inputControl}
                      placeholder="ten.nhanvien@fpt.net"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={email}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(t) => {
                        setEmail(t);
                        resetMessages();
                      }}
                      onSubmitEditing={handleCheckEmail}
                      returnKeyType="next"
                    />
                    {email.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setEmail('')}
                        style={styles.iconActionBtn}
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#CBD5E1"
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    disabled={loading}
                    onPress={handleCheckEmail}
                    style={styles.primaryBtnWrap}
                  >
                    <LinearGradient
                      colors={['#00B4FF', '#0066FF', '#6C3CE9']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryBtnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Text style={styles.primaryBtnText}>Tiếp tục</Text>
                          <Ionicons
                            name="arrow-forward"
                            size={18}
                            color="#FFFFFF"
                          />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* ================= BƯỚC 2A: ĐĂNG NHẬP ================= */}
              {step === 'LOGIN_PASSWORD' && (
                <View style={styles.formSection}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Mật khẩu</Text>
                    <TouchableOpacity onPress={openChangePasswordStep}>
                      <Text style={styles.changePassLink}>Đổi mật khẩu?</Text>
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.inputBox,
                      focusedField === 'loginPass' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={
                        focusedField === 'loginPass' ? '#0066FF' : '#94A3B8'
                      }
                      style={styles.leftIcon}
                    />
                    <TextInput
                      style={styles.inputControl}
                      placeholder="Nhập mật khẩu của bạn"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPass}
                      autoCapitalize="none"
                      value={password}
                      onFocus={() => setFocusedField('loginPass')}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(t) => {
                        setPassword(t);
                        resetMessages();
                      }}
                      onSubmitEditing={handleLogin}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPass(!showPass)}
                      style={styles.iconActionBtn}
                    >
                      <Ionicons
                        name={showPass ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    disabled={loading}
                    onPress={handleLogin}
                    style={styles.primaryBtnWrap}
                  >
                    <LinearGradient
                      colors={['#00B4FF', '#0066FF', '#6C3CE9']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryBtnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Đăng nhập</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={styles.bottomActionsRow}>
                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={handleBackToEmail}
                    >
                      <Ionicons name="arrow-back" size={16} color="#475569" />
                      <Text style={styles.secondaryActionText}>
                        Tài khoản khác
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={openChangePasswordStep}
                    >
                      <Ionicons name="key-outline" size={16} color="#0066FF" />
                      <Text
                        style={[
                          styles.secondaryActionText,
                          { color: '#0066FF' },
                        ]}
                      >
                        Đổi mật khẩu
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ================= BƯỚC 2B: TẠO MẬT KHẨU LẦN ĐẦU ================= */}
              {step === 'CREATE_PASSWORD' && (
                <View style={styles.formSection}>
                  <Text style={styles.fieldLabel}>Mật khẩu mới</Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedField === 'newPass' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={focusedField === 'newPass' ? '#0066FF' : '#94A3B8'}
                      style={styles.leftIcon}
                    />
                    <TextInput
                      style={styles.inputControl}
                      placeholder="Tối thiểu 6 ký tự"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPass}
                      autoCapitalize="none"
                      value={password}
                      onFocus={() => setFocusedField('newPass')}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(t) => {
                        setPassword(t);
                        resetMessages();
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPass(!showPass)}
                      style={styles.iconActionBtn}
                    >
                      <Ionicons
                        name={showPass ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                    Nhập lại mật khẩu
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedField === 'confirmPass' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={
                        focusedField === 'confirmPass' ? '#0066FF' : '#94A3B8'
                      }
                      style={styles.leftIcon}
                    />
                    <TextInput
                      style={styles.inputControl}
                      placeholder="Xác nhận mật khẩu mới"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showConfirmPass}
                      autoCapitalize="none"
                      value={confirmPassword}
                      onFocus={() => setFocusedField('confirmPass')}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(t) => {
                        setConfirmPassword(t);
                        resetMessages();
                      }}
                      onSubmitEditing={handleCreatePassword}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPass(!showConfirmPass)}
                      style={styles.iconActionBtn}
                    >
                      <Ionicons
                        name={
                          showConfirmPass ? 'eye-off-outline' : 'eye-outline'
                        }
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    disabled={loading}
                    onPress={handleCreatePassword}
                    style={styles.primaryBtnWrap}
                  >
                    <LinearGradient
                      colors={['#00B4FF', '#0066FF', '#6C3CE9']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryBtnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>
                          Hoàn tất & Đăng nhập
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { marginTop: 16, alignSelf: 'center' }]}
                    onPress={handleBackToEmail}
                  >
                    <Ionicons name="arrow-back" size={16} color="#475569" />
                    <Text style={styles.secondaryActionText}>
                      Quay lại bước nhập Email
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ================= BƯỚC 2C: ĐỔI MẬT KHẨU ================= */}
              {step === 'CHANGE_PASSWORD' && (
                <View style={styles.formSection}>
                  <Text style={styles.fieldLabel}>Mật khẩu hiện tại</Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedField === 'oldPass' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons
                      name="key-outline"
                      size={20}
                      color={focusedField === 'oldPass' ? '#0066FF' : '#94A3B8'}
                      style={styles.leftIcon}
                    />
                    <TextInput
                      style={styles.inputControl}
                      placeholder="Nhập mật khẩu đang sử dụng"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showOldPass}
                      autoCapitalize="none"
                      value={oldPassword}
                      onFocus={() => setFocusedField('oldPass')}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(t) => {
                        setOldPassword(t);
                        resetMessages();
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowOldPass(!showOldPass)}
                      style={styles.iconActionBtn}
                    >
                      <Ionicons
                        name={showOldPass ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                    Mật khẩu mới
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedField === 'changeNewPass' &&
                        styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={
                        focusedField === 'changeNewPass' ? '#0066FF' : '#94A3B8'
                      }
                      style={styles.leftIcon}
                    />
                    <TextInput
                      style={styles.inputControl}
                      placeholder="Tối thiểu 6 ký tự"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPass}
                      autoCapitalize="none"
                      value={password}
                      onFocus={() => setFocusedField('changeNewPass')}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(t) => {
                        setPassword(t);
                        resetMessages();
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPass(!showPass)}
                      style={styles.iconActionBtn}
                    >
                      <Ionicons
                        name={showPass ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                    Xác nhận mật khẩu mới
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedField === 'changeConfirmPass' &&
                        styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={
                        focusedField === 'changeConfirmPass'
                          ? '#0066FF'
                          : '#94A3B8'
                      }
                      style={styles.leftIcon}
                    />
                    <TextInput
                      style={styles.inputControl}
                      placeholder="Nhập lại mật khẩu mới"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showConfirmPass}
                      autoCapitalize="none"
                      value={confirmPassword}
                      onFocus={() => setFocusedField('changeConfirmPass')}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(t) => {
                        setConfirmPassword(t);
                        resetMessages();
                      }}
                      onSubmitEditing={handleChangePassword}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPass(!showConfirmPass)}
                      style={styles.iconActionBtn}
                    >
                      <Ionicons
                        name={
                          showConfirmPass ? 'eye-off-outline' : 'eye-outline'
                        }
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    disabled={loading}
                    onPress={handleChangePassword}
                    style={styles.primaryBtnWrap}
                  >
                    <LinearGradient
                      colors={['#00B4FF', '#0066FF', '#6C3CE9']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryBtnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>
                          Cập nhật mật khẩu
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryActionBtn,
                      { marginTop: 16, alignSelf: 'center' },
                    ]}
                    onPress={() => {
                      resetMessages();
                      setPassword('');
                      setConfirmPassword('');
                      setOldPassword('');
                      setStep('LOGIN_PASSWORD');
                    }}
                  >
                    <Ionicons name="arrow-back" size={16} color="#475569" />
                    <Text style={styles.secondaryActionText}>
                      Quay lại đăng nhập
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={styles.copyrightText}>
              © NextSu AI — FPT Telecom
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topDecorCircleLeft: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(0, 180, 255, 0.12)',
  },
  topDecorCircleRight: {
    position: 'absolute',
    top: -100,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(108, 60, 233, 0.1)',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  centerContainer: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  logoHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 22,
  },
  logoImage: {
    width: 260,
    height: 110,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 26,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 22,
  },
  titleText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  loginAvatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: '#0066FF',
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  loginAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  loginAvatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  welcomeNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 10,
    gap: 6,
    maxWidth: '100%',
  },
  emailPillText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B',
    flexShrink: 1,
  },
  alertError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
    gap: 8,
  },
  alertErrorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  alertSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
    gap: 8,
  },
  alertSuccessText: {
    flex: 1,
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  formSection: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  changePassLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0066FF',
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 54,
  },
  inputBoxFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0066FF',
  },
  leftIcon: {
    marginRight: 10,
  },
  inputControl: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  iconActionBtn: {
    padding: 6,
  },
  primaryBtnWrap: {
    marginTop: 22,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  primaryBtnGradient: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  secondaryActionText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569',
  },
  copyrightText: {
    marginTop: 22,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
