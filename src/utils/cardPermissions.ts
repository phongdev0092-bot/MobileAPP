/**
 * cardPermissions.ts — Phân quyền hiển thị các Card tác vụ vận hành dựa trên cột Chức danh (cột O, index 14)
 * và quyền Admin (cột AD / Admin mặc định):
 *
 * 1. "CB Kỹ thuật TKBT" hoặc "CB Hỗ trợ kỹ thuật tại nhà KH":
 *    -> Thấy 8 card kỹ thuật: Bypass Công Suất, Bypass NT Mỹ Bảo, Phân Công Tay,
 *       Tối Ưu Kênh Truyền, Reset MAC, Thu Hồi Port, Tra Cứu 360, Kiểm Tra Mạng.
 * 2. "CB Chăm sóc & PT khách hàng":
 *    -> Chỉ thấy Phối Hợp Thu Bill (Clear Tín Hiệu / Cấp Lại Tín Hiệu) và Phối Hợp SOS (Đang phát triển).
 * 3. "Đội trưởng Triển khai bảo trì" hoặc "QL Quản lý đối tác" (hoặc Role === 'Admin'):
 *    -> Thấy hết tất cả các card (OSP dành riêng cho tài khoản quyền Admin).
 * 4. Các chức danh khác ngoài danh sách trên (nếu không phải Admin):
 *    -> Không hiển thị card tác vụ vận hành (báo chưa được phân quyền theo chức danh).
 */

export function normalizeJobTitle(rawTitle?: string | null): string {
  return String(rawTitle || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TECH_TITLES = new Set([
  'cb kỹ thuật tkbt',
  'cb hỗ trợ kỹ thuật tại nhà kh',
]);

const BILLING_CSKH_TITLES = new Set([
  'cb chăm sóc & pt khách hàng',
]);

const FULL_ACCESS_TITLES = new Set([
  'đội trưởng triển khai bảo trì',
  'ql quản lý đối tác',
]);

export interface CardVisibilityMatrix {
  canSeeTechCards: boolean;
  canSeeBillCollection: boolean;
  canSeeSos: boolean;
  canSeeOsp: boolean;
  hasAnyCard: boolean;
  normalizedTitle: string;
}

export function getCardVisibility(profile: {
  role?: 'Admin' | 'User' | string;
  title?: string | null;
}): CardVisibilityMatrix {
  const isAdmin = String(profile.role || '').trim() === 'Admin';
  const normalizedTitle = normalizeJobTitle(profile.title);

  const isFullAccess = isAdmin || FULL_ACCESS_TITLES.has(normalizedTitle);
  const isTech = TECH_TITLES.has(normalizedTitle);
  const isBillingCskh = BILLING_CSKH_TITLES.has(normalizedTitle);

  const canSeeTechCards = isFullAccess || isTech;
  const canSeeBillCollection = isFullAccess || isBillingCskh;
  const canSeeSos = isFullAccess || isBillingCskh;
  const canSeeOsp = isAdmin;

  const hasAnyCard =
    canSeeTechCards || canSeeBillCollection || canSeeSos || canSeeOsp;

  return {
    canSeeTechCards,
    canSeeBillCollection,
    canSeeSos,
    canSeeOsp,
    hasAnyCard,
    normalizedTitle,
  };
}

export function canExecuteTaskTab(
  tab: string,
  profile: { role?: 'Admin' | 'User' | string; title?: string | null }
): boolean {
  const v = getCardVisibility(profile);
  switch (tab) {
    case 'BYPASS':
    case 'CLEAR':
    case 'MYBAE':
    case 'MANUAL':
    case 'SPAM':
    case 'RESETMAC':
    case 'RECALL_PORT':
    case 'SEARCH_360':
    case 'NET_TOOLS':
      return v.canSeeTechCards;
    case 'BILL_COLLECTION':
      return v.canSeeBillCollection;
    case 'OSP':
      return v.canSeeOsp;
    default:
      return true;
  }
}
