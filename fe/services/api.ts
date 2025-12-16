import { User, ProfileItem, ProxyItem, ChatSession } from '../types';
import { getApiUrl, getAvailableApiUrl, checkServerHealth, getApiConfig, saveApiConfig } from '../config/api.config';
import { getProxyConfig, getProxyUrl } from '../config/proxy.config';

/**
 * Helper function để lấy token từ localStorage
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

/**
 * Helper function để lấy headers với authentication
 */
const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

/**
 * Helper function để lấy userId từ localStorage (fallback)
 */
const getCurrentUserEmail = (): string | null => {
  try {
    const userStr = localStorage.getItem('accsafe_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user?.email || null;
    }
  } catch (e) {
    console.error('[API] Error getting user email:', e);
  }
  return null;
};

// Đã loại bỏ tất cả fallback localStorage - Tất cả dữ liệu phải lưu trên server 

/**
 * Kiểm tra kết nối đến server trước khi thực hiện request
 */
const testConnection = async (apiUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 giây cho health check
    
    // Thử kết nối đến endpoint đơn giản (có thể là root hoặc một endpoint không cần auth)
    const testUrl = apiUrl.replace('/api', '');
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return true; // Nếu có response (dù status code là gì) nghĩa là server đang chạy
  } catch (error: any) {
    return false; // Không thể kết nối
  }
};

