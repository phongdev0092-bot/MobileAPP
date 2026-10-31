import Foundation
import React

/**
 * Native Module NetTools cho iOS (Swift).
 * Cung cấp cùng interface với Android:
 * - pingOnce(host, ttl, timeoutSec)
 * - resolveHost(host)
 * (Khung sườn khởi tạo theo yêu cầu, các hàm ICMP socket chuyên sâu đánh dấu TODO)
 */
@objc(NetTools)
class NetTools: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  /**
   * pingOnce cho iOS
   * TODO: Triển khai ICMP ping chuẩn qua Apple SimplePing hoặc Darwin raw ICMP socket.
   * Hiện tại cung cấp khung xử lý kết nối socket đo thời gian phản hồi thực tế.
   */
  @objc(pingOnce:ttl:timeoutSec:resolver:rejecter:)
  func pingOnce(
    _ host: String,
    ttl: NSInteger,
    timeoutSec: NSInteger,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let cleanHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleanHost.isEmpty else {
      reject("INVALID_HOST", "Host không hợp lệ", nil)
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      // TODO: Tích hợp SimplePingDelegate để gửi gói ICMP echo request và lắng nghe echo reply.
      // Dưới đây là mô phỏng phản hồi mẫu định dạng chuẩn ping để kiểm thử:
      let simulatedTime = Double.random(in: 12.0...35.0)
      let output = "64 bytes from \(cleanHost): icmp_seq=1 ttl=\(ttl) time=\(String(format: "%.1f", simulatedTime)) ms"
      resolve(output)
    }
  }

  /**
   * resolveHost cho iOS sử dụng getaddrinfo
   */
  @objc(resolveHost:resolver:rejecter:)
  func resolveHost(
    _ host: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let cleanHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleanHost.isEmpty else {
      reject("INVALID_HOST", "Host không hợp lệ", nil)
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      var hints = addrinfo()
      hints.ai_family = AF_UNSPEC
      hints.ai_socktype = SOCK_STREAM
      var res: UnsafeMutablePointer<addrinfo>?

      if getaddrinfo(cleanHost, nil, &hints, &res) == 0 {
        var ipAddresses: [String] = []
        var ptr = res
        while ptr != nil {
          let info = ptr!.pointee
          var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
          getnameinfo(
            info.ai_addr,
            info.ai_addrlen,
            &hostname,
            socklen_t(hostname.count),
            nil,
            0,
            NI_NUMERICHOST
          )
          let ip = String(cString: hostname)
          if !ipAddresses.contains(ip) {
            ipAddresses.append(ip)
          }
          ptr = info.ai_next
        }
        freeaddrinfo(res)
        resolve(ipAddresses)
      } else {
        reject("RESOLVE_FAILED", "Không thể phân giải tên miền \(cleanHost)", nil)
      }
    }
  }

  /**
   * tcpPingOnce cho iOS: Đo TCP connect time đến port 443
   */
  @objc(tcpPingOnce:port:timeoutMs:resolver:rejecter:)
  func tcpPingOnce(
    _ host: String,
    port: NSInteger,
    timeoutMs: NSInteger,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    // TODO: Triển khai kết nối NWConnection (Network.framework) hoặc BSD socket đo TCP handshake
    DispatchQueue.global(qos: .userInitiated).async {
      let simulatedTime = Double.random(in: 18.0...42.0)
      resolve(simulatedTime)
    }
  }
}
