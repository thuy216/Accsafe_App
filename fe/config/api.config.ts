/**
 * API Configuration
 * Quản lý cấu hình kết nối với server (local hoặc remote)
 */

export interface ApiConfig {
  useLocalServer: boolean;
  localUrl: string;
  remoteUrl: string;
  timeout: number;
}

// Cấu hình mặc định
const defaultConfig: ApiConfig = {
  useLocalServer: false, // Mặc định dùng remote server
  localUrl: "http://localhost:3000/api",
  remoteUrl: "http://163.44.193.71:3000/api", // IP VPS của bạn
  timeout: 10000, // 10 giây
};

/**
 * Lấy cấu hình API từ localStorage hoặc dùng mặc định
 * Mặc định luôn dùng remote server (production)
 * Force remote server - không cho phép dùng localhost
 */
export const getApiConfig = (): ApiConfig => {
  try {
    const savedConfig = localStorage.getItem("api_config");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      const config = { ...defaultConfig, ...parsed };
      // Force luôn dùng remote server - không cho phép localhost
      if (config.useLocalServer) {
        console.log("[ApiConfig] Forcing remote server - disabling localhost");
        config.useLocalServer = false;
        // Lưu lại config đã sửa
        localStorage.setItem("api_config", JSON.stringify(config));
      }
      return config;
    }
  } catch (error) {
    console.error("[ApiConfig] Error loading config:", error);
  }
  return defaultConfig;
};

/**
 * Reset cấu hình về mặc định (dùng remote server)
 */
export const resetApiConfig = (): void => {
  try {
    localStorage.removeItem("api_config");
    console.log("[ApiConfig] Config reset to default (remote server)");
  } catch (error) {
    console.error("[ApiConfig] Error resetting config:", error);
  }
};

/**
 * Lưu cấu hình API vào localStorage
 */
export const saveApiConfig = (config: Partial<ApiConfig>): void => {
  try {
    const currentConfig = getApiConfig();
    const newConfig = { ...currentConfig, ...config };
    localStorage.setItem("api_config", JSON.stringify(newConfig));
    console.log("[ApiConfig] Config saved:", newConfig);
  } catch (error) {
    console.error("[ApiConfig] Error saving config:", error);
  }
};

/**
 * Lấy API URL hiện tại - luôn trả về remote server
 * Không cho phép dùng localhost
 */
export const getApiUrl = (): string => {
  const config = getApiConfig();
  // Force luôn dùng remote server
  if (config.useLocalServer) {
    console.warn("[ApiConfig] getApiUrl: Forcing remote server usage");
    saveApiConfig({ useLocalServer: false });
  }
  return config.remoteUrl;
};

/**
 * Kiểm tra server có khả dụng không
 */
export const checkServerHealth = async (url?: string): Promise<boolean> => {
  const checkUrl = url || getApiUrl().replace("/api", "/api/health");
  try {
    // Sử dụng AbortController thay vì AbortSignal.timeout() để tương thích với Electron
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 giây timeout

    try {
      const response = await fetch(checkUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        console.warn("[ApiConfig] Server health check timeout:", checkUrl);
      } else {
        throw fetchError;
      }
      return false;
    }
  } catch (error) {
    console.warn("[ApiConfig] Server health check failed:", error);
    return false;
  }
};

/**
 * Lấy API URL - chỉ dùng remote server (không fallback về localhost)
 * Dùng cho các API khác ngoài auth (profile, proxy, etc.)
 */
export const getAvailableApiUrl = async (): Promise<string> => {
  const config = getApiConfig();

  // Chỉ trả về remote server, không fallback về localhost
  // Đảm bảo config luôn dùng remote server
  if (config.useLocalServer) {
    console.log("[ApiConfig] Forcing remote server usage");
    saveApiConfig({ useLocalServer: false });
  }

  return config.remoteUrl;
};