export const authApi = {
  /**
   * Gọi API Đăng nhập
   * Phương thức: POST
   * Body: { email, password }
   */
  login: async (email: string, password: string): Promise<User> => {
    const config = getApiConfig();
    // Chỉ dùng remote server, không fallback về localhost
    const apiUrl = config.remoteUrl;
    
    // Kiểm tra kết nối trước (optional - có thể bỏ qua nếu muốn thử trực tiếp)
    console.log(`[AuthAPI] Checking connection to remote server: ${apiUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 giây timeout

    try {
      console.log(`[AuthAPI] Attempting login with remote server: ${apiUrl}`);
      
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Xử lý lỗi từ Server trả về (VD: 401 Unauthorized, 400 Bad Request)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const serverError = new Error(errorData.message || `Lỗi đăng nhập: ${response.status}`);
        throw serverError;
      }

      const data = await response.json();
      
      // Lưu Token vào LocalStorage để dùng cho các request sau (Profile, Proxy...)
      if (data.token) {
          localStorage.setItem('auth_token', data.token);
      }

      // Đảm bảo config luôn dùng remote server
      if (config.useLocalServer) {
        saveApiConfig({ useLocalServer: false });
        console.log(`[AuthAPI] Config updated to use remote server`);
      }

      console.log(`[AuthAPI] Login successful with remote server: ${apiUrl}`);

      // Map dữ liệu từ Server về đúng định dạng User của App
      return {
        username: data.user.name || email.split('@')[0],
        email: data.user.email,
        isLoggedIn: true,
        isAdmin: data.user.role === 'admin'
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Nếu là lỗi từ server (401, 400, etc.) - throw ngay
      if (error.message && !error.message.includes('fetch') && !error.message.includes('Failed to fetch') && !error.message.includes('network') && !error.message.includes('ERR_CONNECTION') && error.name !== 'AbortError') {
        console.error(`[AuthAPI] Server returned error:`, error.message);
        throw error;
      }

      // Xử lý các loại lỗi kết nối cụ thể
      const errorMessage = error.message || '';
      const errorName = error.name || '';
      
      // Lỗi connection refused - server không chạy hoặc không thể truy cập
      if (errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('ECONNREFUSED')) {
        console.error(`[AuthAPI] Connection refused to ${apiUrl}`);
        throw new Error(`Không thể kết nối đến server ${apiUrl.replace('/api', '')}.\n\nNguyên nhân có thể:\n1. Server chưa được khởi động\n2. Port 3000 bị chặn bởi firewall\n3. IP server không đúng hoặc không khả dụng\n4. Server đang bảo trì\n\nVui lòng liên hệ quản trị viên để kiểm tra.`);
      }
      
      // Lỗi timeout
      if (errorName === 'AbortError' || errorMessage.includes('timeout')) {
        throw new Error(`Kết nối đến server quá lâu (timeout).\n\nServer: ${apiUrl.replace('/api', '')}\n\nVui lòng kiểm tra:\n1. Kết nối mạng có ổn định không?\n2. Server có đang phản hồi không?`);
      }
      
      // Lỗi network chung
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
        throw new Error(`Không thể kết nối đến máy chủ.\n\nServer: ${apiUrl.replace('/api', '')}\n\nVui lòng kiểm tra:\n1. Server có đang chạy không?\n2. Kết nối mạng có ổn định không?\n3. Firewall có chặn kết nối không?\n4. Địa chỉ IP server có đúng không?`);
      }
      
      // Lỗi khác
      console.error(`[AuthAPI] Unknown error:`, error);
      throw new Error(`Lỗi kết nối: ${errorMessage || 'Không xác định được nguyên nhân'}`);
    }
  },

  /**
   * Gọi API Đăng ký
   * Phương thức: POST
   * Body: { email, password }
   * Chỉ dùng remote server, không fallback về localhost
   */
  register: async (email: string, password: string): Promise<User> => {
    try {
        const config = getApiConfig();
        const apiUrl = config.remoteUrl; // Chỉ dùng remote server
        
        console.log(`[AuthAPI] Attempting register with remote server: ${apiUrl}`);
        
        const response = await fetch(`${apiUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Đăng ký thất bại');
        }

        const data = await response.json();
        
        // Đảm bảo config luôn dùng remote server
        if (config.useLocalServer) {
          saveApiConfig({ useLocalServer: false });
          console.log(`[AuthAPI] Config updated to use remote server`);
        }
        
        if (data.token) {
            localStorage.setItem('auth_token', data.token);
            return {
                username: data.user.name || email.split('@')[0],
                email: data.user.email,
                isLoggedIn: true,
                isAdmin: false
            };
        }
        
        return {
            username: email.split('@')[0],
            email: email,
            isLoggedIn: true,
            isAdmin: false
        };

    } catch (error: any) {
        console.error("Register Error:", error);
        
        // Xử lý các loại lỗi kết nối cụ thể
        const errorMessage = error.message || '';
        const errorName = error.name || '';
        const apiConfig = getApiConfig();
        
        // Lỗi connection refused
        if (errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('ECONNREFUSED')) {
          throw new Error(`Không thể kết nối đến server ${apiConfig.remoteUrl.replace('/api', '')}.\n\nNguyên nhân có thể:\n1. Server chưa được khởi động\n2. Port 3000 bị chặn bởi firewall\n3. IP server không đúng hoặc không khả dụng\n4. Server đang bảo trì\n\nVui lòng liên hệ quản trị viên để kiểm tra.`);
        }
        
        // Lỗi timeout
        if (errorName === 'AbortError' || errorMessage.includes('timeout')) {
          throw new Error(`Kết nối đến server quá lâu (timeout).\n\nServer: ${apiConfig.remoteUrl.replace('/api', '')}\n\nVui lòng kiểm tra kết nối mạng.`);
        }
        
        // Lỗi network chung
        if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
          throw new Error(`Không thể kết nối đến máy chủ.\n\nServer: ${apiConfig.remoteUrl.replace('/api', '')}\n\nVui lòng kiểm tra:\n1. Server có đang chạy không?\n2. Kết nối mạng có ổn định không?\n3. Firewall có chặn kết nối không?`);
        }
        
        // Lỗi từ server (400, 401, etc.)
        throw new Error(errorMessage);
    }
  }
};

/**
 * API Functions cho Profiles
 * Mỗi user chỉ có thể xem và quản lý profiles của chính mình
 */
