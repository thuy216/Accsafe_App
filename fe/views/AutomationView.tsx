import React, { useState } from 'react';
import { ShoppingBag, Youtube, Chrome, Play, X } from 'lucide-react';
import { AUTOMATION_SCRIPTS } from '../constants';
import { ProfileItem, ProxyItem } from '../types';
import { Modal } from '../components/UIComponents';

interface AutomationViewProps {
  notify: (msg: string, type?: 'success' | 'error') => void;
  profiles: ProfileItem[];
  proxies: ProxyItem[];
}

export const AutomationView: React.FC<AutomationViewProps> = ({ notify, profiles, proxies }) => {
  const [selectedScript, setSelectedScript] = useState<typeof AUTOMATION_SCRIPTS[0] | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleScriptClick = (script: typeof AUTOMATION_SCRIPTS[0]) => {
    if (profiles.length === 0) {
      notify('Vui lòng tạo ít nhất một profile trước khi sử dụng tính năng này', 'error');
      return;
    }
    setSelectedScript(script);
    setIsModalOpen(true);
  };

  const handleRunScript = async () => {
    if (!selectedScript || !selectedProfileId) {
      notify('Vui lòng chọn profile', 'error');
      return;
    }

    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) {
      notify('Profile không tồn tại', 'error');
      return;
    }

    setIsModalOpen(false);

    try {
      // Kiểm tra Electron có sẵn không
      if (typeof window === 'undefined' || !window.require) {
        notify('Electron không khả dụng. Vui lòng chạy app trong Electron.', 'error');
        setSelectedScript(null);
        setSelectedProfileId('');
        return;
      }

      const { ipcRenderer } = window.require('electron');

      // Lấy proxy string nếu profile có proxy (giống ProfileView)
      let proxyString = null;
      if (profile.proxyId) {
        const proxy = proxies.find(p => p.id === profile.proxyId);
        if (proxy) {
          // Format: ip:port:username:password hoặc ip:port
          if (proxy.username && proxy.password) {
            proxyString = `${proxy.ip}:${proxy.port}:${proxy.username}:${proxy.password}`;
          } else {
            proxyString = `${proxy.ip}:${proxy.port}`;
          }
        }
      }

      // Cập nhật UI ngay lập tức
      notify(`Đang mở ${selectedScript.name} với profile "${profile.name}"...`, 'success');

      // Gửi IPC event để start profile (giống ProfileView)
      ipcRenderer.send('start-profile', {
        ...profile,
        proxyString,
        url: selectedScript.url || 'https://whoer.net'
      });

      // Reset state
      setSelectedScript(null);
      setSelectedProfileId('');
    } catch (error: any) {
      console.error('[AutomationView] Error launching browser:', error);
      notify(error.message || 'Lỗi khi mở browser', 'error');
      setSelectedScript(null);
      setSelectedProfileId('');
    }
  };

  // Group scripts by category
  const groupedScripts = AUTOMATION_SCRIPTS.reduce((acc, script) => {
    const category = script.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(script);
    return acc;
  }, {} as Record<string, typeof AUTOMATION_SCRIPTS>);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Facebook':
        return <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.17 6 13 6c.87 0 1.7.08 1.7.08v2.7h-1.35c-1.23 0-1.65.6-1.65 1.4V12h3l-.48 3h-2.52v6.8c4.56-.93 8-4.96 8-9.8z"/></svg>;
      case 'Instagram':
        return <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162 0 3.403 2.759 6.162 6.162 6.162 3.403 0 6.162-2.759 6.162-6.162 0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4 2.209 0 4 1.791 4 4 0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>;
      case 'Twitter':
        return <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
      case 'LinkedIn':
        return <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
      case 'TikTok':
        return <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>;
      case 'Reddit':
        return <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>;
      case 'ShoppingBag':
        return <ShoppingBag className="w-6 h-6" />;
      case 'Youtube':
        return <Youtube className="w-6 h-6" />;
      case 'Chrome':
        return <Chrome className="w-6 h-6" />;
      default:
        return <Chrome className="w-6 h-6" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-lg font-semibold mb-6">Mở nhanh các trang web với Profile</h2>
      
      {profiles.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Bạn cần tạo ít nhất một profile trước khi sử dụng tính năng này. 
            <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = '#profiles'; }} className="underline ml-1">
              Tạo profile ngay
            </a>
          </p>
        </div>
      )}

      {/* Grouped Scripts */}
      {Object.entries(groupedScripts).map(([category, scripts]) => (
        <div key={category} className="mb-8">
          <h3 className="text-md font-semibold mb-4 text-slate-700 dark:text-slate-300">{category}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {scripts.map(script => (
              <div 
                key={script.id} 
                className="bg-white dark:bg-slate-850 p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group shadow-sm hover:shadow-lg"
                onClick={() => handleScriptClick(script)}
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {getIcon(script.icon)}
                </div>
                <h3 className="font-bold text-lg mb-1">{script.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{script.url}</p>
                <div className="mt-4 flex items-center text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-3 h-3 mr-1 fill-current" /> Mở ngay
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Profile Selection Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedScript(null);
          setSelectedProfileId('');
        }}
        title={`Chọn Profile để mở ${selectedScript?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Chọn profile bạn muốn sử dụng để mở <strong>{selectedScript?.url}</strong>
          </p>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {profiles.map(profile => (
              <div
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedProfileId === profile.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{profile.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {profile.os} • {profile.hardware.cpuCores} cores • {profile.hardware.ram}GB RAM
                    </div>
                  </div>
                  {selectedProfileId === profile.id && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => {
                setIsModalOpen(false);
                setSelectedScript(null);
                setSelectedProfileId('');
              }}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleRunScript}
              disabled={!selectedProfileId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Mở ngay
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
