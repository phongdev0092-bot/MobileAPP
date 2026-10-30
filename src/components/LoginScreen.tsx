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
import { CONFIG } from '../config';
import {
  checkEmployeeEmail,
  createFirstPassword,
  EmployeeProfile,
  loginWithPassword,
} from '../services/sheetAuthService';

interface LoginScreenProps {
  onLoginSuccess: (token: string, profile: EmployeeProfile, password?: string) => void;
}

type AuthStep = 'EMAIL' | 'LOGIN_PASSWORD' | 'CREATE_PASSWORD';

/**
 * Màn hình Đăng nhập hiện đại mang nhận diện thương hiệu Caption Nextsu AI - FPT Telecom.
 * Quy trình:
 * 1. Nhập Email nhân viên -> Kiểm tra tồn tại ở cột K trên Sheet (17QLc9SlfpPPrR-d1R2BkBxA7DmCI5ZCuhmQffP5F6pY, gid=32204814).
 * 2. Nếu cột H đã có mật khẩu -> Chuyển sang bước nhập mật khẩu.
 * 3. Nếu đăng nhập lần đầu (cột H trống) -> Bắt buộc khởi tạo mật khẩu mới và lưu vào cột H.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<AuthStep>('EMAIL');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkedProfile, setCheckedProfile] = useState<EmployeeProfile | null>(null);

  // Bước 1: Kiểm tra Email trong cột K
  const handleCheckEmail = async () => {
    setErrorMsg(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập địa chỉ Email FPT Telecom của bạn.');
      return;
    }

    setLoading(true);
    const res = await checkEmployeeEmail(trimmed);
    setLoading(false);

    if (!res.ok || !res.profile) {
      setErrorMsg(
        res.msg || 'Email không tồn tại trong danh sách nhân viên (cột K).'
      );
      return;
    }

    setCheckedProfile(res.profile);
    setPassword('');
    setConfirmPassword('');

    if (res.hasPassword) {
      setStep('LOGIN_PASSWORD');
    } else {
      setStep('CREATE_PASSWORD');
    }
  };

  // Bước 2a: Đăng nhập với mật khẩu cột H
  const handleLogin = async () => {
    setErrorMsg(null);
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
        setErrorMsg('Tài khoản chưa có mật khẩu ở cột H. Vui lòng khởi tạo mật khẩu.');
        return;
      }
      setErrorMsg(res.msg || 'Mật khẩu không đúng.');
      return;
    }

    if (res.profile && res.token) {
      onLoginSuccess(res.token, res.profile, password);
    }
  };

  // Bước 2b: Khởi tạo mật khẩu lần đầu và lưu vào cột H
  const handleCreatePassword = async () => {
    setErrorMsg(null);
    if (password.length < 6) {
      setErrorMsg('Mật khẩu khởi tạo phải từ 6 ký tự trở lên.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    const res = await createFirstPassword(email, password, confirmPassword);
    setLoading(false);

    if (!res.ok || !res.profile || !res.token) {
      setErrorMsg(res.msg || 'Không thể khởi tạo mật khẩu. Vui lòng thử lại.');
      return;
    }

    onLoginSuccess(res.token, res.profile, password);
  };

  const handleBackToEmail = () => {
    setStep('EMAIL');
    setErrorMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <LinearGradient
      colors={['#070F26', '#0D1E4C', '#171347']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.background}
    >
      {/* Các vòng sáng trang trí mang phong cách AI hiện đại */}
      <View style={styles.glowCircleTop} />
      <View style={styles.glowCircleBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Khung Logo Caption Nextsu AI - FPT Telecom */}
          <View style={styles.brandSection}>
            <View style={styles.logoCard}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={14} color="#00E5FF" />
              <Text style={styles.aiBadgeText}>
                NEXTSU AI PORTAL • FPT TELECOM
              </Text>
            </View>
          </View>

          {/* Thẻ Đăng nhập chính */}
          <View style={styles.authCard}>
            {/* Tiêu đề theo từng bước */}
            {step === 'EMAIL' && (
              <>
                <Text style={styles.cardTitle}>Đăng nhập hệ thống</Text>
                <Text style={styles.cardSubtitle}>
                  Sử dụng Email nhân viên (cột K) để xác thực truy cập vào Nextsu AI
                </Text>
              </>
            )}

            {step === 'LOGIN_PASSWORD' && checkedProfile && (
              <>
                <View style={styles.userGreetingBox}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {checkedProfile.name
                        ? checkedProfile.name.charAt(0).toUpperCase()
                        : 'N'}
                    </Text>
                  </View>
                  <View style={styles.userGreetingInfo}>
                    <Text style={styles.userGreetingName} numberOfLines={1}>
                      {checkedProfile.name || 'Nhân viên FPT'}
                    </Text>
                    <Text style={styles.userGreetingMeta} numberOfLines={1}>
                      MSNV: {checkedProfile.code || '---'} • {checkedProfile.partner || 'FPT Telecom'}
                    </Text>
                    <Text style={styles.userGreetingEmail} numberOfLines={1}>
                      {checkedProfile.email}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardTitle}>Nhập mật khẩu</Text>
                <Text style={styles.cardSubtitle}>
                  Tài khoản đã được xác thực. Vui lòng nhập mật khẩu của bạn.
                </Text>
              </>
            )}

            {step === 'CREATE_PASSWORD' && checkedProfile && (
              <>
                <View style={styles.userGreetingBox}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {checkedProfile.name
                        ? checkedProfile.name.charAt(0).toUpperCase()
                        : 'N'}
                    </Text>
                  </View>
                  <View style={styles.userGreetingInfo}>
                    <Text style={styles.userGreetingName} numberOfLines={1}>
                      {checkedProfile.name || 'Nhân viên FPT'}
                    </Text>
                    <Text style={styles.userGreetingMeta} numberOfLines={1}>
                      MSNV: {checkedProfile.code || '---'} • Dòng #{checkedProfile.row}
                    </Text>
                    <Text style={styles.userGreetingEmail} numberOfLines={1}>
                      {checkedProfile.email}
                    </Text>
                  </View>
                </View>
                <View style={styles.firstLoginBanner}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color="#0284C7"
                  />
                  <Text style={styles.firstLoginBannerText}>
                    Đây là lần đăng nhập đầu tiên của bạn. Vui lòng khởi tạo mật khẩu (tối thiểu 6 ký tự) để lưu vào cột H trên hệ thống.
                  </Text>
                </View>
              </>
            )}

            {/* Thông báo lỗi nếu có */}
            {errorMsg && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            )}

            {/* BƯỚC 1: Ô NHẬP EMAIL */}
            {step === 'EMAIL' && (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>EMAIL NHÂN VIÊN (CỘT K)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#0072FF"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: phuongnam.nhanht6@fpt.net"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onSubmitEditing={handleCheckEmail}
                    returnKeyType="next"
                  />
                  {email.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setEmail('')}
                      style={styles.clearBtn}
                    >
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={loading}
                  onPress={handleCheckEmail}
                  style={styles.submitBtnContainer}
                >
                  <LinearGradient
                    colors={['#00C6FF', '#0072FF', '#6C3CE9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {loading ? (
                      <View style={styles.btnRow}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.buttonText}>
                          Đang kiểm tra dữ liệu...
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.btnRow}>
                        <Text style={styles.buttonText}>Tiếp tục xác thực</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={19}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* BƯỚC 2A: ĐĂNG NHẬP BẰNG MẬT KHẨU */}
            {step === 'LOGIN_PASSWORD' && (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>MẬT KHẨU CỦA BẠN (CỘT H)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#0072FF"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập mật khẩu..."
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onSubmitEditing={handleLogin}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={loading}
                  onPress={handleLogin}
                  style={styles.submitBtnContainer}
                >
                  <LinearGradient
                    colors={['#00C6FF', '#0072FF', '#6C3CE9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {loading ? (
                      <View style={styles.btnRow}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.buttonText}>Đang đăng nhập...</Text>
                      </View>
                    ) : (
                      <View style={styles.btnRow}>
                        <Text style={styles.buttonText}>Đăng nhập ngay</Text>
                        <Ionicons
                          name="log-in-outline"
                          size={20}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleBackToEmail}
                  style={styles.switchAccountBtn}
                >
                  <Ionicons name="arrow-back" size={16} color="#0072FF" />
                  <Text style={styles.switchAccountText}>
                    Đổi tài khoản Email khác
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* BƯỚC 2B: KHỞI TẠO MẬT KHẨU LẦN ĐẦU */}
            {step === 'CREATE_PASSWORD' && (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  TẠO MẬT KHẨU MỚI (LƯU CỘT H)
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="key-outline"
                    size={20}
                    color="#0072FF"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tối thiểu 6 ký tự..."
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                  XÁC NHẬN LẠI MẬT KHẨU
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="checkmark-done-outline"
                    size={20}
                    color="#0072FF"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập lại mật khẩu..."
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onSubmitEditing={handleCreatePassword}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={
                        showConfirmPassword ? 'eye-off-outline' : 'eye-outline'
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
                  style={styles.submitBtnContainer}
                >
                  <LinearGradient
                    colors={['#00C6FF', '#0072FF', '#6C3CE9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {loading ? (
                      <View style={styles.btnRow}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.buttonText}>
                          Đang khởi tạo mật khẩu...
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.btnRow}>
                        <Text style={styles.buttonText}>
                          Lưu mật khẩu & Đăng nhập
                        </Text>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={20}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleBackToEmail}
                  style={styles.switchAccountBtn}
                >
                  <Ionicons name="arrow-back" size={16} color="#0072FF" />
                  <Text style={styles.switchAccountText}>
                    Quay lại nhập Email khác
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Chân trang */}
          <Text style={styles.footerText}>
            Powered by Caption Nextsu AI — FPT Telecom
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  glowCircleTop: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 198, 255, 0.18)',
  },
  glowCircleBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(108, 60, 233, 0.22)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCard: {
    width: '100%',
    maxWidth: 320,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#00C6FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 198, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 198, 255, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 14,
    gap: 6,
  },
  aiBadgeText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#64748B',
    marginBottom: 20,
  },
  userGreetingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0072FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  userGreetingInfo: {
    flex: 1,
  },
  userGreetingName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  userGreetingMeta: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  userGreetingEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  firstLoginBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  firstLoginBannerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#0369A1',
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600',
  },
  formGroup: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtnContainer: {
    marginTop: 22,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#0072FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradientButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 6,
    gap: 6,
  },
  switchAccountText: {
    color: '#0072FF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    color: 'rgba(226, 232, 240, 0.7)',
    fontSize: 12,
    marginTop: 24,
    fontWeight: '500',
  },
});