export const profileAPI = {
  /**
   * GET /api/profiles
   * Lấy tất cả profiles của user hiện tại (tự động lấy từ token)
   */
  getProfiles: async (): Promise<ProfileItem[]> => {
    try {
      // Lấy userId từ currentUser
      const userStr = localStorage.getItem('accsafe_user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const userId = currentUser?.email;

      if (!userId) {
        throw new Error('Vui lòng đăng nhập');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/profiles?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 404) {
          throw new Error('Server không hỗ trợ endpoint này. Vui lòng kiểm tra lại server.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi tải profiles: ${response.status}`);
      }

      const data = await response.json();
      return data.profiles || [];
    } catch (error: any) {
      console.error('[ProfileAPI] Error fetching profiles:', error);
      // Không có fallback - phải kết nối được server
      const errorMessage = error.message || 'Không thể tải danh sách profiles';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và đảm bảo server đang chạy.');
      }
      throw new Error(errorMessage);
    }
  },

  /**
   * POST /api/profiles
   * Tạo profile mới cho user hiện tại
   */
  createProfile: async (profile: Omit<ProfileItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProfileItem> => {
    try {
      // Đảm bảo có userId
      if (!profile.userId) {
        const userStr = localStorage.getItem('accsafe_user');
        const currentUser = userStr ? JSON.parse(userStr) : null;
        if (!currentUser?.email) {
          throw new Error('Vui lòng đăng nhập');
        }
        profile.userId = currentUser.email;
      }

      // Sử dụng getAvailableApiUrl để tự động fallback nếu server không khả dụng
      const apiUrl = await getAvailableApiUrl();
      const url = `${apiUrl}/profiles`;
      const headers = getAuthHeaders();
      const body = JSON.stringify(profile);
      const authHeader = (headers as Record<string, string>).Authorization;
      
      console.log('[ProfileAPI] Creating profile:', { url, hasAuth: !!authHeader, userId: profile.userId });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 404) {
          throw new Error('Server không hỗ trợ endpoint này. Vui lòng kiểm tra lại server.');
        }
        const errorData = await response.json().catch(() => ({}));
        console.error('[ProfileAPI] Error response:', { 
          status: response.status, 
          statusText: response.statusText, 
          errorData,
          url,
          requestBody: { ...profile, hardware: '***' }
        });
        
        // Nếu error message là từ register endpoint, đó là lỗi routing hoặc server không đúng
        if (errorData.message && errorData.message.includes('email và mật khẩu')) {
          console.error('[ProfileAPI] Server returned register endpoint error - possible routing issue');
          throw new Error('Lỗi kết nối server. Vui lòng kiểm tra lại kết nối mạng hoặc đăng nhập lại.');
        }
        
        // Nếu là lỗi 400 Bad Request, hiển thị message cụ thể
        if (response.status === 400) {
          throw new Error(errorData.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin profile.');
        }
        
        throw new Error(errorData.message || `Lỗi khi tạo profile: ${response.status}`);
      }

      const data = await response.json();
      return data.profile;
    } catch (error: any) {
      console.error('[ProfileAPI] Error creating profile:', error);
      
      // Không có fallback - phải kết nối được server
      const errorMessage = error.message || 'Không thể tạo profile';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('ERR_CONNECTION')) {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và đảm bảo server đang chạy.');
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * PUT /api/profiles/:id
   * Cập nhật profile (chỉ có thể cập nhật profile của chính mình)
   */
  updateProfile: async (profileId: string, updates: Partial<ProfileItem>): Promise<ProfileItem> => {
    try {
      // Lấy userId từ currentUser
      const userStr = localStorage.getItem('accsafe_user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const userId = currentUser?.email;

      if (!userId) {
        throw new Error('Vui lòng đăng nhập');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/profiles/${profileId}?userId=${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...updates,
          userId, // Đảm bảo userId trong body
          updatedAt: Date.now(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 403) {
          throw new Error('Bạn không có quyền cập nhật profile này');
        }
        if (response.status === 404) {
          throw new Error('Server không hỗ trợ endpoint này hoặc profile không tồn tại.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi cập nhật profile: ${response.status}`);
      }

      const data = await response.json();
      return data.profile;
    } catch (error: any) {
      console.error('[ProfileAPI] Error updating profile:', error);
      // Không có fallback - phải kết nối được server
      const errorMessage = error.message || 'Không thể cập nhật profile';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và đảm bảo server đang chạy.');
      }
      throw new Error(errorMessage);
    }
  },

  /**
   * DELETE /api/profiles/:id
   * Xóa profile (chỉ có thể xóa profile của chính mình)
   */
  deleteProfile: async (profileId: string): Promise<void> => {
    try {
      // Lấy userId từ currentUser
      const userStr = localStorage.getItem('accsafe_user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const userId = currentUser?.email;

      if (!userId) {
        throw new Error('Vui lòng đăng nhập');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/profiles/${profileId}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 403) {
          throw new Error('Bạn không có quyền xóa profile này');
        }
        if (response.status === 404) {
          throw new Error('Server không hỗ trợ endpoint này hoặc profile không tồn tại.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi xóa profile: ${response.status}`);
      }

      // Xóa thành công từ server
      return;
    } catch (error: any) {
      console.error('[ProfileAPI] Error deleting profile:', error);
      // Không có fallback - phải kết nối được server
      const errorMessage = error.message || 'Không thể xóa profile';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và đảm bảo server đang chạy.');
      }
      throw new Error(errorMessage);
    }
  },
};

/**
 * API Functions cho Proxies
 * Mỗi user chỉ có thể xem và quản lý proxies của chính mình
 */
export const proxyAPI = {
  /**
   * GET /api/proxies
   * Lấy tất cả proxies của user hiện tại (tự động lấy từ token)
   */
  getProxies: async (): Promise<ProxyItem[]> => {
    try {
      // Lấy userId từ currentUser
      const userStr = localStorage.getItem('accsafe_user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const userId = currentUser?.email;

      if (!userId) {
        throw new Error('Vui lòng đăng nhập');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/proxies?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi tải proxies: ${response.status}`);
      }

      const data = await response.json();
      return data.proxies || [];
    } catch (error: any) {
      console.error('[ProxyAPI] Error fetching proxies:', error);
      throw new Error(error.message || 'Không thể tải danh sách proxies');
    }
  },

  /**
   * POST /api/proxies
   * Tạo proxy mới cho user hiện tại
   */
  createProxy: async (proxy: Omit<ProxyItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProxyItem> => {
    try {
      // Đảm bảo có userId
      if (!proxy.userId) {
        const userStr = localStorage.getItem('accsafe_user');
        const currentUser = userStr ? JSON.parse(userStr) : null;
        if (!currentUser?.email) {
          throw new Error('Vui lòng đăng nhập');
        }
        proxy.userId = currentUser.email;
      }

      // Sử dụng getAvailableApiUrl để tự động fallback nếu server không khả dụng
      let apiUrl: string;
      try {
        apiUrl = await getAvailableApiUrl();
      } catch (error: any) {
        console.error('[ProxyAPI] Error getting API URL:', error);
        // Fallback: thử dùng URL hiện tại từ config
        apiUrl = getApiUrl();
      }
      
      const url = `${apiUrl}/proxies`;
      const headers = getAuthHeaders();
      const body = JSON.stringify(proxy);
      const authHeader = (headers as Record<string, string>).Authorization;
      
      console.log('[ProxyAPI] Creating proxy:', { url, hasAuth: !!authHeader, userId: proxy.userId });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        // Thêm timeout để tránh đợi quá lâu
        signal: AbortSignal.timeout(15000), // 15 giây
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        const errorData = await response.json().catch(() => ({}));
        console.error('[ProxyAPI] Error response:', { 
          status: response.status, 
          statusText: response.statusText, 
          errorData,
          url,
          requestBody: proxy
        });
        
        // Nếu error message là từ register endpoint, đó là lỗi routing hoặc server không đúng
        if (errorData.message && errorData.message.includes('email và mật khẩu')) {
          console.error('[ProxyAPI] Server returned register endpoint error - possible routing issue');
          throw new Error('Lỗi kết nối server. Vui lòng kiểm tra lại kết nối mạng hoặc đăng nhập lại.');
        }
        
        // Nếu là lỗi 400 Bad Request, hiển thị message cụ thể
        if (response.status === 400) {
          throw new Error(errorData.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin proxy.');
        }
        
        throw new Error(errorData.message || `Lỗi khi tạo proxy: ${response.status}`);
      }

      const data = await response.json();
      return data.proxy;
    } catch (error: any) {
      console.error('[ProxyAPI] Error creating proxy:', error);
      
      // Nếu là lỗi network hoặc timeout
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error('Kết nối đến server quá lâu. Vui lòng kiểm tra kết nối mạng hoặc đảm bảo server đang chạy.');
      }
      
      if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('ERR_CONNECTION') || error.message.includes('ECONNREFUSED'))) {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng hoặc đảm bảo server đang chạy.');
      }
      
      throw new Error(error.message || 'Không thể tạo proxy');
    }
  },

  /**
   * PUT /api/proxies/:id
   * Cập nhật proxy (chỉ có thể cập nhật proxy của chính mình)
   */
  updateProxy: async (proxyId: string, updates: Partial<ProxyItem>): Promise<ProxyItem> => {
    try {
      // Lấy userId từ currentUser
      const userStr = localStorage.getItem('accsafe_user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const userId = currentUser?.email;

      if (!userId) {
        throw new Error('Vui lòng đăng nhập');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/proxies/${proxyId}?userId=${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...updates,
          userId, // Đảm bảo userId trong body
          updatedAt: Date.now(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 403) {
          throw new Error('Bạn không có quyền cập nhật proxy này');
        }
        if (response.status === 404) {
          throw new Error('Không tìm thấy proxy');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi cập nhật proxy: ${response.status}`);
      }

      const data = await response.json();
      return data.proxy;
    } catch (error: any) {
      console.error('[ProxyAPI] Error updating proxy:', error);
      throw new Error(error.message || 'Không thể cập nhật proxy');
    }
  },

  /**
   * DELETE /api/proxies/:id
   * Xóa proxy (chỉ có thể xóa proxy của chính mình)
   */
  deleteProxy: async (proxyId: string): Promise<void> => {
    try {
      // Lấy userId từ currentUser
      const userStr = localStorage.getItem('accsafe_user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const userId = currentUser?.email;

      if (!userId) {
        throw new Error('Vui lòng đăng nhập');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/proxies/${proxyId}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 403) {
          throw new Error('Bạn không có quyền xóa proxy này');
        }
        if (response.status === 404) {
          throw new Error('Không tìm thấy proxy');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi xóa proxy: ${response.status}`);
      }
    } catch (error: any) {
      console.error('[ProxyAPI] Error deleting proxy:', error);
      throw new Error(error.message || 'Không thể xóa proxy');
    }
  },
};

/**
 * Chat API
 * Quản lý chat sessions giữa users và admin
 */
export const chatAPI = {
  /**
   * GET /api/chats
   * Lấy tất cả chat sessions (chỉ admin)
   */
  getAllChatSessions: async (): Promise<ChatSession[]> => {
    try {
      const apiUrl = await getAvailableApiUrl();
      const response = await fetch(`${apiUrl}/chats`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 403) {
          throw new Error('Chỉ admin mới có quyền xem tất cả chat sessions');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi tải chat sessions: ${response.status}`);
      }

      const data = await response.json();
      return data.chatSessions || [];
    } catch (error: any) {
      console.error('[ChatAPI] Error getting all chat sessions:', error);
      throw new Error(error.message || 'Không thể tải chat sessions');
    }
  },

  /**
   * GET /api/chats/:userId
   * Lấy chat session của một user cụ thể
   */
  getChatSession: async (userId: string): Promise<ChatSession> => {
    try {
      const apiUrl = await getAvailableApiUrl();
      const response = await fetch(`${apiUrl}/chats/${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi tải chat session: ${response.status}`);
      }

      const data = await response.json();
      return data.chatSession || {
        userId,
        userEmail: userId,
        messages: [],
        lastUpdated: Date.now(),
      };
    } catch (error: any) {
      console.error('[ChatAPI] Error getting chat session:', error);
      throw new Error(error.message || 'Không thể tải chat session');
    }
  },

  /**
   * POST /api/chats
   * Tạo hoặc cập nhật chat session
   */
  saveChatSession: async (chatSession: ChatSession): Promise<ChatSession> => {
    try {
      const apiUrl = await getAvailableApiUrl();
      const response = await fetch(`${apiUrl}/chats`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...chatSession,
          lastUpdated: Date.now(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi lưu chat session: ${response.status}`);
      }

      const data = await response.json();
      return data.chatSession;
    } catch (error: any) {
      console.error('[ChatAPI] Error saving chat session:', error);
      throw new Error(error.message || 'Không thể lưu chat session');
    }
  },

  /**
   * PUT /api/chats/:userId
   * Cập nhật chat session
   */
  updateChatSession: async (userId: string, updates: Partial<ChatSession>): Promise<ChatSession> => {
    try {
      const apiUrl = await getAvailableApiUrl();
      const response = await fetch(`${apiUrl}/chats/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...updates,
          lastUpdated: Date.now(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 404) {
          throw new Error('Không tìm thấy chat session');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi cập nhật chat session: ${response.status}`);
      }

      const data = await response.json();
      return data.chatSession;
    } catch (error: any) {
      console.error('[ChatAPI] Error updating chat session:', error);
      throw new Error(error.message || 'Không thể cập nhật chat session');
    }
  },

  /**
   * DELETE /api/chats/:userId
   * Xóa chat session
   */
  deleteChatSession: async (userId: string): Promise<void> => {
    try {
      const apiUrl = await getAvailableApiUrl();
      const response = await fetch(`${apiUrl}/chats/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 404) {
          throw new Error('Không tìm thấy chat session');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi xóa chat session: ${response.status}`);
      }
    } catch (error: any) {
      console.error('[ChatAPI] Error deleting chat session:', error);
      throw new Error(error.message || 'Không thể xóa chat session');
    }
  },
};

/**
 * User Management API (Admin only)
 */
export const userAPI = {
  /**
   * GET /api/users
   * Lấy danh sách tất cả users (chỉ admin)
   */
  getAllUsers: async (): Promise<User[]> => {
    try {
      const apiUrl = await getAvailableApiUrl();
      const headers = getAuthHeaders();
      
      console.log('[UserAPI] Getting users from:', apiUrl);
      const authHeader =
        (headers as any)?.Authorization ||
        (headers as any)?.authorization ||
        (Array.isArray(headers)
          ? headers.find(([key]) => key.toLowerCase() === 'authorization')?.[1]
          : null);
      console.log('[UserAPI] Headers:', { Authorization: authHeader ? 'Present' : 'Missing' });
      
      const response = await fetch(`${apiUrl}/users`, {
        method: 'GET',
        headers: headers,
      });

      console.log('[UserAPI] Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[UserAPI] 403 Forbidden:', errorData);
          throw new Error(errorData.message || 'Bạn không có quyền truy cập. Chỉ admin mới có quyền xem danh sách users.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi lấy danh sách users: ${response.status}`);
      }

      const data = await response.json();
      console.log('[UserAPI] Received users:', data.users?.length || 0);
      return data.users || [];
    } catch (error: any) {
      console.error('[UserAPI] Error getting users:', error);
      throw new Error(error.message || 'Không thể lấy danh sách users');
    }
  },

  /**
   * DELETE /api/users/:email
   * Xóa user (chỉ admin)
   */
  deleteUser: async (email: string): Promise<void> => {
    try {
      const apiUrl = await getAvailableApiUrl();
      const response = await fetch(`${apiUrl}/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (response.status === 403) {
          throw new Error('Bạn không có quyền xóa user. Chỉ admin mới có quyền này.');
        }
        if (response.status === 404) {
          throw new Error('Không tìm thấy user');
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Không thể xóa user này');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi khi xóa user: ${response.status}`);
      }

      return;
    } catch (error: any) {
      console.error('[UserAPI] Error deleting user:', error);
      throw new Error(error.message || 'Không thể xóa user');
    }
  },
};