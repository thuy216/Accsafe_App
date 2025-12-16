import React, { useState, memo } from "react";
import { Server, Plus, CheckCircle, Trash2, Globe } from "lucide-react";
import { Button, EmptyState, Input, Modal } from "../components/UIComponents";
import { ProxyItem, User } from "../types";
import { proxyAPI } from "../services/api";
import { checkProxyLocation } from "../services/proxyLocationChecker";

interface ProxyViewProps {
  t: any;
  proxies: ProxyItem[];
  setProxies: React.Dispatch<React.SetStateAction<ProxyItem[]>>;
  notify: (msg: string, type?: "success" | "error") => void;
  currentUser?: User | null; // User hiện tại để lấy userId
}

const ProxyViewComponent: React.FC<ProxyViewProps> = ({
  t,
  proxies,
  setProxies,
  notify,
  currentUser,
}) => {
  const [isProxyModalOpen, setIsProxyModalOpen] = useState(false);
  const [proxyString, setProxyString] = useState(""); // Input để paste proxy string
  // Khởi tạo đầy đủ các trường để tránh warning uncontrolled input
  const [proxyForm, setProxyForm] = useState<Partial<ProxyItem>>({
    name: "",
    ip: "",
    port: "",
    username: "",
    password: "",
  });

  // Hàm parse proxy string format: ip:port:username:password
  const parseProxyString = (proxyStr: string) => {
    const parts = proxyStr.trim().split(':');
    if (parts.length === 4) {
      const [ip, port, username, password] = parts;
      setProxyForm({
        ...proxyForm,
        ip: ip.trim(),
        port: port.trim(),
        username: username.trim(),
        password: password.trim(),
      });
      notify("Proxy đã được parse tự động!", "success");
    } else {
      notify("Format không đúng! Vui lòng nhập: ip:port:username:password", "error");
    }
  };

  // Handle khi paste vào proxy string input
  const handleProxyStringChange = (value: string) => {
    setProxyString(value);
    // Tự động parse nếu đủ 4 phần
    const parts = value.trim().split(':');
    if (parts.length === 4) {
      parseProxyString(value);
    }
  };

  const handleAddProxy = async () => {
    if (!proxyForm.ip || !proxyForm.port) {
      notify(t.ipAndPortRequired, "error");
      return;
    }

    if (!currentUser || !currentUser.email) {
      notify("Please login to create proxy", "error");
      return;
    }

    try {
      const newProxyData = {
        userId: currentUser.email,
        name: proxyForm.name || `${proxyForm.ip}:${proxyForm.port}`,
        ip: proxyForm.ip,
        port: proxyForm.port,
        username: proxyForm.username || "",
        password: proxyForm.password || "",
        status: "checking" as const,
      };

      const createdProxy = await proxyAPI.createProxy(newProxyData);
      setProxies((prev) => [...prev, createdProxy]);
      setIsProxyModalOpen(false);
      setProxyForm({ name: "", ip: "", port: "", username: "", password: "" });
      setProxyString(""); // Reset proxy string
      notify(t.savedSuccessfully);

      // Check proxy location thực tế từ IP và update status lên server
      try {
        const locationResult = await checkProxyLocation(createdProxy);
        const updatedProxy = {
          ...createdProxy,
          status: "active" as const,
          location: locationResult.location || "Unknown"
        };
        
        // Update lên server để lưu status và location
        await proxyAPI.updateProxy(createdProxy.id, {
          status: "active",
          location: locationResult.location || "Unknown"
        });
        
        // Update UI
        setProxies((prev) =>
          prev.map((p) =>
            p.id === createdProxy.id ? updatedProxy : p
          )
        );
      } catch (error: any) {
        console.error('[ProxyView] Error checking proxy location:', error);
        // Nếu check location fail, vẫn set status active nhưng location là Unknown
        const updatedProxy = {
          ...createdProxy,
          status: "active" as const,
          location: "Unknown"
        };
        
        // Update lên server để lưu status
        try {
          await proxyAPI.updateProxy(createdProxy.id, {
            status: "active",
            location: "Unknown"
          });
        } catch (updateError) {
          console.error('[ProxyView] Error updating proxy status:', updateError);
        }
        
        // Update UI
        setProxies((prev) =>
          prev.map((p) =>
            p.id === createdProxy.id ? updatedProxy : p
          )
        );
      }
    } catch (error: any) {
      console.error('[ProxyView] Error creating proxy:', error);
      notify(error.message || "Cannot create proxy", "error");
    }
  };

  const deleteProxy = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;

    const proxy = proxies.find(p => p.id === id);
    if (!proxy) {
      // Không hiển thị lỗi nếu không tìm thấy, có thể proxy đang được load
      console.warn('[ProxyView] Proxy not found:', id);
      // Vẫn xóa khỏi UI nếu không tìm thấy trong list
      setProxies((prev) => prev.filter((p) => p.id !== id));
      return;
    }

    try {
      await proxyAPI.deleteProxy(id);
      setProxies((prev) => prev.filter((p) => p.id !== id));
      notify(t.deletedSuccessfully);
    } catch (error: any) {
      console.error('[ProxyView] Error deleting proxy:', error);
      // Nếu lỗi 404 (không tìm thấy), vẫn xóa khỏi UI
      if (error.message && (error.message.includes('Không tìm thấy proxy') || error.message.includes('Proxy not found') || error.message.includes('404'))) {
        setProxies((prev) => prev.filter((p) => p.id !== id));
        notify(t.deletedSuccessfully);
      } else {
        notify(error.message || t.cannotDeleteProxy, 'error');
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between mb-6">
        <h2 className="text-lg font-medium">Proxy List</h2>
        <Button onClick={() => setIsProxyModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> {t.addProxy}
        </Button>
      </div>

      {proxies.length === 0 ? (
        <EmptyState
          icon={<Server className="w-16 h-16 text-slate-300" />}
          message={t.noProxies}
        />
      ) : (
        <div className="bg-white dark:bg-slate-850 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {proxies.map((proxy) => (
                <tr
                  key={proxy.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium">{proxy.name}</td>
                  <td className="px-6 py-4 font-mono text-slate-500">
                    {proxy.ip}:{proxy.port}
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <Globe className="w-3 h-3 text-slate-400" />
                    {proxy.location || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                       ${
                         proxy.status === "active"
                           ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                           : proxy.status === "dead"
                           ? "bg-red-100 text-red-800"
                           : "bg-yellow-100 text-yellow-800"
                       }`}
                    >
                      {proxy.status === "active" && (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}
                      {proxy.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteProxy(proxy.id)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isProxyModalOpen}
        onClose={() => {
          setIsProxyModalOpen(false);
          setProxyString(""); // Reset khi đóng modal
        }}
        title={t.addProxy}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsProxyModalOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button onClick={handleAddProxy}>{t.save}</Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          {/* Proxy String Input - Quick Paste */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Quick Paste Proxy (ip:port:username:password)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="206.125.175.49:27415:muaproxy693a2a40d61d8:ladautflufljlrki"
                value={proxyString}
                onChange={(e) => handleProxyStringChange(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              />
              <Button
                variant="secondary"
                onClick={() => parseProxyString(proxyString)}
                className="whitespace-nowrap"
              >
                Parse
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Paste proxy string để tự động điền các trường bên dưới
            </p>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
            <Input
              label="Name (Optional)"
              placeholder="e.g. My US Proxy"
              value={proxyForm.name}
              onChange={(e) =>
                setProxyForm({ ...proxyForm, name: e.target.value })
              }
            />

            {/* Layout: IP (rộng hơn) + Port (nhỏ hơn) */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8">
                <Input
                  label="IP Address / Host"
                  placeholder="192.168.1.1"
                  value={proxyForm.ip}
                  onChange={(e) =>
                    setProxyForm({ ...proxyForm, ip: e.target.value })
                  }
                />
              </div>
              <div className="col-span-4">
                <Input
                  label="Port"
                  placeholder="8080"
                  value={proxyForm.port}
                  onChange={(e) =>
                    setProxyForm({ ...proxyForm, port: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Username (Optional)"
                placeholder="user"
                value={proxyForm.username}
                onChange={(e) =>
                  setProxyForm({ ...proxyForm, username: e.target.value })
                }
              />
              <Input
                label="Password (Optional)"
                type="password"
                placeholder="pass"
                value={proxyForm.password}
                onChange={(e) =>
                  setProxyForm({ ...proxyForm, password: e.target.value })
                }
              />
            </div>

            <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Supports HTTP, HTTPS, and SOCKS5 protocols.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Memoize component để tránh re-render không cần thiết
export const ProxyView = React.memo(ProxyViewComponent);
