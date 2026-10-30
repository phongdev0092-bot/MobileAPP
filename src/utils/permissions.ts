import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Xin quyền Camera và Thư viện ảnh lúc chạy (Runtime Permissions) trên Android.
 *
 * Trên Android, thẻ <input type="file" accept="image/*"> trong WebView khi bấm vào
 * sẽ cho phép người dùng chọn "Chụp ảnh" (Camera) hoặc "Chọn tệp từ thư viện".
 * Nếu ứng dụng có khai báo quyền CAMERA trong AndroidManifest.xml nhưng chưa xin phép
 * người dùng lúc chạy (Runtime), Android WebView sẽ từ chối mở Camera.
 */
export async function requestMediaAndCameraPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const permissionsToRequest: Array<
      (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]
    > = [PermissionsAndroid.PERMISSIONS.CAMERA];

    // Android 13+ (API 33 trở lên) sử dụng quyền READ_MEDIA_IMAGES
    if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
    } else {
      // Android 12 trở xuống (API <= 32) sử dụng quyền READ_EXTERNAL_STORAGE
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
    }

    const statuses = await PermissionsAndroid.requestMultiple(permissionsToRequest);

    const isCameraGranted =
      statuses[PermissionsAndroid.PERMISSIONS.CAMERA] ===
      PermissionsAndroid.RESULTS.GRANTED;

    return isCameraGranted;
  } catch (error) {
    console.warn('Lỗi khi xin quyền Camera và Thư viện ảnh:', error);
    return false;
  }
}
