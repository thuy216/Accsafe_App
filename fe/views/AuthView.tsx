import React, { useState } from "react";
import { Shield, Mail, Key, CheckCircle } from "lucide-react";
import { Button, Input, Toast } from "../components/UIComponents";
import { APP_NAME } from "../constants";
import { User } from "../types";
import { authApi } from "../services/api";

interface AuthViewProps {
  t: any;
  onLoginSuccess: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ t, onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Login/Register Form State
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Loading State
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const isValidGmail = (email: string) => {
    // Regex đơn giản, Server sẽ kiểm tra kỹ hơn
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    // Validate cơ bản
    if (!formData.email || !formData.password) {
      setNotification({
        message: "Vui lòng nhập đầy đủ thông tin",
        type: "error",
      });
      return;
    }

    if (authMode === "register") {
      if (formData.password !== formData.confirmPassword) {
        setNotification({
          message: "Mật khẩu xác nhận không khớp",
          type: "error",
        });
        return;
      }
      if (!isValidGmail(formData.email)) {
        setNotification({ message: "Email không hợp lệ", type: "error" });
        return;
      }
    }

    try {
      setIsLoading(true);
      let user: User;

      if (authMode === "login") {
        // Gọi API Login thật
        user = await authApi.login(formData.email, formData.password);
      } else {
        // Gọi API Register thật (Server sẽ lo việc gửi mail xác thực hoặc tạo user)
        user = await authApi.register(formData.email, formData.password);
        setNotification({ message: "Đăng ký thành công!", type: "success" });
      }

      // Nếu API trả về user thành công -> Vào app
      onLoginSuccess(user);
    } catch (error: any) {
      // Hiển thị lỗi từ Server (ví dụ: "Sai mật khẩu", "Email đã tồn tại")
      setNotification({ message: error.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-950">
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="w-full max-w-md bg-white dark:bg-slate-850 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-16 h-16 object-contain"
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-2">
            {APP_NAME}
          </h2>
          <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
            {authMode === "login"
              ? "Chào mừng trở lại! Đăng nhập để tiếp tục."
              : "Tạo tài khoản mới để bắt đầu."}
          </p>

          <form onSubmit={handleAuth}>
            <Input
              icon={<Mail className="w-5 h-5" />}
              placeholder={t.email}
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              disabled={isLoading}
              autoFocus // Tự động focus vào ô này khi component xuất hiện
            />
            <Input
              icon={<Key className="w-5 h-5" />}
              placeholder={t.password}
              type="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              disabled={isLoading}
            />

            {authMode === "register" && (
              <Input
                icon={<CheckCircle className="w-5 h-5" />}
                placeholder={t.confirmPassword}
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                disabled={isLoading}
              />
            )}

            <Button
              type="submit"
              className="w-full py-3 text-lg shadow-blue-500/20 shadow-lg"
              isLoading={isLoading}
            >
              {authMode === "login" ? t.login : t.register}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {authMode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              className="text-blue-600 hover:underline font-medium"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setFormData({ email: "", password: "", confirmPassword: "" });
                setNotification(null);
              }}
              disabled={isLoading}
            >
              {authMode === "login" ? t.register : t.login}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
