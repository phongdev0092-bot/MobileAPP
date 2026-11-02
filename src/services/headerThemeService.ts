import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParticleType } from '../components/FestiveHeaderOverlay';
import { callAppsScriptJsonApi } from './sheetAuthService';

export interface HeaderThemeConfig {
  festivalId: string;
  festivalName: string;
  gradientColors: [string, string, ...string[]];
  backgroundImage?: string | null;
  particleType: ParticleType;
  greetingBadge?: string | null;
}

const DEFAULT_THEME: HeaderThemeConfig = {
  festivalId: 'default',
  festivalName: 'NextSu AI',
  gradientColors: ['#070F26', '#0D235A', '#1E1B5E'],
  backgroundImage: null,
  particleType: 'stars',
  greetingBadge: null,
};

/**
 * Tự động nhận diện chủ đề lễ hội theo ngày tháng thực tế trong năm (Offline Fallback)
 */
export function getAutoFestivalTheme(now: Date = new Date()): HeaderThemeConfig {
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  // 1. Giáng Sinh (15/12 - 26/12)
  if (month === 12 && day >= 15 && day <= 26) {
    return {
      festivalId: 'noel',
      festivalName: 'Giáng Sinh An Lành',
      gradientColors: ['#064E3B', '#047857', '#0F766E'],
      particleType: 'snow',
      greetingBadge: '🎄 Merry Christmas',
    };
  }

  // 2. Chào Năm Mới Dương Lịch (30/12 - 05/01)
  if ((month === 12 && day >= 30) || (month === 1 && day <= 5)) {
    return {
      festivalId: 'new_year',
      festivalName: 'Chào Đón Năm Mới',
      gradientColors: ['#312E81', '#4F46E5', '#7C3AED'],
      particleType: 'confetti',
      greetingBadge: '🎆 Happy New Year',
    };
  }

  // 3. Mùa Xuân & Tết Nguyên Đán (Khoảng 15/01 - 25/02)
  if ((month === 1 && day >= 15) || (month === 2 && day <= 25)) {
    return {
      festivalId: 'tet',
      festivalName: 'Mừng Xuân & Tết Cổ Truyền',
      gradientColors: ['#7F1D1D', '#991B1B', '#D97706'],
      particleType: 'apricot',
      greetingBadge: '🧧 Chúc Mừng Năm Mới',
    };
  }

  // 4. Ngày Thống Nhất & Quốc Tế Lao Động (28/04 - 03/05)
  if ((month === 4 && day >= 28) || (month === 5 && day <= 3)) {
    return {
      festivalId: 'thong_nhat',
      festivalName: 'Mừng Đại Lễ 30/4 - 1/5',
      gradientColors: ['#831843', '#9D174D', '#BE185D'],
      particleType: 'confetti',
      greetingBadge: '🎉 Chúc Mừng Đại Lễ',
    };
  }

  // 5. Sinh nhật FPT Telecom (10/09 - 16/09)
  if (month === 9 && day >= 10 && day <= 16) {
    return {
      festivalId: 'fpt_day',
      festivalName: 'Mừng Sinh Nhật FPT',
      gradientColors: ['#1E3A8A', '#0284C7', '#EA580C'],
      particleType: 'confetti',
      greetingBadge: '🧡 Sinh Nhật FPT',
    };
  }

  // 6. Quốc Khánh (01/09 - 03/09)
  if (month === 9 && day >= 1 && day <= 3) {
    return {
      festivalId: 'quoc_khanh',
      festivalName: 'Mừng Quốc Khánh 2/9',
      gradientColors: ['#991B1B', '#B91C1C', '#DC2626'],
      particleType: 'confetti',
      greetingBadge: '🇻🇳 Tự Hào Việt Nam',
    };
  }

  // Mặc định: Nền xanh đen NextSu AI sang trọng + Đốm sáng sao rơi
  return DEFAULT_THEME;
}

/**
 * Lấy cấu hình chủ đề Header từ Bộ API Google Apps Script (kèm cache)
 */
export async function fetchHeaderTheme(token?: string): Promise<HeaderThemeConfig> {
  const localDefault = getAutoFestivalTheme();

  try {
    const cached = await AsyncStorage.getItem('@nextsu_header_theme');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.gradientColors) {
        return parsed;
      }
    }
  } catch {}

  try {
    const res = await callAppsScriptJsonApi<any>({
      action: 'getHeaderTheme',
      token,
    });

    if (res && res.ok && res.theme) {
      const theme: HeaderThemeConfig = {
        festivalId: res.theme.festivalId || localDefault.festivalId,
        festivalName: res.theme.festivalName || localDefault.festivalName,
        gradientColors: res.theme.gradientColors || localDefault.gradientColors,
        backgroundImage: res.theme.backgroundImage || null,
        particleType: res.theme.particleType || localDefault.particleType,
        greetingBadge: res.theme.greetingBadge || localDefault.greetingBadge,
      };
      await AsyncStorage.setItem('@nextsu_header_theme', JSON.stringify(theme));
      return theme;
    }
  } catch (err) {
    console.warn('fetchHeaderTheme error, using local festival config:', err);
  }

  return localDefault;
}
