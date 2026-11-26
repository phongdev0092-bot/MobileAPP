import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
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
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  X,
} from './AppIcon';
import { useAuthTheme } from '../contexts/AuthThemeContext';
import { changeEmployeePassword } from '../services/sheetAuthService';
import { AUTH_METRICS } from '../theme/authTokens';
import { evaluatePasswordStrength } from '../utils/passwordHash';

export interface ChangePasswordModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
  onSuccess?: (message: string, newToken?: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  email,
  onClose,
  onSuccess,
}) => {
  const { tokens, t } = useAuthTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (!visible) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCur(false);
      setShowNew(false);
      setShowConfirm(false);
      setError('');
      setSubmitting(false);
      setFocusedField(null);
    }
  }, [visible]);

  const strength = useMemo(
    () => evaluatePasswordStrength(newPassword, confirmPassword),
    [newPassword, confirmPassword]
  );

  const canSubmit =
    currentPassword.length > 0 &&
    strength.isReady &&
    newPassword !== currentPassword &&
    !submitting;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    const res = await changeEmployeePassword(
      email,
      currentPassword,
      newPassword,
      confirmPassword
    );
    setSubmitting(false);

    if (!res.ok) {
      setError(res.msg || 'Không thể cập nhật mật khẩu.');
      triggerShake();
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
    if (onSuccess) {
      onSuccess(res.msg || t('auth.changeSuccess'), res.token);
    }
  };

  const fields = [
    {
      id: 'cur',
      label: t('auth.currentPasswordLabel'),
      placeholder: t('auth.currentPasswordPlaceholder'),
      val: currentPassword,
      setVal: setCurrentPassword,
      show: showCur,
      toggle: () => setShowCur((s) => !s),
    },
    {
      id: 'new',
      label: t('auth.newPasswordLabel'),
      placeholder: t('auth.newPasswordPlaceholder'),
      val: newPassword,
      setVal: setNewPassword,
      show: showNew,
      toggle: () => setShowNew((s) => !s),
    },
    {
      id: 'confirm',
      label: t('auth.confirmNewPasswordLabel'),
      placeholder: t('auth.confirmPasswordPlaceholder'),
      val: confirmPassword,
      setVal: setConfirmPassword,
      show: showConfirm,
      toggle: () => setShowConfirm((s) => !s),
    },
  ];

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
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: tokens.overlayBg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollCenter}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: tokens.card,
                borderColor: tokens.border,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: tokens.primarySoftBg },
                  ]}
                >
                  <ShieldCheck size={20} color={tokens.primary} />
                </View>
                <View style={styles.flexOne}>
                  <Text style={[styles.title, { color: tokens.foreground }]}>
                    {t('auth.changeTitle')}
                  </Text>
                  <Text
                    style={[styles.subtitle, { color: tokens.mutedForeground }]}
                  >
                    {t('auth.changeSubtitle')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                accessibilityLabel={t('common.close')}
                style={[styles.closeBtn, { backgroundColor: tokens.muted }]}
              >
                <X size={16} color={tokens.mutedForeground} />
              </TouchableOpacity>
            </View>

            {Boolean(error) && (
              <Animated.View
                style={[
                  styles.errorBox,
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
                  style={styles.inlineIconTop}
                />
                <Text style={[styles.errorText, { color: tokens.errorText }]}>
                  {error}
                </Text>
              </Animated.View>
            )}

            {fields.map((f) => (
              <View key={f.id} style={styles.fieldGroup}>
                <Text style={[styles.label, { color: tokens.foreground }]}>
                  {f.label}
                </Text>
                <View
                  style={[
                    styles.pwdWrap,
                    {
                      backgroundColor: tokens.inputBg,
                      borderColor:
                        focusedField === f.id
                          ? tokens.primary
                          : tokens.inputBorder,
                    },
                  ]}
                >
                  <TextInput
                    value={f.val}
                    onChangeText={(v) => {
                      f.setVal(v);
                      if (error) setError('');
                    }}
                    onFocus={() => setFocusedField(f.id)}
                    onBlur={() => setFocusedField(null)}
                    placeholder={f.placeholder}
                    placeholderTextColor={tokens.mutedForeground}
                    secureTextEntry={!f.show}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!submitting}
                    style={[styles.pwdInput, { color: tokens.foreground }]}
                  />
                  <TouchableOpacity
                    onPress={f.toggle}
                    accessibilityLabel={
                      f.show ? t('auth.hidePassword') : t('auth.showPassword')
                    }
                    style={styles.eyeBtn}
                  >
                    {f.show ? (
                      <EyeOff size={16} color={tokens.mutedForeground} />
                    ) : (
                      <Eye size={16} color={tokens.mutedForeground} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View
              style={[
                styles.rulesBox,
                {
                  backgroundColor: tokens.muted,
                  borderColor: tokens.border,
                },
              ]}
            >
              {ruleItems.map((item) => (
                <View key={item.label} style={styles.ruleItem}>
                  <Check
                    size={13}
                    color={item.ok ? tokens.success : tokens.mutedForeground}
                    style={{ opacity: item.ok ? 1 : 0.35 }}
                  />
                  <Text
                    style={[
                      styles.ruleText,
                      {
                        color: item.ok
                          ? tokens.success
                          : tokens.mutedForeground,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.footerBtns}>
              <TouchableOpacity
                onPress={onClose}
                disabled={submitting}
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: tokens.inputBg,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Text
                  style={[styles.cancelBtnText, { color: tokens.foreground }]}
                >
                  {t('common.close')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!canSubmit}
                activeOpacity={0.88}
                style={[styles.submitBtnWrap, { opacity: !canSubmit ? 0.55 : 1 }]}
              >
                <LinearGradient
                  colors={[tokens.primary, tokens.primaryGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtnGradient}
                >
                  {submitting ? (
                    <ActivityIndicator
                      size="small"
                      color={tokens.primaryForeground}
                    />
                  ) : (
                    <KeyRound size={15} color={tokens.primaryForeground} />
                  )}
                  <Text
                    style={[
                      styles.submitBtnText,
                      { color: tokens.primaryForeground },
                    ]}
                  >
                    {submitting
                      ? t('auth.changingBtn')
                      : t('auth.changeSubmitBtn')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  scrollCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: AUTH_METRICS.dialogMaxWidth,
    borderRadius: AUTH_METRICS.dialogRadius,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexOne: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  inlineIconTop: {
    marginTop: 2,
  },
  fieldGroup: {
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 5,
  },
  pwdWrap: {
    height: AUTH_METRICS.dialogInputHeight,
    borderRadius: AUTH_METRICS.controlRadius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 6,
  },
  pwdInput: {
    flex: 1,
    fontSize: 13.5,
    height: '100%',
  },
  eyeBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  rulesBox: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: AUTH_METRICS.controlRadius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  ruleItem: {
    width: '50%',
    minWidth: 145,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 6,
  },
  ruleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footerBtns: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    height: 38,
    borderRadius: AUTH_METRICS.controlRadius,
    borderWidth: 1,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  submitBtnWrap: {
    borderRadius: AUTH_METRICS.controlRadius,
    overflow: 'hidden',
  },
  submitBtnGradient: {
    height: 38,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
});
