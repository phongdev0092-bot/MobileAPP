/**
 * cmdImageExport.ts
 * Bộ công cụ xuất báo cáo chẩn đoán mạng dưới dạng Hình Ảnh Chụp Màn Hình CMD (PNG Image).
 * Hỗ trợ vẽ Canvas pixel-perfect trên Web và sinh thẻ ảnh chụp cho di động.
 */

import { Platform, Share } from 'react-native';

export interface CmdSnapshotData {
  title: string;
  wifiSsid: string;
  ipAddress: string;
  gateway: string;
  logs: string[];
  timestamp: string;
}

/**
 * Tạo ảnh PNG chụp màn hình CMD bằng HTML5 Canvas (chạy trên Web / WebView)
 */
export function generateCmdCanvasImage(data: CmdSnapshotData): string | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const width = 800;
    const lineHeight = 20;
    const padding = 20;
    const headerHeight = 44;
    const bannerHeight = 65;
    const footerHeight = 40;

    // Lọc và tính toán số dòng
    const validLogs = data.logs.slice(-35); // Lấy tối đa 35 dòng log gần nhất
    const contentHeight = validLogs.length * lineHeight;
    const totalHeight = headerHeight + bannerHeight + contentHeight + footerHeight + padding * 2;

    canvas.width = width;
    canvas.height = totalHeight;

    // 1. NỀN TOÀN BỘ WINDOW (WINDOWS 11 TERMINAL STYLE)
    ctx.fillStyle = '#0C0C0C';
    ctx.fillRect(0, 0, width, totalHeight);

    // 2. THANH TIÊU ĐỀ TITLE BAR (#1F1F1F)
    ctx.fillStyle = '#1F1F1F';
    ctx.fillRect(0, 0, width, headerHeight);

    // Tab Command Prompt (#2D2D2D)
    ctx.fillStyle = '#2D2D2D';
    ctx.roundRect ? ctx.roundRect(14, 8, 180, 28, 6) : ctx.fillRect(14, 8, 180, 28);
    ctx.fill();

    // Icon Terminal & Title Tab
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Consolas", "Courier New", monospace';
    ctx.fillText('>_ Command Prompt', 30, 26);

    // Nút điều khiển cửa sổ (─ □ ✕)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px monospace';
    ctx.fillText('─', width - 85, 26);
    ctx.fillText('□', width - 58, 26);
    ctx.fillStyle = '#F87171';
    ctx.fillText('✕', width - 30, 26);

    // 3. KHUNG BANNER THÔNG TIN WI-FI (#18181B)
    ctx.fillStyle = '#141414';
    ctx.fillRect(14, headerHeight + 10, width - 28, 48);
    ctx.strokeStyle = '#27272A';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, headerHeight + 10, width - 28, 48);

    // Chấm xanh trạng thái Wi-Fi
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(32, headerHeight + 34, 5, 0, Math.PI * 2);
    ctx.fill();

    // Chữ thông tin Wi-Fi
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 13px "Consolas", monospace';
    ctx.fillText(`MẠNG WI-FI: ${data.wifiSsid.toUpperCase()}`, 46, headerHeight + 28);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px "Consolas", monospace';
    ctx.fillText(`IP Thiết Bị: ${data.ipAddress}   |   Gateway Modem: ${data.gateway}   |   Thời gian: ${data.timestamp}`, 46, headerHeight + 46);

    // 4. NỘI DUNG LOG DÒNG LỆNH CMD
    let yPos = headerHeight + bannerHeight + 20;
    ctx.font = '13px "Consolas", "Courier New", monospace';

    for (const line of validLogs) {
      if (line.startsWith('C:\\Users')) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px "Consolas", monospace';
      } else if (line.includes('Reply from') || line.includes('Trace complete')) {
        ctx.fillStyle = '#4ADE80'; // Xanh lá
        ctx.font = '13px "Consolas", monospace';
      } else if (line.includes('timed out') || line.includes('100% loss') || line.includes('Error')) {
        ctx.fillStyle = '#F87171'; // Đỏ
        ctx.font = '13px "Consolas", monospace';
      } else if (line.includes('statistics') || line.includes('Approximate')) {
        ctx.fillStyle = '#FBBF24'; // Vàng nhạt
        ctx.font = 'bold 13px "Consolas", monospace';
      } else {
        ctx.fillStyle = '#CCCCCC'; // Trắng ngà chuẩn CMD
        ctx.font = '13px "Consolas", monospace';
      }

      ctx.fillText(line, 24, yPos);
      yPos += lineHeight;
    }

    // 5. FOOTER WATERMARK BÁO CÁO FPT
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(0, totalHeight - footerHeight, width, footerHeight);

    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 11px "Consolas", monospace';
    ctx.fillText('FPT Telecom • NextSu AI Network Diagnostic Snapshot • Ảnh Chụp Báo Cáo CMD', 24, totalHeight - 16);

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Lỗi khi vẽ Canvas CMD:', err);
    return null;
  }
}

/**
 * Tải ảnh PNG về máy tính / điện thoại
 */
export function downloadCmdImage(dataUrl: string, filename: string = 'BaoCao-CMD-FPT.png'): void {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Chia sẻ báo cáo chẩn đoán mạng qua Share Sheet (Zalo, Messenger, Email...)
 */
export async function shareCmdReport(reportText: string, title: string = 'Báo Cáo CMD FPT Telecom'): Promise<void> {
  try {
    await Share.share({
      title,
      message: reportText,
    });
  } catch (err) {
    console.error('Lỗi chia sẻ:', err);
  }
}
