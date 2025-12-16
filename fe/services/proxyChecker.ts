import axios from 'axios';
import { ProxyItem } from '../types';

/**
 * Parse proxy config từ format "ip:port:user:pass" hoặc từ ProxyItem
 */
export const parseProxyConfig = (proxy: ProxyItem | string) => {
  if (typeof proxy === 'string') {
    const parts = proxy.split(':');
    if (parts.length === 4) {
      const [ip, port, user, pwd] = parts;
      return {
        ip,
        port,
        username: user,
        password: pwd,
        server: `http://${ip}:${port}`,
        url: `http://${user}:${pwd}@${ip}:${port}`
      };
    }
    return null;
  } else {
    // ProxyItem
    if (proxy.username && proxy.password) {
      return {
        ip: proxy.ip,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
        server: `http://${proxy.ip}:${proxy.port}`,
        url: `http://${proxy.username}:${proxy.password}@${proxy.ip}:${proxy.port}`
      };
    }
    return null;
  }
};

/**
 * Check proxy IP, timezone và location (tương đương get_proxy_info trong Python)
 */
/**
 * NOTE: getProxyInfo chỉ được dùng trong main process (browserLauncher.js)
 * Không import function này trong frontend code
 */
export const getProxyInfo = async (proxyUrl: string): Promise<{ ip: string | null; timezone: string; location?: string; country?: string; city?: string }> => {
  // Function này chỉ được dùng trong main process
  // Frontend không nên gọi function này trực tiếp
  throw new Error('getProxyInfo should only be called from main process');
};

/**
 * Get IP info khi không dùng proxy (direct connection)
 */
export const getDirectIPInfo = async (): Promise<{ ip: string; timezone: string }> => {
  console.log('[*] Đang lấy thông tin IP mạng gốc (Direct)...');
  
  const apis: Array<{ url: string; timezoneKey?: string }> = [
    { url: 'http://ip-api.com/json', timezoneKey: 'timezone' },
    { url: 'https://api.ipify.org?format=json' },
  ];

  for (const api of apis) {
    try {
      const resp = await axios.get(api.url, { timeout: 10000 });
      
      if (resp.status === 200) {
        const data = resp.data;
        const ip = data.query || data.ip;
        
        let timezone = 'Asia/Ho_Chi_Minh';
        if (api.timezoneKey && data[api.timezoneKey]) {
          timezone = data[api.timezoneKey];
        }
        
        console.log(`    [OK] IP: ${ip} | Timezone: ${timezone}`);
        return { ip, timezone };
      }
    } catch (error: any) {
      console.log(`    [SKIP] Lỗi kết nối API: ${error.message}`);
    }
  }
  
  // Fallback nếu mất mạng hoàn toàn
  return { ip: '127.0.0.1', timezone: 'Asia/Ho_Chi_Minh' };
};

