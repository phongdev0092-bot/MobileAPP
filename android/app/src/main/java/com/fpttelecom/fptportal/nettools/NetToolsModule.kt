package com.fpttelecom.fptportal.nettools

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

/**
 * Native Module NetTools cho Android.
 * Cung cấp:
 * 1. pingOnce: Gọi /system/bin/ping với -c 1 -W timeoutSec -t ttl host, gộp stderr, đọc output trả về chuỗi thô.
 * 2. resolveHost: Phân giải DNS thành mảng IP bằng InetAddress.getAllByName.
 * 3. tcpPingOnce: Đo TCP connect time (cổng 443 hoặc chỉ định) khi ICMP bị chặn.
 * 4. getWifiDetails: Lấy Gateway Wi-Fi và SSID thực tế của thiết bị.
 */
class NetToolsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NetTools"

    companion object {
        // Chặn ký tự lạ phòng chống Command Injection
        private val SAFE_HOST_REGEX = Pattern.compile("^[a-zA-Z0-9.:_%-]+$")
    }

    @ReactMethod
    fun pingOnce(host: String, ttl: Int, timeoutSec: Int, promise: Promise) {
        val cleanHost = host.trim()
        if (!SAFE_HOST_REGEX.matcher(cleanHost).matches()) {
            promise.reject("INVALID_HOST", "Host chứa ký tự không hợp lệ, vui lòng kiểm tra lại!")
            return
        }

        val safeTtl = if (ttl in 1..255) ttl else 64
        val safeTimeout = if (timeoutSec in 1..30) timeoutSec else 2

        Thread {
            try {
                val isIpv6 = cleanHost.contains(":") && !cleanHost.contains(".")
                val binary = if (isIpv6) "/system/bin/ping6" else "/system/bin/ping"

                // Command dạng mảng: /system/bin/ping -c 1 -W timeoutSec -t ttl host
                val cmdList = arrayListOf(
                    binary,
                    "-c", "1",
                    "-W", safeTimeout.toString(),
                    "-t", safeTtl.toString(),
                    cleanHost
                )

                val processBuilder = ProcessBuilder(cmdList)
                processBuilder.redirectErrorStream(true) // Gộp stderr vào stdout

                val process = processBuilder.start()

                val reader = BufferedReader(InputStreamReader(process.inputStream))
                val output = StringBuilder()
                var line: String?

                while (reader.readLine().also { line = it } != null) {
                    output.append(line).append("\n")
                }
                reader.close()

                val finished = process.waitFor((safeTimeout + 1).toLong(), TimeUnit.SECONDS)
                if (!finished) {
                    process.destroy()
                }

                promise.resolve(output.toString())
            } catch (e: Exception) {
                promise.reject("PING_FAILED", e.message ?: "Lỗi thực thi lệnh ping", e)
            }
        }.start()
    }

    @ReactMethod
    fun resolveHost(host: String, promise: Promise) {
        val cleanHost = host.trim()
        if (!SAFE_HOST_REGEX.matcher(cleanHost).matches()) {
            promise.reject("INVALID_HOST", "Host chứa ký tự không hợp lệ!")
            return
        }

        Thread {
            try {
                val addresses = InetAddress.getAllByName(cleanHost)
                val array = Arguments.createArray()
                for (addr in addresses) {
                    addr.hostAddress?.let { array.pushString(it) }
                }
                promise.resolve(array)
            } catch (e: Exception) {
                promise.reject("RESOLVE_FAILED", e.message ?: "Không thể phân giải host", e)
            }
        }.start()
    }

    @ReactMethod
    fun tcpPingOnce(host: String, port: Int, timeoutMs: Int, promise: Promise) {
        val cleanHost = host.trim()
        val targetPort = if (port in 1..65535) port else 443
        val safeTimeout = if (timeoutMs in 100..15000) timeoutMs else 3000

        Thread {
            val socket = Socket()
            try {
                val start = System.currentTimeMillis()
                val socketAddress = InetSocketAddress(cleanHost, targetPort)
                socket.connect(socketAddress, safeTimeout)
                val duration = System.currentTimeMillis() - start
                socket.close()
                promise.resolve(duration.toDouble())
            } catch (e: Exception) {
                try {
                    socket.close()
                } catch (ignored: Exception) {}
                promise.reject("TCP_FAILED", e.message ?: "Kết nối TCP thất bại", e)
            }
        }.start()
    }

    @ReactMethod
    fun getWifiDetails(promise: Promise) {
        Thread {
            try {
                val map = Arguments.createMap()
                val context = reactContext.applicationContext
                val wm = context.getSystemService(android.content.Context.WIFI_SERVICE) as? android.net.wifi.WifiManager
                val cm = context.getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager

                var gateway = ""
                var ssid = ""
                var ip = ""

                // 1. Thử lấy thông tin từ WifiManager (DhcpInfo và ConnectionInfo)
                if (wm != null) {
                    val dhcp = wm.dhcpInfo
                    if (dhcp != null && dhcp.gateway != 0) {
                        gateway = String.format(
                            "%d.%d.%d.%d",
                            dhcp.gateway and 0xff,
                            dhcp.gateway shr 8 and 0xff,
                            dhcp.gateway shr 16 and 0xff,
                            dhcp.gateway shr 24 and 0xff
                        )
                    }
                    if (dhcp != null && dhcp.ipAddress != 0) {
                        ip = String.format(
                            "%d.%d.%d.%d",
                            dhcp.ipAddress and 0xff,
                            dhcp.ipAddress shr 8 and 0xff,
                            dhcp.ipAddress shr 16 and 0xff,
                            dhcp.ipAddress shr 24 and 0xff
                        )
                    }
                    val info = wm.connectionInfo
                    if (info != null && info.ssid != null) {
                        val s = info.ssid.replace("\"", "").trim()
                        if (s.isNotEmpty() && s != "<unknown ssid>") {
                            ssid = s
                        }
                    }
                }

                // 2. Thử lấy từ ConnectivityManager trên Android 10+ (API 29+)
                if (ssid.isEmpty() && cm != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    val activeNet = cm.activeNetwork
                    val caps = cm.getNetworkCapabilities(activeNet)
                    if (caps != null && caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)) {
                        val wifiInfo = caps.transportInfo as? android.net.wifi.WifiInfo
                        if (wifiInfo != null && wifiInfo.ssid != null) {
                            val s = wifiInfo.ssid.replace("\"", "").trim()
                            if (s.isNotEmpty() && s != "<unknown ssid>") {
                                ssid = s
                            }
                        }
                    }
                }

                // 3. Fallback lấy IP từ NetworkInterface nếu ip chưa có
                if (ip.isEmpty()) {
                    try {
                        val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
                        while (interfaces.hasMoreElements()) {
                            val intf = interfaces.nextElement()
                            if (intf.isUp && !intf.isLoopback) {
                                val addrs = intf.inetAddresses
                                while (addrs.hasMoreElements()) {
                                    val addr = addrs.nextElement()
                                    if (!addr.isLoopbackAddress && addr is java.net.Inet4Address) {
                                        ip = addr.hostAddress ?: ""
                                        break
                                    }
                                }
                            }
                            if (ip.isNotEmpty()) break
                        }
                    } catch (ignored: Exception) {}
                }

                if (gateway.isEmpty() && ip.isNotEmpty() && ip.contains(".")) {
                    val parts = ip.split(".")
                    if (parts.size == 4) {
                        gateway = "${parts[0]}.${parts[1]}.${parts[2]}.1"
                    }
                }

                map.putString("gateway", if (gateway.isNotEmpty()) gateway else "192.168.1.1")
                map.putString("ssid", ssid)
                map.putString("ipAddress", if (ip.isNotEmpty()) ip else "192.168.1.7")
                promise.resolve(map)
            } catch (e: Exception) {
                val map = Arguments.createMap()
                map.putString("gateway", "192.168.1.1")
                map.putString("ssid", "")
                map.putString("ipAddress", "192.168.1.7")
                promise.resolve(map)
            }
        }.start()
    }
}
