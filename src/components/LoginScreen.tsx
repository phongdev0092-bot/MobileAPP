import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, Pattern, Rect, SvgUri } from 'react-native-svg';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from './AppIcon';
import { useAuthTheme } from '../contexts/AuthThemeContext';
import {
  changeEmployeePassword,
  checkEmployeeEmail,
  createFirstPassword,
  EmployeeProfile,
  loginWithPassword,
} from '../services/sheetAuthService';
import { AUTH_METRICS } from '../theme/authTokens';
import { evaluatePasswordStrength } from '../utils/passwordHash';

const FPT_TELECOM_LOGO_URL =
  'https://management.mypt.vn/images/FPT_Telecom_logo.svg';

export interface LoginScreenProps {
  onLoginSuccess: (token: string, profile: EmployeeProfile) => void;
}

type AuthStep =
  | 'EMAIL'
  | 'LOGIN_PASSWORD'
  | 'CREATE_PASSWORD'
  | 'CHANGE_PASSWORD';

/**
 * Màn hình Đăng nhập thế hệ mới NextSu AI — Giao diện SaaS tinh gọn (Sáng/Tối + VI/EN),
 * xác thực trực tiếp qua Google Sheet với mật khẩu băm một chiều SHA-256 kèm email.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { lang, setLang, darkMode, toggleDarkMode, tokens, t } = useAuthTheme();
  const { width } = useWindowDimensions();
  const isWideDesktop = width >= 1024;

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
  const [fptLogoError, setFptLogoError] = useState<boolean>(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const resetMessages = () => {
    if (errorMsg) setErrorMsg(null);
    if (successMsg) setSuccessMsg(null);
  };

  const clearSensitiveInputs = () => {
    setOldPassword('');
    setPassword('');
    setConfirmPassword('');
    setShowOldPass(false);
    setShowPass(false);
    setShowConfirmPass(false);
  };

  const strength = useMemo(
    () => evaluatePasswordStrength(password, confirmPassword),
    [password, confirmPassword]
  );

  const strengthLabel = !password
    ? t('auth.strengthEmpty')
    : strength.strengthScore <= 1
      ? t('auth.strengthWeak')
      : strength.strengthScore <= 2
        ? t('auth.strengthMedium')
        : t('auth.strengthStrong');

  const strengthColor =
    strength.strengthScore <= 1
      ? tokens.strengthWeak
      : strength.strengthScore <= 2
        ? tokens.strengthMedium
        : tokens.strengthStrong;

  // Bước 1: Kiểm tra Email nhân sự trên Sheet
  const handleCheckEmail = async () => {
    if (loading) return;
    resetMessages();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg(t('auth.emailRequired'));
      triggerShake();
      return;
    }

    setEmail(trimmed);
    setLoading(true);
    const res = await checkEmployeeEmail(trimmed);
    setLoading(false);

    if (!res.ok || !res.profile) {
      setErrorMsg(res.msg || 'Tài khoản Email không tồn tại trên hệ thống.');
      triggerShake();
      return;
    }

    setCheckedProfile(res.profile);
    setAvatarLoadError(false);
    clearSensitiveInputs();
    setStep(res.hasPassword ? 'LOGIN_PASSWORD' : 'CREATE_PASSWORD');
  };

  // Bước 2a: Đăng nhập (băm SHA-256 trước khi gửi lên Sheet)
  const handleLogin = async () => {
    if (loading) return;
    resetMessages();
    if (!password) {
      setErrorMsg(t('auth.passwordRequired'));
      triggerShake();
      return;
    }

    setLoading(true);
    const res = await loginWithPassword(email, password);
    setLoading(false);

    if (!res.ok) {
      if (res.needCreate) {
        clearSensitiveInputs();
        setStep('CREATE_PASSWORD');
        return;
      }
      setErrorMsg(res.msg || 'Mật khẩu không chính xác.');
      triggerShake();
      return;
    }

    if (res.profile && res.token) {
      clearSensitiveInputs();
      onLoginSuccess(res.token, res.profile);
    }
  };

  // Bước 2b: Tạo mật khẩu lần đầu (băm SHA-256 lưu lên cột H)
  const handleCreatePassword = async () => {
    if (loading) return;
    resetMessages();
    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải có tối thiểu 6 ký tự.');
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp.');
      triggerShake();
      return;
    }

    setLoading(true);
    const res = await createFirstPassword(email, password, confirmPassword);
    setLoading(false);

    if (!res.ok || !res.profile || !res.token) {
      setErrorMsg(
        res.msg || 'Không thể thiết lập mật khẩu. Vui lòng thử lại.'
      );
      triggerShake();
      return;
    }

    clearSensitiveInputs();
    onLoginSuccess(res.token, res.profile);
  };

  // Bước 2c: Đổi mật khẩu ngay tại màn hình Login
  const handleChangePassword = async () => {
    if (loading) return;
    resetMessages();
    if (!oldPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu hiện tại.');
      triggerShake();
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Mật khẩu mới phải từ 6 ký tự trở lên.');
      triggerShake();
      return;
    }
    if (password === oldPassword) {
      setErrorMsg('Mật khẩu mới phải khác mật khẩu hiện tại.');
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp.');
      triggerShake();
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
      triggerShake();
      return;
    }

    clearSensitiveInputs();
    setSuccessMsg(t('auth.changeSuccess'));

    setTimeout(() => {
      if (res.profile && res.token) {
        onLoginSuccess(res.token, res.profile);
      } else {
        setStep('LOGIN_PASSWORD');
      }
    }, 550);
  };

  const handleBackToEmail = () => {
    resetMessages();
    clearSensitiveInputs();
    setStep('EMAIL');
  };

  const renderEmployeeBadge = () => {
    if (!checkedProfile) return null;
    const subInfo = [checkedProfile.partner, checkedProfile.block]
      .filter(Boolean)
      .join(' • ');

    return (
      <View
        style={[
          styles.employeeChip,
          {
            backgroundColor: tokens.muted,
            borderColor: tokens.border,
          },
        ]}
      >
        {checkedProfile.avatar && !avatarLoadError ? (
          <Image
            source={{ uri: checkedProfile.avatar }}
            style={styles.employeeAvatarImg}
            onError={() => setAvatarLoadError(true)}
          />
        ) : (
          <View
            style={[
              styles.employeeAvatarFallback,
              { backgroundColor: tokens.primary },
            ]}
          >
            <Text style={styles.employeeAvatarLetter}>
              {(checkedProfile.name || email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.employeeMeta}>
          <Text
            style={[styles.employeeName, { color: tokens.foreground }]}
            numberOfLines={1}
          >
            {checkedProfile.name || email}
          </Text>
          <Text
            style={[styles.employeeSub, { color: tokens.mutedForeground }]}
            numberOfLines={1}
          >
            {subInfo ? `${email} • ${subInfo}` : email}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleBackToEmail}
          disabled={loading}
          style={[
            styles.changeEmailPill,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
            },
          ]}
        >
          <ArrowLeft size={13} color={tokens.foreground} />
          <Text
            style={[styles.changeEmailText, { color: tokens.foreground }]}
          >
            {t('auth.changeEmailBtn')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderAlerts = () => (
    <>
      {Boolean(errorMsg) && (
        <Animated.View
          style={[
            styles.alertBox,
            {
              backgroundColor: tokens.errorBg,
              borderColor: tokens.errorBorder,
              transform: [{ translateX: shakeAnim }],
            },
          ]}
        >
          <AlertCircle
            size={16}
            color={tokens.errorText}
            style={styles.alertIcon}
          />
          <Text style={[styles.alertText, { color: tokens.errorText }]}>
            {errorMsg}
          </Text>
        </Animated.View>
      )}

      {Boolean(successMsg) && (
        <View
          style={[
            styles.alertBox,
            {
              backgroundColor: tokens.successBg,
              borderColor: tokens.successBorder,
            },
          ]}
        >
          <CheckCircle2
            size={16}
            color={tokens.successText}
            style={styles.alertIcon}
          />
          <Text style={[styles.alertText, { color: tokens.successText }]}>
            {successMsg}
          </Text>
        </View>
      )}
    </>
  );

  const renderStrengthAndRules = () => {
    const ruleItems = [
      { ok: strength.minLen, label: t('auth.ruleMin6') },
      {
        ok: strength.hasLetter && strength.hasNumber,
        label: t('auth.ruleLetterNum'),
      },
      { ok: strength.matches, label: t('auth.ruleMatches') },
      { ok: true, label: t('auth.ruleSha256') },
    ];

    return (
      <>
        <View style={styles.strengthContainer}>
          <View style={styles.strengthHeader}>
            <Text
              style={[
                styles.strengthTitle,
                { color: tokens.mutedForeground },
              ]}
            >
              {t('auth.strengthTitle')}
            </Text>
            <Text
              style={[
                styles.strengthValue,
                { color: password ? strengthColor : tokens.mutedForeground },
              ]}
            >
              {strengthLabel}
            </Text>
          </View>
          <View style={styles.strengthBarsRow}>
            {[1, 2, 3, 4].map((bar) => {
              const active = password.length > 0 && strength.strengthScore >= bar;
              return (
                <View
                  key={bar}
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor: active ? strengthColor : tokens.muted,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.rulesGrid,
            {
              backgroundColor: tokens.muted,
              borderColor: tokens.border,
            },
          ]}
        >
          {ruleItems.map((item) => (
            <View key={item.label} style={styles.ruleRow}>
              <Check
                size={13}
                color={item.ok ? tokens.success : tokens.mutedForeground}
                style={{ opacity: item.ok ? 1 : 0.35 }}
              />
              <Text
                style={[
                  styles.ruleLabel,
                  { color: item.ok ? tokens.success : tokens.mutedForeground },
                ]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: tokens.background }]}>
      {/* Nền Gradient AI */}
      <LinearGradient
        colors={tokens.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Lưới SVG nơ-ron mờ */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern
              id="nextsu-login-grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <Circle cx="2" cy="2" r="1.3" fill={tokens.gridDot} />
              <Path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke={tokens.gridLine}
                strokeWidth="0.7"
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#nextsu-login-grid)" />
        </Svg>
      </View>

      {/* Vầng sáng trang trí góc */}
      <View
        pointerEvents="none"
        style={[styles.glowTopLeft, { backgroundColor: tokens.glowPrimary }]}
      />
      <View
        pointerEvents="none"
        style={[styles.glowBottomRight, { backgroundColor: tokens.glowTeal }]}
      />

      {/* Thanh điều khiển Ngôn ngữ (VI | EN) & Giao diện (Sáng | Tối) */}
      <View style={styles.topControlsRow}>
        <View
          accessibilityLabel={t('header.languageLabel')}
          style={[
            styles.langSegment,
            {
              backgroundColor: tokens.glassCardBg,
              borderColor: tokens.border,
            },
          ]}
        >
          <Languages
            size={14}
            color={tokens.mutedForeground}
            style={{ marginLeft: 6, marginRight: 4 }}
          />
          {(['vi', 'en'] as const).map((code) => {
            const active = lang === code;
            return (
              <TouchableOpacity
                key={code}
                onPress={() => setLang(code)}
                style={[
                  styles.langChip,
                  active && { backgroundColor: tokens.card },
                ]}
              >
                <Text
                  style={[
                    styles.langChipText,
                    {
                      color: active ? tokens.primary : tokens.mutedForeground,
                    },
                  ]}
                >
                  {code.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={toggleDarkMode}
          accessibilityLabel={t('header.toggleTheme')}
          style={[
            styles.themeToggleBtn,
            {
              backgroundColor: tokens.glassCardBg,
              borderColor: tokens.border,
            },
          ]}
        >
          {darkMode ? (
            <Sun size={16} color={tokens.foreground} />
          ) : (
            <Moon size={16} color={tokens.foreground} />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.mainGrid,
              isWideDesktop && styles.mainGridDesktop,
            ]}
          >
            {isWideDesktop && (
              <View style={styles.desktopBrandCol}>
                <View style={styles.brandBadgesRow}>
                  {!fptLogoError ? (
                    Platform.OS === 'web' ? (
                      <Image
                        source={{ uri: FPT_TELECOM_LOGO_URL }}
                        style={{ width: 136, height: 42 }}
                        resizeMode="contain"
                        onError={() => setFptLogoError(true)}
                      />
                    ) : (
                      <SvgUri
                        uri={FPT_TELECOM_LOGO_URL}
                        width={136}
                        height={42}
                        onError={() => setFptLogoError(true)}
                      />
                    )
                  ) : (
                    <View
                      style={[
                        styles.fptPill,
                        {
                          backgroundColor: tokens.primarySoftBg,
                          borderColor: tokens.primarySoftBorder,
                        },
                      ]}
                    >
                      <Sparkles size={15} color={tokens.primary} />
                      <Text
                        style={[styles.fptPillText, { color: tokens.primary }]}
                      >
                        FPT Telecom
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.dividerVertical,
                      { backgroundColor: tokens.border },
                    ]}
                  />
                  <View
                    style={[
                      styles.logoBadgeDesktop,
                      { borderColor: tokens.border },
                    ]}
                  >
                    <Image
                      source={require('../../assets/logo.png')}
                      style={styles.logoImgDesktop}
                      resizeMode="contain"
                    />
                  </View>
                </View>

                <Text
                  style={[
                    styles.desktopHeadline,
                    { color: tokens.foreground },
                  ]}
                >
                  {t('auth.brandTitle')}
                </Text>
                <Text
                  style={[
                    styles.desktopTagline,
                    { color: tokens.mutedForeground },
                  ]}
                >
                  {t('auth.brandTagline')}
                </Text>
              </View>
            )}

            {/* Thẻ đăng nhập kính mờ bo 20px */}
            <View
              style={[
                styles.authCard,
                {
                  backgroundColor: tokens.glassCardBg,
                  borderColor: tokens.glassCardBorder,
                },
              ]}
            >
              {/* Header thương hiệu + Huy hiệu SHA-256 */}
              <View style={styles.cardBrandRow}>
                <View style={styles.cardBrandLeft}>
                  {!fptLogoError ? (
                    Platform.OS === 'web' ? (
                      <Image
                        source={{ uri: FPT_TELECOM_LOGO_URL }}
                        style={{ width: 92, height: 28 }}
                        resizeMode="contain"
                        onError={() => setFptLogoError(true)}
                      />
                    ) : (
                      <SvgUri
                        uri={FPT_TELECOM_LOGO_URL}
                        width={92}
                        height={28}
                        onError={() => setFptLogoError(true)}
                      />
                    )
                  ) : (
                    <View
                      style={[
                        styles.mobileFptBadge,
                        {
                          backgroundColor: tokens.primarySoftBg,
                          borderColor: tokens.primarySoftBorder,
                        },
                      ]}
                    >
                      <Sparkles size={12} color={tokens.primary} />
                      <Text
                        style={[
                          styles.mobileFptBadgeText,
                          { color: tokens.primary },
                        ]}
                      >
                        FPT Telecom
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.mobileLogoBox,
                      { borderColor: tokens.border },
                    ]}
                  >
                    <Image
                      source={require('../../assets/logo.png')}
                      style={styles.mobileLogoImg}
                      resizeMode="contain"
                    />
                  </View>
                </View>

                <View
                  style={[
                    styles.hashSecurityBadge,
                    {
                      backgroundColor: tokens.muted,
                      borderColor: tokens.border,
                    },
                  ]}
                >
                  <ShieldCheck size={12} color={tokens.success} />
                  <Text
                    style={[
                      styles.hashSecurityText,
                      { color: tokens.mutedForeground },
                    ]}
                  >
                    {t('auth.hashBadge')}
                  </Text>
                </View>
              </View>

              {step === 'EMAIL' && (
                <View>
                  <Text
                    style={[styles.stepTitle, { color: tokens.foreground }]}
                  >
                    {t('auth.emailTitle')}
                  </Text>
                  <Text
                    style={[
                      styles.stepSubtitle,
                      { color: tokens.mutedForeground },
                    ]}
                  >
                    {t('auth.emailSubtitle')}
                  </Text>

                  {renderAlerts()}

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[styles.fieldLabel, { color: tokens.foreground }]}
                    >
                      {t('auth.emailLabel')}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: tokens.inputBg,
                          borderColor:
                            focusedField === 'email'
                              ? tokens.primary
                              : tokens.inputBorder,
                        },
                      ]}
                    >
                      <Mail size={16} color={tokens.mutedForeground} />
                      <TextInput
                        value={email}
                        onChangeText={(v) => {
                          setEmail(v);
                          resetMessages();
                        }}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        onSubmitEditing={handleCheckEmail}
                        returnKeyType="next"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                        placeholder={t('auth.emailPlaceholder')}
                        placeholderTextColor={tokens.mutedForeground}
                        style={[styles.textInput, { color: tokens.foreground }]}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleCheckEmail}
                    disabled={loading}
                    activeOpacity={0.88}
                    style={[
                      styles.primaryButtonWrap,
                      { opacity: loading ? 0.65 : 1 },
                    ]}
                  >
                    <LinearGradient
                      colors={[tokens.primary, tokens.primaryGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryButtonGradient}
                    >
                      {loading ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color={tokens.primaryForeground}
                          />
                          <Text
                            style={[
                              styles.primaryButtonText,
                              { color: tokens.primaryForeground },
                            ]}
                          >
                            {t('auth.checkingBtn')}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.primaryButtonText,
                              { color: tokens.primaryForeground },
                            ]}
                          >
                            {t('auth.continueBtn')}
                          </Text>
                          <ArrowRight
                            size={16}
                            color={tokens.primaryForeground}
                          />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {step === 'LOGIN_PASSWORD' && (
                <View>
                  <Text
                    style={[styles.stepTitle, { color: tokens.foreground }]}
                  >
                    {t('auth.passwordTitle')}
                  </Text>
                  {renderEmployeeBadge()}
                  {renderAlerts()}

                  <View style={styles.fieldBlock}>
                    <View style={styles.labelRowBetween}>
                      <Text
                        style={[
                          styles.fieldLabelNoMargin,
                          { color: tokens.foreground },
                        ]}
                      >
                        {t('auth.passwordLabel')}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          resetMessages();
                          clearSensitiveInputs();
                          setStep('CHANGE_PASSWORD');
                        }}
                        disabled={loading}
                      >
                        <Text
                          style={[
                            styles.inlineLinkText,
                            { color: tokens.primary },
                          ]}
                        >
                          {t('auth.switchToChangePwd')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: tokens.inputBg,
                          borderColor:
                            focusedField === 'loginPwd'
                              ? tokens.primary
                              : tokens.inputBorder,
                        },
                      ]}
                    >
                      <Lock size={16} color={tokens.mutedForeground} />
                      <TextInput
                        value={password}
                        onChangeText={(v) => {
                          setPassword(v);
                          resetMessages();
                        }}
                        onFocus={() => setFocusedField('loginPwd')}
                        onBlur={() => setFocusedField(null)}
                        onSubmitEditing={handleLogin}
                        returnKeyType="done"
                        secureTextEntry={!showPass}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                        placeholder={t('auth.passwordPlaceholder')}
                        placeholderTextColor={tokens.mutedForeground}
                        style={[styles.textInput, { color: tokens.foreground }]}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPass((s) => !s)}
                        accessibilityLabel={
                          showPass
                            ? t('auth.hidePassword')
                            : t('auth.showPassword')
                        }
                        style={styles.eyeToggle}
                      >
                        {showPass ? (
                          <EyeOff size={16} color={tokens.mutedForeground} />
                        ) : (
                          <Eye size={16} color={tokens.mutedForeground} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.88}
                    style={[
                      styles.primaryButtonWrap,
                      { opacity: loading ? 0.65 : 1 },
                    ]}
                  >
                    <LinearGradient
                      colors={[tokens.primary, tokens.primaryGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryButtonGradient}
                    >
                      {loading ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color={tokens.primaryForeground}
                          />
                          <Text
                            style={[
                              styles.primaryButtonText,
                              { color: tokens.primaryForeground },
                            ]}
                          >
                            {t('auth.signingInBtn')}
                          </Text>
                        </>
                      ) : (
                        <>
                          <KeyRound
                            size={16}
                            color={tokens.primaryForeground}
                          />
                          <Text
                            style={[
                              styles.primaryButtonText,
                              { color: tokens.primaryForeground },
                            ]}
                          >
                            {t('auth.signInBtn')}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {step === 'CREATE_PASSWORD' && (
                <View>
                  <Text
                    style={[styles.stepTitle, { color: tokens.foreground }]}
                  >
                    {t('auth.createTitle')}
                  </Text>
                  <Text
                    style={[
                      styles.stepSubtitle,
                      { color: tokens.mutedForeground },
                    ]}
                  >
                    {t('auth.createSubtitle')}
                  </Text>

                  {renderEmployeeBadge()}
                  {renderAlerts()}

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[styles.fieldLabel, { color: tokens.foreground }]}
                    >
                      {t('auth.newPasswordLabel')}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: tokens.inputBg,
                          borderColor:
                            focusedField === 'createPwd'
                              ? tokens.primary
                              : tokens.inputBorder,
                        },
                      ]}
                    >
                      <Lock size={16} color={tokens.mutedForeground} />
                      <TextInput
                        value={password}
                        onChangeText={(v) => {
                          setPassword(v);
                          resetMessages();
                        }}
                        onFocus={() => setFocusedField('createPwd')}
                        onBlur={() => setFocusedField(null)}
                        secureTextEntry={!showPass}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                        placeholder={t('auth.newPasswordPlaceholder')}
                        placeholderTextColor={tokens.mutedForeground}
                        style={[styles.textInput, { color: tokens.foreground }]}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPass((s) => !s)}
                        style={styles.eyeToggle}
                      >
                        {showPass ? (
                          <EyeOff size={16} color={tokens.mutedForeground} />
                        ) : (
                          <Eye size={16} color={tokens.mutedForeground} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.fieldBlockCompact}>
                    <Text
                      style={[styles.fieldLabel, { color: tokens.foreground }]}
                    >
                      {t('auth.confirmPasswordLabel')}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: tokens.inputBg,
                          borderColor:
                            focusedField === 'createConfirm'
                              ? tokens.primary
                              : tokens.inputBorder,
                        },
                      ]}
                    >
                      <Lock size={16} color={tokens.mutedForeground} />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={(v) => {
                          setConfirmPassword(v);
                          resetMessages();
                        }}
                        onFocus={() => setFocusedField('createConfirm')}
                        onBlur={() => setFocusedField(null)}
                        onSubmitEditing={handleCreatePassword}
                        returnKeyType="done"
                        secureTextEntry={!showConfirmPass}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                        placeholderTextColor={tokens.mutedForeground}
                        style={[styles.textInput, { color: tokens.foreground }]}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPass((s) => !s)}
                        style={styles.eyeToggle}
                      >
                        {showConfirmPass ? (
                          <EyeOff size={16} color={tokens.mutedForeground} />
                        ) : (
                          <Eye size={16} color={tokens.mutedForeground} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {renderStrengthAndRules()}

                  <TouchableOpacity
                    onPress={handleCreatePassword}
                    disabled={loading}
                    activeOpacity={0.88}
                    style={[
                      styles.primaryButtonWrap,
                      { opacity: loading ? 0.65 : 1 },
                    ]}
                  >
                    <LinearGradient
                      colors={[tokens.primary, tokens.primaryGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryButtonGradient}
                    >
                      {loading ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color={tokens.primaryForeground}
                          />
                          <Text
                            style={[
                              styles.primaryButtonText,
                              { color: tokens.primaryForeground },
                            ]}
                          >
                            {t('auth.creatingBtn')}
                          </Text>
                        </>
                      ) : (
                        <>
                          <KeyRound
                            size={16}
                            color={tokens.primaryForeground}
                          />
                          <Text
                            style={[
                              styles.primaryButtonText,
                              { color: tokens.primaryForeground },
                            ]}
                          >
                            {t('auth.createSubmitBtn')}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {step === 'CHANGE_PASSWORD' && (
                <View>
                  <View style={styles.labelRowBetween}>
                    <Text
                      style={[styles.stepTitle, { color: tokens.foreground }]}
                    >
                      {t('auth.changeTitle')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        resetMessages();
                        clearSensitiveInputs();
                        setStep('LOGIN_PASSWORD');
                      }}
                      disabled={loading}
                      style={[
                        styles.changeEmailPill,
                        {
                          backgroundColor: tokens.inputBg,
                          borderColor: tokens.border,
                        },
                      ]}
                    >
                      <ArrowLeft size={13} color={tokens.foreground} />
                      <Text
                        style={[
                          styles.changeEmailText,
                          { color: tokens.foreground },
                        ]}
                      >
                        {t('common.back')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={[
                      styles.stepSubtitle,
                      { color: tokens.mutedForeground },
                    ]}
                  >
                    {t('auth.changeSubtitle')}
                  </Text>

                  {renderAlerts()}

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[styles.fieldLabel, { color: tokens.foreground }]}
                    >
                      {t('auth.currentPasswordLabel')}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: tokens.inputBg,
                          borderColor:
                            focusedField === 'oldPwd'
                              ? tokens.primary
                              : tokens.inputBorder,
                        },
                      ]}
                    >
                      <Lock size={16} color={tokens.mutedForeground} />
                      <TextInput
                        value={oldPassword}
                        onChangeText={(v) => {
                          setOldPassword(v);
                          resetMessages();
                        }}
                        onFocus={() => setFocusedField('oldPwd')}
                        onBlur={() => setFocusedField(null)}
                        secureTextEntry={!showOldPass}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                        placeholder={t('auth.currentPasswordPlaceholder')}
                        placeholderTextColor={tokens.mutedForeground}
                        style={[styles.textInput, { color: tokens.foreground }]}
                      />
                      <TouchableOpacity
                        onPress={() => setShowOldPass((s) => !s)}
                        style={styles.eyeToggle}
                      >
                        {showOldPass ? (
                          <EyeOff size={16} color={tokens.mutedForeground} />
                        ) : (
                          <Eye size={16} color={tokens.mutedForeground} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.fieldBlockCompact}>
                    <Text
                      style={[styles.fieldLabel, { color: tokens.foreground }]}
                    >
                      {t('auth.newPasswordLabel')}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: tokens.inputBg,
                          borderColor:
                            focusedField === 'newPwd'
                              ? tokens.primary
                              : tokens.inputBorder,
                        },
                      ]}
                    >
                      <Lock size={16} color={tokens.mutedForeground} />
                      <TextInput
                        value={password}
                        onChangeText={(v) => {
                          setPassword(v);
                          resetMessages();
                        }}
                        onFocus={() => setFocusedField('newPwd')}
                        onBlur={() => setFocusedField(null)}
                        secureTextEntry={!showPass}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                        placeholder={t('auth.newPasswordPlaceholder')}
                        placeholderTextColor={tokens.mutedForeground}
                        style={[styles.textInput, { color: tokens.foreground }]}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPass((s) => !s)}
                        style={styles.eyeToggle}
                      >
                        {showPass ? (
                          <EyeOff size={16} color={tokens.mutedForeground} />
                        ) : (
                          <Eye size={16} color={tokens.mutedForeground} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.fieldBlockCompact}>
                    <Text
                      style={[styles.fieldLabel, { color: tokens.foreground }]}
                    >
                      {t('auth.confirmNewPasswordLabel')}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: tokens.inputBg,
                          borderColor:
                            focusedField === 'confirmNewPwd'
                              ? tokens.primary
                              : tokens.inputBorder,
                        },
                      ]}
                    >
                      <Lock size={16} color={tokens.mutedForeground} />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={(v) => {
                          setConfirmPassword(v);
                          resetMessages();
                        }}
                        onFocus={() => setFocusedField('confirmNewPwd')}
                        onBlur={() => setFocusedField(null)}
                        onSubmitEditing={handleChangePassword}
                        returnKeyType="done"
                        secureTextEntry={!showConfirmPass}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                        placeholderTextColor={tokens.mutedForeground}
                        style={[styles.textInput, { color: tokens.foreground }]}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPass((s) => !s)}
                        style={styles.eyeToggle}
                      >
                        {showConfirmPass ? (
                          <EyeOff size={16} color={tokens.mutedForeground} />
                        ) : (
                          <Eye size={16} color={tokens.mutedForeground} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {renderStrengthAndRules()}

                  <TouchableOpacity
                    onPress={handleChangePassword}
                    disabled={loading}
                    activeOpacity={0.88}
                    style={[
                      styles.primaryButtonWrap,
                      { opacity: loading ? 0.65 : 1 },
                    ]}
                  >
                    <LinearGradient
                      colors={[tokens.primary, tokens.primaryGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryButtonGradient}
                    >
                      {loading ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color={tokens.primaryForeground}
                          />
                          <Text
                            style={[
                              styles.primaryButtonText,
                              { color: tokens.primaryForeground },
                            ]}
                          >
                            {t('auth.changingBtn')}
                          </Text>
                        </>
                      ) : (
                        <>
                          <KeyRound
                            size={16}
                            color={tokens.primaryForeground}
                          />
                          <Text
                            style={[
                              styles.primaryButtonText,
                              { color: tokens.primaryForeground },
                            ]}
                          >
                            {t('auth.changeSubmitBtn')}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  flexOne: {
    flex: 1,
  },
  glowTopLeft: {
    position: 'absolute',
    top: -96,
    left: -96,
    width: 300,
    height: 300,
    borderRadius: 999,
  },
  glowBottomRight: {
    position: 'absolute',
    bottom: -110,
    right: -110,
    width: 340,
    height: 340,
    borderRadius: 999,
  },
  topControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 10,
  },
  langSegment: {
    height: AUTH_METRICS.topChipHeight,
    borderRadius: AUTH_METRICS.chipRadius,
    borderWidth: 1,
    paddingHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  langChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  themeToggleBtn: {
    width: AUTH_METRICS.topChipHeight,
    height: AUTH_METRICS.topChipHeight,
    borderRadius: AUTH_METRICS.chipRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  mainGrid: {
    width: '100%',
    maxWidth: AUTH_METRICS.cardMaxWidth,
    alignItems: 'center',
  },
  mainGridDesktop: {
    maxWidth: 1020,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 40,
  },
  desktopBrandCol: {
    flex: 1,
    paddingRight: 16,
  },
  brandBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  fptPill: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fptPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  dividerVertical: {
    width: 1,
    height: 28,
  },
  logoBadgeDesktop: {
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImgDesktop: {
    width: 84,
    height: 30,
  },
  desktopHeadline: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
  },
  desktopTagline: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 500,
  },
  authCard: {
    width: '100%',
    maxWidth: AUTH_METRICS.cardMaxWidth,
    borderRadius: AUTH_METRICS.cardRadius,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 8,
  },
  cardBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  cardBrandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  mobileFptBadge: {
    height: 27,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mobileFptBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  mobileLogoBox: {
    height: 27,
    paddingHorizontal: 6,
    borderRadius: 7,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileLogoImg: {
    width: 50,
    height: 18,
  },
  hashSecurityBadge: {
    height: 25,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hashSecurityText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
  },
  employeeChip: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  employeeAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  employeeAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  employeeMeta: {
    flex: 1,
  },
  employeeName: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  employeeSub: {
    fontSize: 11,
    marginTop: 1,
  },
  changeEmailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  changeEmailText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  alertBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertIcon: {
    marginTop: 2,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  fieldBlock: {
    marginTop: 15,
  },
  fieldBlockCompact: {
    marginTop: 11,
  },
  labelRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  fieldLabelNoMargin: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  inlineLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputContainer: {
    height: AUTH_METRICS.inputHeight,
    borderRadius: AUTH_METRICS.controlRadius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 13,
    paddingRight: 10,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  eyeToggle: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthContainer: {
    marginTop: 10,
  },
  strengthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  strengthTitle: {
    fontSize: 11,
  },
  strengthValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  strengthBarsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 999,
  },
  rulesGrid: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: AUTH_METRICS.controlRadius,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  ruleRow: {
    width: '50%',
    minWidth: 145,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 5,
  },
  ruleLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  primaryButtonWrap: {
    marginTop: 16,
    borderRadius: AUTH_METRICS.controlRadius,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    height: AUTH_METRICS.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
