import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface DeviceLocationResult {
  ok: boolean;
  coords?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  permissionDenied?: boolean;
  error?: string;
}

/**
 * Chuẩn hóa tọa độ GPS sang định dạng "lat, lng" (6 chữ số thập phân ~ 0.1m)
 * tương thích Google Maps & hệ thống reverse geocoding (Address of Location).
 */
export function formatLocationCoords(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/**
 * Kiểm tra chuỗi Location có đúng định dạng "lat, lng" hợp lệ không.
 */
export function isValidLocationString(loc?: string | null): boolean {
  const s = String(loc || '').trim();
  const match = s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return false;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function getWebGeolocation(
  options: PositionOptions
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Tự động lấy vị trí GPS hiện tại trực tiếp từ phần cứng thiết bị (Web / Android / iOS).
 * Kết quả không cho phép người dùng chỉnh sửa thủ công.
 */
export async function getCurrentDeviceLocation(): Promise<DeviceLocationResult> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return {
        ok: false,
        error: 'Trình duyệt không hỗ trợ lấy vị trí GPS tự động.',
      };
    }
    try {
      let pos: GeolocationPosition;
      try {
        pos = await getWebGeolocation({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 15000,
        });
      } catch (firstErr: any) {
        if (firstErr && firstErr.code === 1) {
          throw firstErr;
        }
        pos = await getWebGeolocation({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000,
        });
      }
      const { latitude, longitude, accuracy } = pos.coords;
      return {
        ok: true,
        coords: formatLocationCoords(latitude, longitude),
        latitude,
        longitude,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
      };
    } catch (err: any) {
      const code = err?.code;
      if (code === 1) {
        return {
          ok: false,
          permissionDenied: true,
          error:
            'Trình duyệt đã chặn quyền Vị trí. Vui lòng cấp quyền Location cho trang web và bấm Lấy lại GPS.',
        };
      }
      if (code === 3) {
        return {
          ok: false,
          error: 'Hết thời gian chờ tín hiệu GPS. Vui lòng bật vị trí và thử lại.',
        };
      }
      return {
        ok: false,
        error:
          'Không thể xác định vị trí thiết bị. Vui lòng kiểm tra GPS/HTTPS và thử lại.',
      };
    }
  }

  // Native (Android / iOS) sử dụng expo-location
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return {
        ok: false,
        error: 'Dịch vụ định vị GPS trên điện thoại đang tắt. Vui lòng bật GPS và thử lại.',
      };
    }

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      return {
        ok: false,
        permissionDenied: true,
        error:
          'Chưa cấp quyền Vị trí (GPS). Vui lòng cho phép ứng dụng truy cập vị trí thiết bị.',
      };
    }

    let pos: Location.LocationObject | null = null;
    try {
      pos = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }),
        12000,
        'GPS_HIGH_TIMEOUT'
      );
    } catch {
      try {
        pos = await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          10000,
          'GPS_BALANCED_TIMEOUT'
        );
      } catch {
        pos = await Location.getLastKnownPositionAsync({
          maxAge: 120000,
          requiredAccuracy: 150,
        });
      }
    }

    if (!pos || !pos.coords) {
      return {
        ok: false,
        error: 'Chưa nhận được tín hiệu GPS. Vui lòng di chuyển ra khu vực thoáng và thử lại.',
      };
    }

    const { latitude, longitude, accuracy } = pos.coords;
    return {
      ok: true,
      coords: formatLocationCoords(latitude, longitude),
      latitude,
      longitude,
      accuracy: typeof accuracy === 'number' ? accuracy : null,
    };
  } catch (err: any) {
    return {
      ok: false,
      error:
        err?.message ||
        'Không thể lấy vị trí thiết bị hiện tại. Vui lòng kiểm tra quyền GPS.',
    };
  }
}
