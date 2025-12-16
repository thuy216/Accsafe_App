/**
 * Proxy Configuration
 * Quản lý cấu hình proxy để kết nối với server
 */

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
}

/**
 * Lấy cấu hình proxy từ localStorage
 */
export const getProxyConfig = (): ProxyConfig | null => {
  try {
    const savedConfig = localStorage.getItem('proxy_config');
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
  } catch (error) {
    console.error('[ProxyConfig] Error loading config:', error);
  }
  return null;
};

/**
 * Lưu cấu hình proxy vào localStorage
 */
export const saveProxyConfig = (config: ProxyConfig): void => {
  try {
    localStorage.setItem('proxy_config', JSON.stringify(config));
    console.log('[ProxyConfig] Config saved:', { ...config, password: '***' });
  } catch (error) {
    console.error('[ProxyConfig] Error saving config:', error);
  }
};

/**
 * Xóa cấu hình proxy
 */
export const clearProxyConfig = (): void => {
  localStorage.removeItem('proxy_config');
  console.log('[ProxyConfig] Config cleared');
};

/**
 * Tạo proxy URL từ cấu hình
 */
export const getProxyUrl = (config: ProxyConfig): string => {
  const { host, port, username, password, protocol } = config;
  
  if (username && password) {
    return `${protocol}://${username}:${password}@${host}:${port}`;
  }
  return `${protocol}://${host}:${port}`;
};

/**
 * Parse proxy string (ip:port:username:password) thành ProxyConfig
 */
export const parseProxyString = (proxyString: string): ProxyConfig | null => {
  const parts = proxyString.split(':');
  
  if (parts.length < 2) {
    return null;
  }
  
  const [host, port, username, password] = parts;
  
  if (!host || !port) {
    return null;
  }
  
  return {
    enabled: true,
    host: host.trim(),
    port: parseInt(port.trim(), 10),
    username: username?.trim() || undefined,
    password: password?.trim() || undefined,
    protocol: 'http', // Mặc định HTTP
  };
};

